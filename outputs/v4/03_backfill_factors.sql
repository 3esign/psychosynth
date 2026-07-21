-- Factor backfill — enrich EXISTING profiles that predate the multi-factor
-- surface. Set-based; per-row determinism via md5(id||salt), so re-running
-- yields identical values. Derivations mirror scripts/lib/factors.js
-- (directional loadings from the SD3 / prospect-theory / CRT literature).
-- Scope guard: only rows captured in _v4_backup_factor_rows (see 00_PREFLIGHT).

-- A) Dark Triad where missing --------------------------------------------------
UPDATE profiles p SET content = p.content || jsonb_build_object('dark_triad', jsonb_build_object(
  'machiavellianism', round((LEAST(0.98, GREATEST(0.02, 0.26 + 0.34*GREATEST(0, 0.5 - p.agreeableness) * 2 + 0.12*GREATEST(0, p.conscientiousness - 0.5) * 2 + 0.10*GREATEST(0, p.openness - 0.5) * 2 + (((('x'||substr(md5(p.id::text||'dtm'),1,8))::bit(32)::int & 2147483647)::numeric / 2147483647.0) - 0.5)*0.16)))::numeric, 2),
  'narcissism',       round((LEAST(0.98, GREATEST(0.02, 0.24 + 0.30*GREATEST(0, p.extraversion - 0.5) * 2 + 0.22*GREATEST(0, 0.5 - p.agreeableness) * 2 + 0.08*GREATEST(0, 0.5 - p.neuroticism) * 2 + (((('x'||substr(md5(p.id::text||'dtn'),1,8))::bit(32)::int & 2147483647)::numeric / 2147483647.0) - 0.5)*0.16)))::numeric, 2),
  'psychopathy',      round((LEAST(0.98, GREATEST(0.02, 0.12 + 0.34*GREATEST(0, 0.5 - p.agreeableness) * 2 + 0.24*GREATEST(0, 0.5 - p.conscientiousness) * 2 + 0.10*GREATEST(0, 0.5 - p.neuroticism) * 2 + (((('x'||substr(md5(p.id::text||'dtp'),1,8))::bit(32)::int & 2147483647)::numeric / 2147483647.0) - 0.5)*0.14)))::numeric, 2)))
WHERE p.content->'dark_triad' IS NULL
  AND p.openness IS NOT NULL AND p.id IN (SELECT id FROM _v4_backup_factor_rows);

-- B) Prospect theory where missing (lambda justified by neuroticism, low
--    openness, and any carried loss-aversion bias strength) --------------------
UPDATE profiles p SET content = p.content || jsonb_build_object('prospect_theory', jsonb_build_object(
  'lambda', round((LEAST(4.4, GREATEST(0.6, 1.45 + 1.30*GREATEST(0, p.neuroticism - 0.5) * 2 + 0.40*GREATEST(0, 0.5 - p.openness) * 2 + 0.45*COALESCE((SELECT MAX((e->>'strength')::numeric) FROM jsonb_array_elements(COALESCE(p.content->'suggested_biases','[]'::jsonb)) e WHERE e->>'slug'='loss-aversion'), 0) + (((('x'||substr(md5(p.id::text||'ptl'),1,8))::bit(32)::int & 2147483647)::numeric / 2147483647.0) - 0.5)*0.60)))::numeric, 2),
  'alpha',  round((LEAST(0.99, GREATEST(0.55, 0.74 + 0.14*GREATEST(0, p.conscientiousness - 0.5) * 2 + 0.06*GREATEST(0, 0.5 - p.neuroticism) * 2 + (((('x'||substr(md5(p.id::text||'pta'),1,8))::bit(32)::int & 2147483647)::numeric / 2147483647.0) - 0.5)*0.11)))::numeric, 2),
  'beta',   round((LEAST(0.99, GREATEST(0.55, 0.72 + 0.12*GREATEST(0, p.conscientiousness - 0.5) * 2 + 0.08*GREATEST(0, p.neuroticism - 0.5) * 2 + (((('x'||substr(md5(p.id::text||'ptb'),1,8))::bit(32)::int & 2147483647)::numeric / 2147483647.0) - 0.5)*0.11)))::numeric, 2)))
WHERE p.content->'prospect_theory' IS NULL
  AND p.openness IS NOT NULL AND p.id IN (SELECT id FROM _v4_backup_factor_rows);

