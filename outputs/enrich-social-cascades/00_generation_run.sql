-- enrich-social-cascades batch — engine + run (idempotent).
INSERT INTO generators (id, slug, version, entity_type, description, prompt_template, params_schema, output_schema, model_config, hooks, status)
VALUES ('f0373399-a44e-4a72-980e-2cb592a074c2', 'psychosynth-synth-v4', 4, 'profile', 'Offline authored synthesis v4 (enrichment).', 'authored:offline-synthesis-engine', '{}'::jsonb, '{}'::jsonb, '{"provider":"authored","model":"psychosynth-synth-v2","seed_strategy":"deterministic"}'::jsonb, '[{"type":"schema_validate"},{"type":"dedup"},{"type":"provenance_stamp"}]'::jsonb, 'active')
ON CONFLICT (slug, version) DO NOTHING;
INSERT INTO generation_runs (id, generator_id, generator_slug, generator_ver, params, model_used, items_requested, items_created, items_auto_approved, status, finished_at)
VALUES ('efad67da-ca57-4cd6-9238-63b66cd758bc', (SELECT id FROM generators WHERE slug='psychosynth-synth-v4' AND version=4), 'psychosynth-synth-v4', 4, '{"seed":"social-cascades-v1","batch":"enrich-social-cascades","profiles":1000}'::jsonb, 'authored/psychosynth-synth-v2', 4000, 4000, 4000, 'done', now())
ON CONFLICT (id) DO NOTHING;
