-- Psychosynth v4 enrichment — generation run + engine identity (idempotent).
INSERT INTO generators (id, slug, version, entity_type, description, prompt_template, params_schema, output_schema, model_config, hooks, status)
VALUES ('907c9f84-62a6-4d19-b309-9b6718223506', 'psychosynth-synth-v4', 4, 'profile',
  'Offline authored synthesis v4 (enrichment). No LLM: component banks + coherence logic + seeded PRNG. See scripts/lib/{synth,behavior,psychometrics,archetypes}.js',
  'authored:offline-synthesis-engine', '{}'::jsonb, '{}'::jsonb,
  '{"provider":"authored","model":"psychosynth-synth-v2","seed_strategy":"deterministic"}'::jsonb,
  '[{"type":"schema_validate"},{"type":"dedup"},{"type":"provenance_stamp"}]'::jsonb, 'active')
ON CONFLICT (slug, version) DO NOTHING;

INSERT INTO generation_runs (id, generator_id, generator_slug, generator_ver, params, model_used, items_requested, items_created, items_auto_approved, status, finished_at)
VALUES ('118451c6-3b08-40ab-9021-85d658dc463b',
  (SELECT id FROM generators WHERE slug='psychosynth-synth-v4' AND version=4),
  'psychosynth-synth-v4', 4,
  '{"seed":"psychosynth-v4-2026-07-21","mix":{"retail":0.3,"solana":0.2,"base":0.125,"whale":0.125,"agent":0.075,"general":0.175},"profiles":4000,"responses":4000,"scenarios":80}'::jsonb,
  'authored/psychosynth-synth-v2', 8000, 8000, 8000, 'done', now())
ON CONFLICT (id) DO NOTHING;
