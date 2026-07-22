-- enrich-a2a-commerce batch — engine + run (idempotent).
INSERT INTO generators (id, slug, version, entity_type, description, prompt_template, params_schema, output_schema, model_config, hooks, status)
VALUES ('df9243cf-3dac-44a8-8cea-0f1f266fe43a', 'psychosynth-synth-v4', 4, 'profile', 'Offline authored synthesis v4 (enrichment).', 'authored:offline-synthesis-engine', '{}'::jsonb, '{}'::jsonb, '{"provider":"authored","model":"psychosynth-synth-v2","seed_strategy":"deterministic"}'::jsonb, '[{"type":"schema_validate"},{"type":"dedup"},{"type":"provenance_stamp"}]'::jsonb, 'active')
ON CONFLICT (slug, version) DO NOTHING;
INSERT INTO generation_runs (id, generator_id, generator_slug, generator_ver, params, model_used, items_requested, items_created, items_auto_approved, status, finished_at)
VALUES ('4556417e-ac86-4549-833b-d3a75bd358ee', (SELECT id FROM generators WHERE slug='psychosynth-synth-v4' AND version=4), 'psychosynth-synth-v4', 4, '{"seed":"a2a-commerce-v1","batch":"enrich-a2a-commerce","profiles":1000}'::jsonb, 'authored/psychosynth-synth-v2', 4000, 4000, 4000, 'done', now())
ON CONFLICT (id) DO NOTHING;
