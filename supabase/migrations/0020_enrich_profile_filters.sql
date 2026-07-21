-- 0020_enrich_profile_filters.sql
-- NOTE: there is no migration 0019 — the number was skipped; the sequence
-- intentionally jumps 0018 -> 0020. Nothing is missing.
-- Unlock the full filterable surface on the Personality Profile Library.
--
-- The resolver (src/modules/recipes/resolver.ts) already implements Dark Triad,
-- prospect-theory and cognitive-reflection filters — they were simply absent
-- from this product's allowlist, so buyers (and the new public /explore browser)
-- could only slice by Big Five / tags / decision_style / mbti. This adds the rest
-- so the product's advertised Dark Triad / prospect-theory surface is actually
-- queryable. Big Five etc. are retained (they're in the new list), so this is
-- purely additive. Idempotent: jsonb `||` overrides the single key in place.
UPDATE recipes
SET query_rules = query_rules || jsonb_build_object(
  'allow_request_filters',
  '[
    "tags","decision_style","mbti_label",
    "big_five_min","big_five_max",
    "machiavellianism_min","machiavellianism_max",
    "narcissism_min","narcissism_max",
    "psychopathy_min","psychopathy_max",
    "lambda_min","lambda_max","alpha_min","alpha_max","beta_min","beta_max",
    "system_preference","crt_score_min","crt_score_max"
  ]'::jsonb
)
WHERE id = (SELECT recipe_id FROM products WHERE slug = 'personality-profile-library');
