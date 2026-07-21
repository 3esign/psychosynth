-- v4 generators + generation runs (+ emotional pattern upsert).
-- Honest provenance: model 'authored/psychosynth-synth-v4' = offline banks +
-- coherence logic + seeded PRNG. No LLM inference anywhere in this bundle.

INSERT INTO emotional_patterns (slug, name, description) VALUES
('panic_selling','Panic Selling','Intense fear leading to immediate liquidation of assets.'),
('fomo_buying','FOMO Buying','Anxiety of missing out prompting hasty purchases at peaks.'),
('paralysis','Analysis Paralysis','Overthinking leading to delayed or completely stalled action.'),
('aggressive_counter','Aggressive Counter-offer','Hostile or overly confident reciprocation during negotiations.'),
('stoic_freeze','Stoic Freeze','Outward calm masking a total internal shutdown under threat.'),
('righteous_anger','Righteous Anger','Moral certainty converting fear into confrontational energy.'),
('appeasement','Appeasement','Conflict-avoidant capitulation to restore social harmony quickly.'),
('defiant_doubling','Defiant Doubling-Down','Escalating commitment precisely when challenged or losing.'),
('dissociative_deferral','Dissociative Deferral','Emotionally checking out and postponing the decision entirely.'),
('anxious_spiral','Anxious Spiral','Rumination that amplifies a single setback into catastrophe.'),
('cold_calculation','Cold Calculation','Emotion suppressed in favor of detached expected-value logic.'),
('euphoric_overreach','Euphoric Overreach','Winning streak breeding reckless overconfidence and overexposure.'),
('guilt_absorption','Guilt Absorption','Taking on blame for structural failures to protect others.'),
('vindication_seeking','Vindication Seeking','Acting to prove a point rather than to optimize the outcome.'),
('relief_capitulation','Relief Capitulation','Folding at the first exit that ends the discomfort, regardless of value.'),
('performative_calm','Performative Calm','Projecting composure for an audience while privately rattled.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO generators (slug, version, entity_type, description, prompt_template, params_schema, output_schema, model_config, hooks, status)
VALUES
('psychosynth-synth-v4', 1, 'profile',
 'Offline authored synthesis engine v4: widened component banks, coherent Dark Triad / prospect-theory / CRT factor derivation, archetype-anchored personas, seeded PRNG. Zero inference; reproducible by seed.',
 'authored', '{"type":"object","properties":{"seed":{"type":"string"}}}'::jsonb, '{}'::jsonb,
 '{"provider":"procedural","model":"authored/psychosynth-synth-v4"}'::jsonb,
 '[{"type":"schema_validate"},{"type":"dedup","config":{"threshold":0.5}},{"type":"provenance_stamp"}]'::jsonb, 'active'),
('psychosynth-synth-v4-responses', 1, 'profile_scenario_response',
 'Offline authored response engine v4: trait- and factor-conditioned action/reasoning/arc composition (posture uses lambda + CRT + dark triad). Zero inference; reproducible by seed.',
 'authored', '{"type":"object","properties":{"seed":{"type":"string"}}}'::jsonb, '{}'::jsonb,
 '{"provider":"procedural","model":"authored/psychosynth-synth-v4"}'::jsonb,
 '[{"type":"schema_validate"},{"type":"provenance_stamp"}]'::jsonb, 'active')
ON CONFLICT (slug, version) DO NOTHING;

INSERT INTO generation_runs (id, generator_id, generator_slug, generator_ver, params, model_used, items_requested, items_created, items_auto_approved, status, finished_at) VALUES
('d6910179-eaaf-4ea3-beca-7ac0dbb162aa', (SELECT id FROM generators WHERE slug='psychosynth-synth-v4' AND version=1 LIMIT 1),
 'psychosynth-synth-v4', 1, '{"seed":"v4-2026-07-21","kind":"general-population","domains":["general","trading","negotiation","social","workplace"]}'::jsonb,
 'authored/psychosynth-synth-v4', 2000, 2000, 2000, 'done', now()),
('7b28a7a7-b092-4628-bfa5-6a8a71bd3628', (SELECT id FROM generators WHERE slug='psychosynth-synth-v4' AND version=1 LIMIT 1),
 'psychosynth-synth-v4', 1, '{"seed":"v4-2026-07-21","kind":"personas","archetypes":48}'::jsonb,
 'authored/psychosynth-synth-v4', 1904, 1904, 1904, 'done', now()),
('8355e790-813c-41e6-95e5-a968fc989152', (SELECT id FROM generators WHERE slug='psychosynth-synth-v4-responses' AND version=1 LIMIT 1),
 'psychosynth-synth-v4-responses', 1, '{"seed":"v4-2026-07-21","kind":"responses"}'::jsonb,
 'authored/psychosynth-synth-v4', 9318, 9318, 9318, 'done', now())
ON CONFLICT (id) DO NOTHING;
