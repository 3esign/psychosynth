-- Productize new data segments (idempotent catalog updates).
-- Adds Agent-to-Agent Commerce, Token Launch, and Social Cascade packs.

-- Note on overlaps-semantics:
-- filters.tags_include is parsed by resolver.ts using pg's 'overlaps' operator.
-- Pinned here to a single tag to restrict the product to that exact theme.

-- 1. Agent-to-Agent Commerce Pack
INSERT INTO recipes (id, version, query_rules, composition_rules)
VALUES (
  'c5e6d7a8-b9c0-4e1f-8a2b-3c4d5e6f7a8b', 1,
  '{"entity":"profile","filters":{"status":"approved","tags_include":["a2a-commerce"]},"allow_request_filters":["decision_style","mbti_label","big_five_min","big_five_max","lambda_min","lambda_max"],"default_limit":25,"max_limit":100}'::jsonb,
  NULL
) ON CONFLICT (id) DO NOTHING;

INSERT INTO products (slug, name, description, recipe_id, price_model, preview_pct, status)
VALUES (
  'a2a-commerce-pack',
  'Agent-to-Agent Commerce Pack',
  'Premium synthetic counterparty priors for agent service commerce. Features personality profiles optimized for agentic negotiation, x402 integration, SLA disputation, and quote shopping. Idempotent, provenance-stamped.',
  'c5e6d7a8-b9c0-4e1f-8a2b-3c4d5e6f7a8b',
  '{"type":"flat","amount_usdc":0.05,"packs":[{"slug":"pack-100","label":"100 personas","amount_usdc":4.00,"max_rows":100},{"slug":"pack-1k","label":"1,000-persona bulk","amount_usdc":32.00,"max_rows":1000}]}'::jsonb,
  0.20,
  'live'
) ON CONFLICT (slug) DO NOTHING;

-- 2. Token Launch Simulation Pack
INSERT INTO recipes (id, version, query_rules, composition_rules)
VALUES (
  'd6e7f8a9-c0d1-4f2e-9b3c-4d5e6f7a8b9c', 1,
  '{"entity":"profile","filters":{"status":"approved","tags_include":["launch-day"]},"allow_request_filters":["decision_style","mbti_label","big_five_min","big_five_max","lambda_min","lambda_max"],"default_limit":25,"max_limit":100}'::jsonb,
  NULL
) ON CONFLICT (id) DO NOTHING;

INSERT INTO products (slug, name, description, recipe_id, price_model, preview_pct, status)
VALUES (
  'token-launch-pack',
  'Token Launch Simulation Pack',
  'Synthetic personas optimized for token launch, bonding curve migration, and early-stage sniper/bundler behavior simulations. Grounded in Five-Factor traits and prospect theory. Idempotent, provenance-stamped.',
  'd6e7f8a9-c0d1-4f2e-9b3c-4d5e6f7a8b9c',
  '{"type":"flat","amount_usdc":0.03,"packs":[{"slug":"pack-100","label":"100 personas","amount_usdc":2.50,"max_rows":100},{"slug":"pack-1k","label":"1,000-persona bulk","amount_usdc":19.00,"max_rows":1000}]}'::jsonb,
  0.20,
  'live'
) ON CONFLICT (slug) DO NOTHING;

-- 3. Social Cascade & Copy-Trading Pack
INSERT INTO recipes (id, version, query_rules, composition_rules)
VALUES (
  'e7f8a9b0-d1e2-4f3e-ac4d-5e6f7a8b9c0d', 1,
  '{"entity":"profile","filters":{"status":"approved","tags_include":["social-cascade"]},"allow_request_filters":["decision_style","mbti_label","big_five_min","big_five_max","lambda_min","lambda_max"],"default_limit":25,"max_limit":100}'::jsonb,
  NULL
) ON CONFLICT (id) DO NOTHING;

INSERT INTO products (slug, name, description, recipe_id, price_model, preview_pct, status)
VALUES (
  'social-cascade-pack',
  'Social Cascade & Copy-Trading Pack',
  'Synthetic personas modeling social media sentiment, bandwagon effects, farcaster cascades, and copy-trading behavior. Optimized for social-consensus simulations. Idempotent, provenance-stamped.',
  'e7f8a9b0-d1e2-4f3e-ac4d-5e6f7a8b9c0d',
  '{"type":"flat","amount_usdc":0.03,"packs":[{"slug":"pack-100","label":"100 personas","amount_usdc":2.50,"max_rows":100},{"slug":"pack-1k","label":"1,000-persona bulk","amount_usdc":19.00,"max_rows":1000}]}'::jsonb,
  0.20,
  'live'
) ON CONFLICT (slug) DO NOTHING;
