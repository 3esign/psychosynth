-- v4 VERIFY — run after applying 01..09. Every check lists its expectation.

-- 1) Factor coverage should be 100% (was the backfill's whole point).
SELECT 'profiles missing any factor (expect 0)' AS check, count(*)::text AS value FROM profiles
WHERE content->'dark_triad' IS NULL OR content->'prospect_theory' IS NULL OR content->'cognitive_reflection' IS NULL
UNION ALL
-- 2) CRT scale should be uniformly integer 0-3 (expect 0 fractional).
SELECT 'fractional crt_score remaining (expect 0)', count(*)::text FROM profiles
WHERE (content->'cognitive_reflection'->>'crt_score') ~ '^[0-9]*\.[0-9]+$'
  AND (content->'cognitive_reflection'->>'crt_score')::numeric <> floor((content->'cognitive_reflection'->>'crt_score')::numeric)
UNION ALL
-- 3) Batch-tag junk gone (expect 0).
SELECT 'batch-* tags remaining (expect 0)', count(*)::text FROM profiles
WHERE EXISTS (SELECT 1 FROM unnest(tags) t WHERE t LIKE 'batch-%')
UNION ALL
-- 4) LaTeX artifacts gone from v3 summaries (expect 0).
SELECT 'summaries with LaTeX lambda (expect 0)', count(*)::text FROM profiles WHERE summary LIKE '%\lambda%'
UNION ALL
-- 5) v3 template responses rewritten (expect 0).
SELECT 'template responses remaining (expect 0)', count(*)::text FROM profile_scenario_responses
WHERE reasoning_chain LIKE '%loss aversion coefficient%' OR response ~ '^(BUY|ADD|HOLD|TRIM|SELL|CUT) — '
UNION ALL
SELECT 'responses missing emotional_arc (expect 0)', count(*)::text FROM profile_scenario_responses WHERE emotional_arc IS NULL
UNION ALL
-- 6) Fresh volume landed.
SELECT 'v4 fresh profiles (expect 3904)', count(*)::text FROM profiles
WHERE generation_run_id IN ('d6910179-eaaf-4ea3-beca-7ac0dbb162aa','7b28a7a7-b092-4628-bfa5-6a8a71bd3628')
UNION ALL
SELECT 'v4 fresh responses (expect 9318)', count(*)::text FROM profile_scenario_responses
WHERE generation_run_id = '8355e790-813c-41e6-95e5-a968fc989152'
UNION ALL
SELECT 'v4 fresh scenarios (expect 64)', count(*)::text FROM scenarios WHERE slug LIKE 'v4-%'
UNION ALL
-- 7) Themed pack slices now well-populated.
SELECT 'robinhood pack slice (robinhood+retail-trading)', count(*)::text FROM profiles
WHERE status='approved' AND tags && ARRAY['robinhood','retail-trading']
UNION ALL
SELECT 'solana pack slice (chain:solana)', count(*)::text FROM profiles
WHERE status='approved' AND tags && ARRAY['chain:solana']
UNION ALL
-- 8) Provenance is stamped for everything v4 touched.
SELECT 'provenance rows model like psychosynth%v4%', count(*)::text FROM provenance
WHERE model LIKE 'authored/psychosynth%v4%';

-- 9) Near-duplicate audit on the new batch (pg_trgm; sample-based).
--    Values near 1.0 mean template rot; expect the max under 0.55 (the dedup
--    hook's own threshold).
SELECT max(similarity(a.summary, b.summary)) AS fresh_max_similarity_sample
FROM (SELECT id, summary FROM profiles WHERE generation_run_id IN ('d6910179-eaaf-4ea3-beca-7ac0dbb162aa','7b28a7a7-b092-4628-bfa5-6a8a71bd3628') ORDER BY md5(id::text) LIMIT 220) a
JOIN (SELECT id, summary FROM profiles WHERE generation_run_id IN ('d6910179-eaaf-4ea3-beca-7ac0dbb162aa','7b28a7a7-b092-4628-bfa5-6a8a71bd3628') ORDER BY md5(id::text) LIMIT 220) b
  ON a.id < b.id;

-- 9b) Same audit for the REPAIRED v3 rows: exact dupes must be 0; near-dup
--     max will sit higher than the fresh batch (shared archetype vocabulary)
--     but the numeric posture suffix keeps rows distinct — expect < 0.9 and
--     zero identical summaries.
SELECT count(*) AS repaired_exact_dupes
FROM (SELECT summary, count(*) FROM profiles
      WHERE id IN (SELECT id FROM _v4_backup_profiles_v3)
      GROUP BY summary HAVING count(*) > 1) d;
SELECT max(similarity(a.summary, b.summary)) AS repaired_max_similarity_sample
FROM (SELECT id, summary FROM profiles WHERE id IN (SELECT id FROM _v4_backup_profiles_v3) ORDER BY md5(id::text) LIMIT 200) a
JOIN (SELECT id, summary FROM profiles WHERE id IN (SELECT id FROM _v4_backup_profiles_v3) ORDER BY md5(id::text) LIMIT 200) b
  ON a.id < b.id;

-- 10) Distribution sanity for the fresh generals: means near 0.5.
SELECT round(avg(openness),3) AS o, round(avg(conscientiousness),3) AS c, round(avg(extraversion),3) AS e,
       round(avg(agreeableness),3) AS a, round(avg(neuroticism),3) AS n,
       round(avg((content->'prospect_theory'->>'lambda')::numeric),2) AS avg_lambda,
       round(avg((content->'cognitive_reflection'->>'crt_score')::numeric),2) AS avg_crt
FROM profiles WHERE generation_run_id = 'd6910179-eaaf-4ea3-beca-7ac0dbb162aa';
