-- v4 ROLLBACK — undoes this bundle. Order matters. Safe to run partially.

-- 1) Remove fresh v4 rows (responses first for FK order).
DELETE FROM profile_scenario_responses WHERE generation_run_id = '8355e790-813c-41e6-95e5-a968fc989152';
DELETE FROM provenance WHERE model = 'authored/psychosynth-synth-v4';
DELETE FROM profile_bias_links WHERE generation_run_id IN ('d6910179-eaaf-4ea3-beca-7ac0dbb162aa','7b28a7a7-b092-4628-bfa5-6a8a71bd3628');
DELETE FROM profiles WHERE generation_run_id IN ('d6910179-eaaf-4ea3-beca-7ac0dbb162aa','7b28a7a7-b092-4628-bfa5-6a8a71bd3628');
DELETE FROM scenario_bias_applications WHERE scenario_id IN (SELECT id FROM scenarios WHERE slug LIKE 'v4-%');
DELETE FROM scenarios WHERE slug LIKE 'v4-%'
  AND NOT EXISTS (SELECT 1 FROM profile_scenario_responses r WHERE r.scenario_id = scenarios.id);
DELETE FROM generation_runs WHERE id IN ('d6910179-eaaf-4ea3-beca-7ac0dbb162aa','7b28a7a7-b092-4628-bfa5-6a8a71bd3628','8355e790-813c-41e6-95e5-a968fc989152');

-- 2) Restore repaired v3 profiles + responses from the preflight backups.
UPDATE profiles p SET
  version = b.version, content = b.content, summary = b.summary, tags = b.tags,
  quality_score = b.quality_score
FROM _v4_backup_profiles_v3 b WHERE b.id = p.id;

UPDATE profile_scenario_responses r SET
  response = b.response, reasoning_chain = b.reasoning_chain,
  emotional_arc = b.emotional_arc, confidence = b.confidence
FROM _v4_backup_responses_v3 b WHERE b.id = r.id;

-- 3) Restore factor-backfilled rows to their pre-enrichment content.
UPDATE profiles p SET version = b.version, content = b.content
FROM _v4_backup_factor_rows b WHERE b.id = p.id;

DELETE FROM provenance WHERE model IN ('authored/psychosynth-factors-v4','authored/psychosynth-synth-v4-repair');

-- 4) (Optional) drop the backups once you are certain.
-- DROP TABLE IF EXISTS _v4_backup_profiles_v3, _v4_backup_responses_v3, _v4_backup_factor_rows;
