-- Product #3: Behavioral Response Library
--
-- Third sellable product, built entirely on Phase 2 data that already exists
-- (scenarios + profile_scenario_responses). No new tables, no new route: the
-- resolver gains a `scenario_response` case and this migration adds the
-- recipe + product rows that make it discoverable and payable.
--
-- Positioning (deliberately "boring and verifiable", NOT "AI-generated"):
-- procedurally authored from IPIP-NEO-grounded trait distributions,
-- reproducible by seed, provenance-stamped per record, and sold with a free
-- deterministic preview so buyers can verify shape and quality before paying.
-- The niche is volume + statistical realism for conditioning / stress-testing
-- / classifier training — not novel reasoning chains.

INSERT INTO recipes (query_rules, composition_rules) VALUES
('{"entity": "scenario_response", "filters": {}, "allow_request_filters": ["category", "scenario_slug", "profile_id", "confidence_min"], "default_limit": 20, "max_limit": 100}', NULL);

INSERT INTO products (slug, name, description, recipe_id, price_model, preview_pct, status) VALUES
('behavioral-response-library',
 'Behavioral Response Library',
 'Profile-conditioned behavioral responses to high-stakes trading, negotiation, social, and crisis scenarios. Each record pairs a Big Five profile with its response, reasoning chain, emotional arc, and confidence. Procedurally authored, reproducible by seed, provenance-stamped. Filter by category, scenario, profile, or minimum confidence. Free deterministic preview available.',
 (SELECT id FROM recipes ORDER BY id DESC LIMIT 1),
 '{"type": "flat", "amount_usdc": 0.03}',
 0.05,
 'live');
