CREATE TABLE events (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_type  TEXT NOT NULL,
  actor_type  TEXT NOT NULL CHECK (actor_type IN ('human','system','hook','agent')),
  actor_id    TEXT,
  entity_type TEXT,
  entity_id   UUID,
  run_id      UUID,
  payload     JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_events_type_ts ON events(event_type, ts);
CREATE INDEX idx_events_entity ON events(entity_type, entity_id);
CREATE RULE events_no_update AS ON UPDATE TO events DO INSTEAD NOTHING;
CREATE RULE events_no_delete AS ON DELETE TO events DO INSTEAD NOTHING;

CREATE TABLE curation_decisions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type      TEXT NOT NULL,
  entity_id        UUID NOT NULL,
  run_id           UUID,
  decision         TEXT NOT NULL
                   CHECK (decision IN ('approved','rejected','edited_approved')),
  reason_code      TEXT REFERENCES rejection_reasons(code),
  original_content JSONB NOT NULL,
  edited_content   JSONB,
  notes            TEXT,
  time_spent_ms    INT,
  judge_score      NUMERIC(3,2),
  judge_rubric     TEXT,
  decided_by       TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_decisions_entity ON curation_decisions(entity_type, entity_id);
CREATE INDEX idx_decisions_run ON curation_decisions(run_id);

CREATE VIEW curation_queue AS
  SELECT 'profile' AS entity_type, id AS entity_id, content, quality_score,
         generation_run_id, created_at
  FROM profiles WHERE status = 'pending'
  ORDER BY created_at;

-- Atomic curation. Hashes are computed by the caller (JS) — Postgres never hashes.
CREATE OR REPLACE FUNCTION decide_curation(
  p_entity_type text, p_entity_id uuid, p_decision text,
  p_reason_code text, p_edited_content jsonb, p_new_content_sha256 char(64),
  p_notes text, p_time_spent_ms int,
  p_judge_score numeric, p_judge_rubric text, p_decided_by text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_original jsonb; v_version int; v_run uuid; v_decision_id uuid;
BEGIN
  IF p_entity_type <> 'profile' THEN
    RAISE EXCEPTION 'unsupported entity_type %', p_entity_type;
  END IF;
  SELECT content, version, generation_run_id INTO v_original, v_version, v_run
    FROM profiles WHERE id = p_entity_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pending entity not found'; END IF;

  IF p_decision = 'approved' THEN
    UPDATE profiles SET status='approved' WHERE id=p_entity_id;
  ELSIF p_decision = 'rejected' THEN
    IF p_reason_code IS NULL THEN RAISE EXCEPTION 'reason_code required'; END IF;
    UPDATE profiles SET status='rejected' WHERE id=p_entity_id;
  ELSIF p_decision = 'edited_approved' THEN
    IF p_edited_content IS NULL OR p_new_content_sha256 IS NULL THEN
      RAISE EXCEPTION 'edited_content and hash required';
    END IF;
    UPDATE profiles SET
      content = p_edited_content,
      big_five = p_edited_content->'big_five',
      mbti_label = p_edited_content->>'mbti_label',
      decision_style = p_edited_content->>'decision_style',
      summary = p_edited_content->>'summary',
      tags = COALESCE((SELECT array_agg(x)
             FROM jsonb_array_elements_text(p_edited_content->'tags') x), tags),
      version = v_version + 1,
      status = 'approved'
    WHERE id = p_entity_id;
    INSERT INTO provenance (entity_type, entity_id, entity_version, model,
      prompt_hash, template_hash, params, sha256_content)
    VALUES (p_entity_type, p_entity_id, v_version+1, 'human-edit',
      repeat('0',64), repeat('0',64),
      jsonb_build_object('decided_by', p_decided_by), p_new_content_sha256);
  ELSE
    RAISE EXCEPTION 'invalid decision %', p_decision;
  END IF;

  INSERT INTO curation_decisions (entity_type, entity_id, run_id, decision,
    reason_code, original_content, edited_content, notes, time_spent_ms,
    judge_score, judge_rubric, decided_by)
  VALUES (p_entity_type, p_entity_id, v_run, p_decision, p_reason_code,
    v_original, p_edited_content, p_notes, p_time_spent_ms,
    p_judge_score, p_judge_rubric, p_decided_by)
  RETURNING id INTO v_decision_id;

  INSERT INTO events (event_type, actor_type, actor_id, entity_type, entity_id,
    run_id, payload)
  VALUES ('curation.decided','human', p_decided_by, p_entity_type, p_entity_id,
    v_run, jsonb_build_object('decision', p_decision, 'reason_code', p_reason_code,
    'time_spent_ms', p_time_spent_ms));
  RETURN v_decision_id;
END $$;

CREATE OR REPLACE FUNCTION similar_profile(p_summary text, p_threshold numeric)
RETURNS TABLE (id uuid, sim real) LANGUAGE sql STABLE AS $$
  SELECT id, similarity(summary, p_summary) AS sim FROM profiles
  WHERE status='approved' AND similarity(summary, p_summary) > p_threshold
  ORDER BY sim DESC LIMIT 1 $$;

CREATE OR REPLACE FUNCTION increment_run_counter(p_run_id uuid, p_col text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('UPDATE generation_runs SET %I = %I + 1 WHERE id = $1', p_col, p_col) USING p_run_id;
END $$;
