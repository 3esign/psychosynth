CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE biases (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL,
  source       TEXT,
  examples     JSONB NOT NULL DEFAULT '[]',
  mitigations  JSONB NOT NULL DEFAULT '[]',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE decision_styles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT
);

CREATE TABLE rejection_reasons (
  code        TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  description TEXT NOT NULL,
  entity_type TEXT
);

CREATE TABLE profiles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version           INT NOT NULL DEFAULT 1,
  content           JSONB NOT NULL,
  big_five          JSONB NOT NULL,
  mbti_label        VARCHAR(4),
  decision_style    TEXT,
  tags              TEXT[] NOT NULL DEFAULT '{}',
  summary           TEXT,
  quality_score     NUMERIC(3,2) CHECK (quality_score BETWEEN 0 AND 1),
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected','archived')),
  generation_run_id UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  openness          NUMERIC GENERATED ALWAYS AS ((big_five->>'openness')::numeric) STORED,
  conscientiousness NUMERIC GENERATED ALWAYS AS ((big_five->>'conscientiousness')::numeric) STORED,
  extraversion      NUMERIC GENERATED ALWAYS AS ((big_five->>'extraversion')::numeric) STORED,
  agreeableness     NUMERIC GENERATED ALWAYS AS ((big_five->>'agreeableness')::numeric) STORED,
  neuroticism       NUMERIC GENERATED ALWAYS AS ((big_five->>'neuroticism')::numeric) STORED
);

CREATE INDEX idx_profiles_status ON profiles(status);
CREATE INDEX idx_profiles_traits ON profiles(openness, conscientiousness, extraversion, agreeableness, neuroticism);
CREATE INDEX idx_profiles_tags ON profiles USING gin(tags);
CREATE INDEX idx_profiles_bigfive ON profiles USING gin(big_five);
CREATE INDEX idx_profiles_summary_trgm ON profiles USING gin(summary gin_trgm_ops);

CREATE TABLE profile_bias_links (
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  bias_id    UUID REFERENCES biases(id) ON DELETE CASCADE,
  strength   NUMERIC(3,2) CHECK (strength BETWEEN 0 AND 1),
  context_notes TEXT,
  generation_run_id UUID,
  PRIMARY KEY (profile_id, bias_id)
);

CREATE TABLE provenance (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type    TEXT NOT NULL,
  entity_id      UUID NOT NULL,
  entity_version INT NOT NULL DEFAULT 1,
  model          TEXT NOT NULL,
  prompt_hash    CHAR(64) NOT NULL,
  template_hash  CHAR(64) NOT NULL,
  params         JSONB NOT NULL DEFAULT '{}',
  sha256_content CHAR(64) NOT NULL,
  signature      TEXT,
  attestations   JSONB NOT NULL DEFAULT '[]',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, entity_version)
);
CREATE INDEX idx_provenance_entity ON provenance(entity_type, entity_id);
