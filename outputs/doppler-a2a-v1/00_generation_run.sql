-- doppler-a2a supplemental batch — engine + run (idempotent).
INSERT INTO generators (id, slug, version, entity_type, description, prompt_template, params_schema, output_schema, model_config, hooks, status)
VALUES ('3e11ed6d-b124-4405-8d06-8e28c6f086d0', 'psychosynth-synth-v4', 4, 'profile', 'Offline authored synthesis v4 (enrichment).', 'authored:offline-synthesis-engine', '{}'::jsonb, '{}'::jsonb, '{"provider":"authored","model":"psychosynth-synth-v2","seed_strategy":"deterministic"}'::jsonb, '[{"type":"schema_validate"},{"type":"dedup"},{"type":"provenance_stamp"}]'::jsonb, 'active')
ON CONFLICT (slug, version) DO NOTHING;
INSERT INTO generation_runs (id, generator_id, generator_slug, generator_ver, params, model_used, items_requested, items_created, items_auto_approved, status, finished_at)
VALUES ('23f52993-d83a-4722-a8af-d91ec112c7a4', (SELECT id FROM generators WHERE slug='psychosynth-synth-v4' AND version=4), 'psychosynth-synth-v4', 4, '{"seed":"doppler-a2a-v1","batch":"doppler-a2a","doppler":900,"agent":400}'::jsonb, 'authored/psychosynth-synth-v2', 3580, 3580, 3580, 'done', now())
ON CONFLICT (id) DO NOTHING;
