-- Catalog polish.
--
-- 1) Fix the Solana Trading Psychology Pack recipe: it still carries the
--    legacy filters ARRAY format from 0012, which the resolver ignores
--    (DB_AUDIT finding C3) — so the pack serves the whole approved library
--    instead of the chain:solana slice, and buyers cannot filter at all
--    (allow_request_filters was never set). Normalize to the enforced
--    tags_include shape + open the full filter surface.
UPDATE recipes
SET query_rules = query_rules
  || jsonb_build_object('filters', jsonb_build_object('status','approved','tags_include', jsonb_build_array('chain:solana')))
  || jsonb_build_object('allow_request_filters', '["tags","decision_style","mbti_label","big_five_min","big_five_max","machiavellianism_min","machiavellianism_max","narcissism_min","narcissism_max","psychopathy_min","psychopathy_max","lambda_min","lambda_max","alpha_min","alpha_max","beta_min","beta_max","system_preference","crt_score_min","crt_score_max"]'::jsonb)
WHERE id = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'
  AND (query_rules->'filters'->>'tags_include') IS NULL;

-- 2) Robinhood Counterparty Pack: open the same full factor filter surface
--    (it advertised prospect-theory posture but only allowed lambda).
UPDATE recipes
SET query_rules = query_rules
  || jsonb_build_object('allow_request_filters', '["tags","decision_style","mbti_label","big_five_min","big_five_max","machiavellianism_min","machiavellianism_max","narcissism_min","narcissism_max","psychopathy_min","psychopathy_max","lambda_min","lambda_max","alpha_min","alpha_max","beta_min","beta_max","system_preference","crt_score_min","crt_score_max"]'::jsonb)
WHERE id = 'b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e';
