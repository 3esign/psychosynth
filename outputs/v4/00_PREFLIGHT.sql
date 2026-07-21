-- v4 PREFLIGHT — run this FIRST, read the output, then apply 01..09 in order.
-- Creates pre-state backup tables (used by the repairs, provenance stamping,
-- and 99_ROLLBACK.sql) and prints the "before" picture. Idempotent: backups
-- are only captured the first time (IF NOT EXISTS).

-- Pre-state backups -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS _v4_backup_profiles_v3 AS
  SELECT p.* FROM profiles p
  WHERE p.generation_run_id IN
    (SELECT id FROM generation_runs WHERE generator_slug = 'psychosynth-v3-trader-behavior');

CREATE TABLE IF NOT EXISTS _v4_backup_responses_v3 AS
  SELECT r.* FROM profile_scenario_responses r
  WHERE r.generation_run_id IN
    (SELECT id FROM generation_runs WHERE generator_slug = 'psychosynth-v3-trader-behavior');

CREATE TABLE IF NOT EXISTS _v4_backup_factor_rows AS
  SELECT p.id, p.version, p.content FROM profiles p
  WHERE p.content->'dark_triad' IS NULL
     OR p.content->'prospect_theory' IS NULL
     OR p.content->'cognitive_reflection' IS NULL
     OR ((p.content->'cognitive_reflection'->>'crt_score') ~ '^[0-9]*\.[0-9]+$'
         AND (p.content->'cognitive_reflection'->>'crt_score')::numeric
             <> floor((p.content->'cognitive_reflection'->>'crt_score')::numeric))
     OR ((p.content->'prospect_theory'->>'alpha')::numeric = 0.88
         AND (p.content->'prospect_theory'->>'beta')::numeric = 0.88);

-- Keep RLS posture consistent with 0016: backups hold sellable content.
ALTER TABLE _v4_backup_profiles_v3  ENABLE ROW LEVEL SECURITY;
ALTER TABLE _v4_backup_responses_v3 ENABLE ROW LEVEL SECURITY;
ALTER TABLE _v4_backup_factor_rows  ENABLE ROW LEVEL SECURITY;

-- Before picture --------------------------------------------------------------
SELECT 'profiles total' AS metric, count(*)::text AS value FROM profiles
UNION ALL SELECT 'profiles approved', count(*)::text FROM profiles WHERE status='approved'
UNION ALL SELECT 'profiles missing dark_triad', count(*)::text FROM profiles WHERE content->'dark_triad' IS NULL
UNION ALL SELECT 'profiles missing prospect_theory', count(*)::text FROM profiles WHERE content->'prospect_theory' IS NULL
UNION ALL SELECT 'profiles missing cognitive_reflection', count(*)::text FROM profiles WHERE content->'cognitive_reflection' IS NULL
UNION ALL SELECT 'profiles with fractional crt_score (0-1 scale)', count(*)::text FROM profiles
  WHERE (content->'cognitive_reflection'->>'crt_score') ~ '^[0-9]*\.[0-9]+$'
    AND (content->'cognitive_reflection'->>'crt_score')::numeric <> floor((content->'cognitive_reflection'->>'crt_score')::numeric)
UNION ALL SELECT 'profiles with constant alpha/beta=0.88', count(*)::text FROM profiles
  WHERE (content->'prospect_theory'->>'alpha')::numeric = 0.88 AND (content->'prospect_theory'->>'beta')::numeric = 0.88
UNION ALL SELECT 'profiles with batch-* tag junk', count(*)::text FROM profiles
  WHERE EXISTS (SELECT 1 FROM unnest(tags) t WHERE t LIKE 'batch-%')
UNION ALL SELECT 'v3 template profiles (to repair)', count(*)::text FROM profiles
  WHERE generation_run_id IN (SELECT id FROM generation_runs WHERE generator_slug='psychosynth-v3-trader-behavior')
UNION ALL SELECT 'v3 template responses (to repair)', count(*)::text FROM profile_scenario_responses
  WHERE generation_run_id IN (SELECT id FROM generation_runs WHERE generator_slug='psychosynth-v3-trader-behavior')
UNION ALL SELECT 'responses missing emotional_arc', count(*)::text FROM profile_scenario_responses WHERE emotional_arc IS NULL
UNION ALL SELECT 'summaries containing LaTeX lambda', count(*)::text FROM profiles WHERE summary LIKE '%\lambda%'
UNION ALL SELECT 'scenarios total', count(*)::text FROM scenarios
UNION ALL SELECT 'responses total', count(*)::text FROM profile_scenario_responses
UNION ALL SELECT 'biases total', count(*)::text FROM biases;
