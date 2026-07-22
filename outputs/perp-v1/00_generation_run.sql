-- Psychosynth v4 enrichment — generation run + engine identity (idempotent).
INSERT INTO generators (id, slug, version, entity_type, description, prompt_template, params_schema, output_schema, model_config, hooks, status)
VALUES ('4280f86c-4b95-441f-949e-94028ebfc308', 'psychosynth-synth-v4', 4, 'profile',
  'Offline authored synthesis v4 (enrichment). No LLM: component banks + coherence logic + seeded PRNG. See scripts/lib/{synth,behavior,psychometrics,archetypes}.js',
  'authored:offline-synthesis-engine', '{}'::jsonb, '{}'::jsonb,
  '{"provider":"authored","model":"psychosynth-synth-v2","seed_strategy":"deterministic"}'::jsonb,
  '[{"type":"schema_validate"},{"type":"dedup"},{"type":"provenance_stamp"}]'::jsonb, 'active')
ON CONFLICT (slug, version) DO NOTHING;

INSERT INTO generation_runs (id, generator_id, generator_slug, generator_ver, params, model_used, items_requested, items_created, items_auto_approved, status, finished_at)
VALUES ('092841db-d88c-438b-ab16-502e8e44c63c',
  (SELECT id FROM generators WHERE slug='psychosynth-synth-v4' AND version=4),
  'psychosynth-synth-v4', 4,
  '{"seed":"perp-v1","mix":{"retail":0.2,"solana":0.15,"base":0.125,"whale":0.1,"agent":0.075,"perp":0.2,"general":0.15},"profiles":1500,"responses":1500,"scenarios":80}'::jsonb,
  'authored/psychosynth-synth-v2', 3000, 3000, 3000, 'done', now())
ON CONFLICT (id) DO NOTHING;
