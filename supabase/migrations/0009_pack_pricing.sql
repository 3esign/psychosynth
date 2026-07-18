-- Pack pricing: bulk "many rows in one paid call" tiers.
--
-- x402 observed behavior (and MASTERPLAN) says buyers skew toward fewer,
-- larger payments. A pack is a single paid call at a flat price that returns
-- up to `max_rows` records — cheaper per row than tapping the base per-query
-- price. No new tables and no credit tracking: the buyer signals intent with
-- ?tier=<slug>, the proxy quotes/verifies that tier's amount, and the query
-- route raises the row cap to the pack size for that one request.
--
-- Base per-query prices are unchanged. Packs are added only to the volume
-- products; the Cognitive Bias Simulator is a fixed 20-item taxonomy, so a
-- bulk pack there would be meaningless and is intentionally omitted.

-- Behavioral Response Library: base $0.03/query -> $49 for up to 5,000 records
-- (~$0.0098/row, roughly a 3x per-row discount).
UPDATE products
SET price_model = '{"type": "flat", "amount_usdc": 0.03, "packs": [{"slug": "pack-5k", "amount_usdc": 49, "max_rows": 5000, "label": "5,000-record bulk"}]}'
WHERE slug = 'behavioral-response-library';

-- Personality Profile Library: base $0.01/query -> $19 for up to 5,000 records.
UPDATE products
SET price_model = '{"type": "flat", "amount_usdc": 0.01, "packs": [{"slug": "pack-5k", "amount_usdc": 19, "max_rows": 5000, "label": "5,000-record bulk"}]}'
WHERE slug = 'personality-profile-library';
