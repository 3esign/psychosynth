-- Add Solana Degen Generator
INSERT INTO generators (
  slug, version, entity_type, description,
  prompt_template, params_schema, output_schema, model_config, hooks, status
) VALUES (
  'solana-degen-profile-gen',
  1,
  'profile',
  'Generates synthetic personality profiles optimized for Solana DeFi ecosystem with extreme loss aversion curves and meme-coin affinity.',
  'You are generating a synthetic psychometric profile for an autonomous trading agent. The agent should exhibit traits commonly found in high-frequency, high-risk cryptocurrency environments (specifically the Solana meme-coin ecosystem).

Required traits:
- Extreme risk tolerance (high openness, variable neuroticism).
- Severe FOMO (Fear Of Missing Out) susceptibility.
- Loss aversion coefficient (lambda) should be atypically low for small losses, but extremely high for total portfolio wipeouts.

Output a JSON matching the following schema. Ensure all fields are filled.',
  '{
    "type": "object",
    "properties": {
      "focus": { "type": "string", "default": "meme-coin-trader" }
    }
  }'::jsonb,
  '{
    "type": "object",
    "properties": {
      "big_five": { "type": "object" },
      "prospect_theory": { "type": "object" },
      "mbti_label": { "type": "string" },
      "decision_style": { "type": "string" },
      "tags": {
        "type": "array",
        "items": { "type": "string" }
      }
    }
  }'::jsonb,
  '{
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-20240620",
    "temperature": 0.9,
    "seed_strategy": "deterministic"
  }'::jsonb,
  '[
    {"type": "schema_validate"},
    {"type": "provenance_stamp"},
    {"type": "route", "config": {"auto_approve_above": 0.8, "else": "curation_queue"}}
  ]'::jsonb,
  'active'
);

-- Add Recipe for Solana Data
INSERT INTO recipes (
  id, version, query_rules, composition_rules
) VALUES (
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', -- Deterministic UUID for recipe
  1,
  '{
    "entity": "profile",
    "default_limit": 50,
    "max_limit": 200,
    "filters": [
      { "field": "tags", "operator": "contains", "value": ["chain:solana"] }
    ]
  }'::jsonb,
  null
);

-- Add Product for Solana Trading Pack
INSERT INTO products (
  slug, name, description, recipe_id, price_model, status
) VALUES (
  'solana-trading-pack',
  'Solana Trading Psychology Pack',
  'High-variance, risk-tolerant profiles optimized for Solana DeFi and meme-coin simulation environments. Features modified prospect theory coefficients.',
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  '{
    "type": "per_query",
    "amount_usdc": 0.05,
    "packs": [
      { "slug": "pack-100", "label": "100 Profiles", "amount_usdc": 4.00, "max_rows": 100 },
      { "slug": "pack-500", "label": "500 Profiles", "amount_usdc": 15.00, "max_rows": 500 }
    ]
  }'::jsonb,
  'live'
);
