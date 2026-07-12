CREATE TABLE generators (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL,
  version         INT NOT NULL DEFAULT 1,
  entity_type     TEXT NOT NULL,
  description     TEXT,
  prompt_template TEXT NOT NULL,
  params_schema   JSONB NOT NULL,
  output_schema   JSONB NOT NULL,
  model_config    JSONB NOT NULL,
  hooks           JSONB NOT NULL DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','active','deprecated')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (slug, version)
);

CREATE TABLE generation_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generator_id    UUID NOT NULL REFERENCES generators(id),
  generator_slug  TEXT NOT NULL,
  generator_ver   INT NOT NULL,
  params          JSONB NOT NULL,
  model_used      TEXT NOT NULL,
  items_requested INT NOT NULL,
  items_created   INT NOT NULL DEFAULT 0,
  items_auto_approved INT NOT NULL DEFAULT 0,
  items_rejected_by_hooks INT NOT NULL DEFAULT 0,
  cost_usd        NUMERIC(10,4) DEFAULT 0,
  hook_summary    JSONB NOT NULL DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'running'
                  CHECK (status IN ('running','done','failed')),
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at     TIMESTAMPTZ
);

ALTER TABLE profiles ADD CONSTRAINT fk_profiles_run
  FOREIGN KEY (generation_run_id) REFERENCES generation_runs(id);

CREATE TABLE datasets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL,
  version     INT NOT NULL DEFAULT 1,
  entity_type TEXT NOT NULL,
  description TEXT,
  sha256_hash CHAR(64),
  frozen_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (slug, version)
);

CREATE TABLE dataset_items (
  dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE,
  entity_id  UUID NOT NULL,
  position   INT NOT NULL,
  PRIMARY KEY (dataset_id, entity_id)
);
