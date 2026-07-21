-- Fix: the Robinhood Counterparty Pack was serving ~110 generic trading-domain
-- profiles instead of the ~30 curated retail personas.
--
-- Cause: the recipe's tags_include contained the broad tag "trading", and the
-- resolver matches with `overlaps` (ANY tag), so every pre-existing profile
-- tagged "trading" leaked into the pack. All 30 curated personas carry BOTH
-- "robinhood" AND "retail-trading"; the generic profiles carry neither. So
-- narrowing the filter to those two tags scopes the pack to exactly the
-- curated set without dropping any of them.
--
-- Also bump the pack's free preview from 5% to 20% so a browser sees ~6 of the
-- 30 personas instead of ~1 (better marketing, still a sample).

UPDATE recipes
SET query_rules = jsonb_set(
      query_rules,
      '{filters,tags_include}',
      '["robinhood","retail-trading"]'::jsonb
    )
WHERE id = 'b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e';

UPDATE products
SET preview_pct = 0.20
WHERE slug = 'robinhood-counterparty-pack';
