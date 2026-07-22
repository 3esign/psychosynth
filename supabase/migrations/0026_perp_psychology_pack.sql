-- Product: Perp-Psychology Pack
-- Adds a new generator, recipe, and product for perpetual DEX trading bots, Hyperliquid/Avantis market simulators, and risk managers.
-- Introduces a new leverage_profile vector to model funding_sensitivity, liquidation_anxiety, max_leverage_comfort, and deleveraging_style.

-- 1) Generator: perp-psychology-gen
INSERT INTO generators (slug, version, entity_type, description,
  prompt_template, params_schema, output_schema, model_config, hooks, status)
VALUES (
  'perp-psychology-gen', 1, 'profile',
  'Synthetic perpetual futures traders for on-chain risk simulators. Profiles emphasize leverage tolerance, funding rate sensitivity, and behavior near liquidation thresholds.',
  'You are a psychometric data engineer generating synthetic PERP TRADER personas. These represent typical users of on-chain perpetual DEXes (like Hyperliquid, Avantis).
Generate {{count}} personas for the segment: {{segment}}.

Requirements per persona:
1. big_five: five scores in [0,1].
2. summary: 2-3 sentences describing how this person trades perps (leverage choice, funding rate farming vs paying, reaction to liquidations).
3. decision_style: one of analytical | intuitive | dependent | avoidant | spontaneous | deliberative.
4. mbti_label: closest MBTI type derived from Big Five.
5. suggested_biases: 2-4 objects {slug, strength in [0,1]} drawn from: {{json bias_slugs}}.
6. tags: 3-6 lowercase kebab-case tags. ALWAYS include "perp-trading" and "defi-perps"; add up to 3 more descriptive of the persona.

{{extra_instructions}}

Return JSON: {"items": [ ...personas ]}. No commentary.',
  '{"type":"object","additionalProperties":false,"properties":{"count":{"type":"integer","minimum":1,"maximum":100,"default":20},"segment":{"type":"string","default":"perp-scalper","enum":["perp-scalper","funding-rate-farmer","liquidation-hunter","100x-degen","delta-neutral-mm"]},"extra_instructions":{"type":"string","default":""}},"required":["count","segment"]}'::jsonb,
  '{"type":"object","additionalProperties":false,"required":["items"],"properties":{"items":{"type":"array","minItems":1,"items":{"type":"object","additionalProperties":false,"required":["big_five","summary","decision_style","mbti_label","suggested_biases","tags"],"properties":{"big_five":{"type":"object","additionalProperties":false,"required":["openness","conscientiousness","extraversion","agreeableness","neuroticism"],"properties":{"openness":{"type":"number","minimum":0,"maximum":1},"conscientiousness":{"type":"number","minimum":0,"maximum":1},"extraversion":{"type":"number","minimum":0,"maximum":1},"agreeableness":{"type":"number","minimum":0,"maximum":1},"neuroticism":{"type":"number","minimum":0,"maximum":1}}},"summary":{"type":"string","minLength":80,"maxLength":600},"decision_style":{"type":"string","enum":["analytical","intuitive","dependent","avoidant","spontaneous","deliberative"]},"mbti_label":{"type":"string","pattern":"^[EI][NS][TF][JP]$"},"suggested_biases":{"type":"array","minItems":2,"maxItems":4,"items":{"type":"object","additionalProperties":false,"required":["slug","strength"],"properties":{"slug":{"type":"string"},"strength":{"type":"number","minimum":0,"maximum":1}}}},"tags":{"type":"array","minItems":3,"maxItems":6,"items":{"type":"string","pattern":"^[a-z0-9-]+$"}}}}}}}'::jsonb,
  '{"provider":"openrouter","model":"anthropic/claude-3.5-sonnet","temperature":0.9,"max_items_per_call":10}'::jsonb,
  '[{"type":"schema_validate"},{"type":"dedup","config":{"threshold":0.55}},{"type":"provenance_stamp"},{"type":"route","config":{"auto_approve_above":null,"auto_reject_below":null}}]'::jsonb,
  'active'
);

-- 2) Recipe: server-pinned themed filter (only perp-trading profiles).
INSERT INTO recipes (id, version, query_rules, composition_rules)
VALUES (
  'f8a9b0c1-d2e3-4f4e-bc5d-6f7a8b9c0d1e', 1,
  '{"entity":"profile","filters":{"status":"approved","tags_include":["perp-trading"]},"allow_request_filters":["decision_style","mbti_label","big_five_min","big_five_max","lambda_min","lambda_max","funding_sensitivity_min","funding_sensitivity_max","liquidation_anxiety_min","liquidation_anxiety_max","max_leverage_comfort_min","max_leverage_comfort_max","deleveraging_style"],"default_limit":25,"max_limit":100}'::jsonb,
  NULL
);

-- 3) Product: bulk packs.
INSERT INTO products (slug, name, description, recipe_id, price_model, preview_pct, status)
VALUES (
  'perp-psychology-pack',
  'Perp-Psychology & Leverage Data Pack',
  'Synthetic perpetual DEX trader personas for Hyperliquid and Avantis market simulators. Features a unique leverage_profile vector to measure funding sensitivity, liquidation anxiety, and max leverage comfort. Procedurally authored, provenance-stamped, synthetic.',
  'f8a9b0c1-d2e3-4f4e-bc5d-6f7a8b9c0d1e',
  '{"type":"flat","amount_usdc":0.05,"packs":[{"slug":"pack-100","label":"100 personas","amount_usdc":4.00,"max_rows":100},{"slug":"pack-1k","label":"1,000-persona bulk","amount_usdc":32.00,"max_rows":1000}]}'::jsonb,
  0.20,
  'live'
);
