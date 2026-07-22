-- v3 REPAIR (rewrite-in-place): remove the batch-tag-polluted profiles from
-- populate-v3-dataset.ts (near-identical summaries, unconditioned BUY/SELL
-- responses, batch-* tag pollution). Their scenario responses + bias links are
-- removed by ON DELETE CASCADE; their provenance rows are cleared explicitly.
-- Only rows carrying a 'batch-*' tag are touched — the good v3 seed personas
-- (0015/0017) and this v4 batch have no such tag and are untouched.
BEGIN;

-- provenance for the polluted profiles' responses
DELETE FROM provenance
 WHERE entity_type = 'profile_scenario_response'
   AND entity_id IN (
     SELECT r.id FROM profile_scenario_responses r
     JOIN profiles p ON p.id = r.profile_id
     WHERE EXISTS (SELECT 1 FROM unnest(p.tags) t WHERE t LIKE 'batch-%')
   );

-- provenance for the polluted profiles themselves
DELETE FROM provenance
 WHERE entity_type = 'profile'
   AND entity_id IN (
     SELECT id FROM profiles WHERE EXISTS (SELECT 1 FROM unnest(tags) t WHERE t LIKE 'batch-%')
   );

-- the polluted profiles (cascades to profile_scenario_responses + profile_bias_links)
DELETE FROM profiles WHERE EXISTS (SELECT 1 FROM unnest(tags) t WHERE t LIKE 'batch-%');

COMMIT;