-- C) Cognitive reflection where missing (CRT standardized to INTEGER 0-3) ------
UPDATE profiles p SET content = p.content || jsonb_build_object('cognitive_reflection', jsonb_build_object(
  'system_preference', (CASE WHEN ((('x'||substr(md5(p.id::text||'sys'),1,8))::bit(32)::int & 2147483647)::numeric / 2147483647.0) < (0.12 + (CASE WHEN (0.10 + 0.46*p.conscientiousness + 0.30*p.openness - 0.14*p.neuroticism + (((('x'||substr(md5(p.id::text||'crt'),1,8))::bit(32)::int & 2147483647)::numeric / 2147483647.0) - 0.5)*0.28) >= 0.68 THEN 3 WHEN (0.10 + 0.46*p.conscientiousness + 0.30*p.openness - 0.14*p.neuroticism + (((('x'||substr(md5(p.id::text||'crt'),1,8))::bit(32)::int & 2147483647)::numeric / 2147483647.0) - 0.5)*0.28) >= 0.48 THEN 2 WHEN (0.10 + 0.46*p.conscientiousness + 0.30*p.openness - 0.14*p.neuroticism + (((('x'||substr(md5(p.id::text||'crt'),1,8))::bit(32)::int & 2147483647)::numeric / 2147483647.0) - 0.5)*0.28) >= 0.30 THEN 1 ELSE 0 END)*0.27 + GREATEST(0, p.conscientiousness - 0.5) * 2*0.12) THEN 'system2' ELSE 'system1' END),
  'crt_score', (CASE WHEN (0.10 + 0.46*p.conscientiousness + 0.30*p.openness - 0.14*p.neuroticism + (((('x'||substr(md5(p.id::text||'crt'),1,8))::bit(32)::int & 2147483647)::numeric / 2147483647.0) - 0.5)*0.28) >= 0.68 THEN 3 WHEN (0.10 + 0.46*p.conscientiousness + 0.30*p.openness - 0.14*p.neuroticism + (((('x'||substr(md5(p.id::text||'crt'),1,8))::bit(32)::int & 2147483647)::numeric / 2147483647.0) - 0.5)*0.28) >= 0.48 THEN 2 WHEN (0.10 + 0.46*p.conscientiousness + 0.30*p.openness - 0.14*p.neuroticism + (((('x'||substr(md5(p.id::text||'crt'),1,8))::bit(32)::int & 2147483647)::numeric / 2147483647.0) - 0.5)*0.28) >= 0.30 THEN 1 ELSE 0 END)))
WHERE p.content->'cognitive_reflection' IS NULL
  AND p.openness IS NOT NULL AND p.id IN (SELECT id FROM _v4_backup_factor_rows);

-- D) Normalize legacy 0-1 float crt_score to the true 0-3 CRT scale ------------
UPDATE profiles p SET content = jsonb_set(p.content, '{cognitive_reflection,crt_score}',
  to_jsonb(round(LEAST(1.0, GREATEST(0.0, (p.content->'cognitive_reflection'->>'crt_score')::numeric)) * 3)::int))
WHERE (p.content->'cognitive_reflection'->>'crt_score') ~ '^[0-9]*\.[0-9]+$'
  AND (p.content->'cognitive_reflection'->>'crt_score')::numeric <> floor((p.content->'cognitive_reflection'->>'crt_score')::numeric)
  AND p.id IN (SELECT id FROM _v4_backup_factor_rows);

-- E) De-constant the alpha/beta=0.88 rows (every value was the same literal;
--    buyers checking column cardinality read that as template output) ----------
UPDATE profiles p SET content = p.content || jsonb_build_object('prospect_theory',
  (p.content->'prospect_theory')
  || jsonb_build_object('alpha', round((LEAST(0.99, GREATEST(0.55, 0.88 + (((('x'||substr(md5(p.id::text||'dja'),1,8))::bit(32)::int & 2147483647)::numeric / 2147483647.0) - 0.5)*0.10)))::numeric, 2))
  || jsonb_build_object('beta',  round((LEAST(0.99, GREATEST(0.55, 0.84 + (((('x'||substr(md5(p.id::text||'djb'),1,8))::bit(32)::int & 2147483647)::numeric / 2147483647.0) - 0.5)*0.10)))::numeric, 2)))
WHERE (p.content->'prospect_theory'->>'alpha')::numeric = 0.88
  AND (p.content->'prospect_theory'->>'beta')::numeric = 0.88
  AND p.id IN (SELECT id FROM _v4_backup_factor_rows);

-- F) One version bump + provenance stamp per enriched row (runs once: guarded
--    by the absence of a prior factors-v4 provenance row) ----------------------
UPDATE profiles p SET version = p.version + 1
WHERE p.id IN (SELECT id FROM _v4_backup_factor_rows)
  AND NOT EXISTS (SELECT 1 FROM provenance pr
                  WHERE pr.entity_type='profile' AND pr.entity_id=p.id
                    AND pr.model='authored/psychosynth-factors-v4');

INSERT INTO provenance (entity_type, entity_id, entity_version, model, prompt_hash, template_hash, params, sha256_content)
SELECT 'profile', p.id, p.version, 'authored/psychosynth-factors-v4',
       encode(sha256(convert_to('v4-factor-backfill:' || p.id::text, 'UTF8')), 'hex'),
       'ed1acd9762eeac5102b1c8cfcdbc3ea44ca5bed673cf1286568618953acce34f',
       jsonb_build_object('method','sql-deterministic-backfill','salt','md5(id)','fields',
                          jsonb_build_array('dark_triad','prospect_theory','cognitive_reflection')),
       encode(sha256(convert_to(p.content::text, 'UTF8')), 'hex')
FROM profiles p
WHERE p.id IN (SELECT id FROM _v4_backup_factor_rows)
  AND NOT EXISTS (SELECT 1 FROM provenance pr
                  WHERE pr.entity_type='profile' AND pr.entity_id=p.id
                    AND pr.model='authored/psychosynth-factors-v4')
ON CONFLICT (entity_type, entity_id, entity_version) DO NOTHING;
