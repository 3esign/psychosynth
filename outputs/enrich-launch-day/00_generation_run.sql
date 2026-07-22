-- enrich-launch-day batch — engine + run (idempotent).
INSERT INTO generators (id, slug, version, entity_type, description, prompt_template, params_schema, output_schema, model_config, hooks, status)
VALUES ('72d80010-523c-43e7-90db-6c71c2f6939d', 'psychosynth-synth-v4', 4, 'profile', 'Offline authored synthesis v4 (enrichment).', 'authored:offline-synthesis-engine', '{}'::jsonb, '{}'::jsonb, '{"provider":"authored","model":"psychosynth-synth-v2","seed_strategy":"deterministic"}'::jsonb, '[{"type":"schema_validate"},{"type":"dedup"},{"type":"provenance_stamp"}]'::jsonb, 'active')
ON CONFLICT (slug, version) DO NOTHING;
INSERT INTO generation_runs (id, generator_id, generator_slug, generator_ver, params, model_used, items_requested, items_created, items_auto_approved, status, finished_at)
VALUES ('c09637e6-6320-47d7-8d8f-6c374ac2b3fb', (SELECT id FROM generators WHERE slug='psychosynth-synth-v4' AND version=4), 'psychosynth-synth-v4', 4, '{"seed":"launch-day-v1","batch":"enrich-launch-day","profiles":1000}'::jsonb, 'authored/psychosynth-synth-v2', 4000, 4000, 4000, 'done', now())
ON CONFLICT (id) DO NOTHING;
