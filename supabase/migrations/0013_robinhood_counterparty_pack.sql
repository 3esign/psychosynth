-- Product: Robinhood Counterparty Pack  (Product #2 of the Robinhood push)
--
-- WHAT: a themed slice of the Personality Profile Library — synthetic RETAIL
-- trader personas (the kind of counterparties a Robinhood agentic-trading bot
-- actually faces) with Big Five + prospect-theory posture, sold in bulk packs
-- for backtesting / agent-in-the-loop simulation. Rides 100% on the existing
-- paid `/api/v1/query/:slug` + x402 rails — no new payment code.
--
-- HOW IT COMPOUNDS: a dedicated generator (`robinhood-retail-gen`) produces
-- profiles TAGGED with 'robinhood' / 'retail-trading' / 'trading'. The product's
-- recipe pins `filters.tags_include` to exactly those tags (server-enforced,
-- not buyer-overridable — see resolver + DB_AUDIT finding C3), so the pack only
-- ever serves on-theme personas even as the general library grows around it.
--
-- HONESTY: synthetic, procedurally authored from IPIP-NEO-grounded trait
-- distributions, provenance-stamped per record, free deterministic preview.
-- NOT trading advice, NOT real user data.

-- 1) Generator: retail Robinhood-style trader personas.
--    Output schema mirrors big-five-profile-gen so records flow through the
--    existing profile pipeline (hooks -> provenance -> curation) unchanged.
INSERT INTO generators (slug, version, entity_type, description,
  prompt_template, params_schema, output_schema, model_config, hooks, status)
VALUES (
  'robinhood-retail-gen', 1, 'profile',
  'Synthetic US retail trader personas for Robinhood agentic-trading simulation: realistic counterparty psychology (FOMO, disposition effect, revenge-trading, panic-selling) grounded in the Five-Factor Model and prospect theory.',
  'You are a psychometric data engineer generating synthetic RETAIL TRADER personas grounded in the Five-Factor Model (IPIP-NEO framing) and prospect theory (Kahneman & Tversky). These represent typical US retail investors on a commission-free brokerage — the counterparties an autonomous trading agent trades against.

Generate {{count}} personas for the segment: {{segment}}.

Requirements per persona:
1. big_five: five scores in [0,1], internally coherent, approximately normal across the batch (mean ~0.5, sd ~0.15). Retail traders skew higher neuroticism and lower conscientiousness on average — reflect that softly, do not caricature.
2. summary: 2-3 sentences describing how this person trades and decides under P&L stress — specific and behavioral (entry/exit habits, reaction to drawdown, chasing). No names, no demographics.
3. decision_style: one of analytical | intuitive | dependent | avoidant | spontaneous | deliberative, consistent with the traits.
4. mbti_label: closest MBTI type derived from Big Five. Cosmetic only.
5. suggested_biases: 2-4 objects {slug, strength in [0,1]} drawn ONLY from: {{json bias_slugs}} — strengths justified by the trait vector (high neuroticism supports loss-aversion and fomo; low conscientiousness supports disposition-effect and gamblers-fallacy).
6. tags: 3-6 lowercase kebab-case tags. ALWAYS include "trading", "retail-trading", and "robinhood"; add up to 3 more descriptive of the persona.

{{extra_instructions}}

Return JSON: {"items": [ ...personas ]}. No commentary.',
  '{"type":"object","additionalProperties":false,"properties":{"count":{"type":"integer","minimum":1,"maximum":100,"default":20},"segment":{"type":"string","default":"general-retail","enum":["general-retail","options-gambler","dip-buyer","meme-chaser","conservative-hodler","panic-seller"]},"extra_instructions":{"type":"string","default":""}},"required":["count","segment"]}',
  '{"type":"object","additionalProperties":false,"required":["items"],"properties":{"items":{"type":"array","minItems":1,"items":{"type":"object","additionalProperties":false,"required":["big_five","summary","decision_style","mbti_label","suggested_biases","tags"],"properties":{"big_five":{"type":"object","additionalProperties":false,"required":["openness","conscientiousness","extraversion","agreeableness","neuroticism"],"properties":{"openness":{"type":"number","minimum":0,"maximum":1},"conscientiousness":{"type":"number","minimum":0,"maximum":1},"extraversion":{"type":"number","minimum":0,"maximum":1},"agreeableness":{"type":"number","minimum":0,"maximum":1},"neuroticism":{"type":"number","minimum":0,"maximum":1}}},"summary":{"type":"string","minLength":80,"maxLength":600},"decision_style":{"type":"string","enum":["analytical","intuitive","dependent","avoidant","spontaneous","deliberative"]},"mbti_label":{"type":"string","pattern":"^[EI][NS][TF][JP]$"},"suggested_biases":{"type":"array","minItems":2,"maxItems":4,"items":{"type":"object","additionalProperties":false,"required":["slug","strength"],"properties":{"slug":{"type":"string"},"strength":{"type":"number","minimum":0,"maximum":1}}}},"tags":{"type":"array","minItems":3,"maxItems":6,"items":{"type":"string","pattern":"^[a-z0-9-]+$"}}}}}}}',
  '{"provider":"openrouter","model":"anthropic/claude-3.5-sonnet","temperature":0.9,"max_items_per_call":10}',
  '[{"type":"schema_validate"},{"type":"dedup","config":{"threshold":0.55}},{"type":"provenance_stamp"},{"type":"route","config":{"auto_approve_above":null,"auto_reject_below":null}}]',
  'active'
);

-- 2) Recipe: server-pinned themed filter (only retail-trading profiles).
INSERT INTO recipes (id, version, query_rules, composition_rules)
VALUES (
  'b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e', 1,
  '{"entity":"profile","filters":{"status":"approved","tags_include":["robinhood","retail-trading"]},"allow_request_filters":["decision_style","mbti_label","big_five_min","big_five_max","lambda_min","lambda_max"],"default_limit":25,"max_limit":100}',
  NULL
);

-- 3) Product: bulk packs (single paid call returns up to max_rows records).
INSERT INTO products (slug, name, description, recipe_id, price_model, preview_pct, status)
VALUES (
  'robinhood-counterparty-pack',
  'Robinhood Counterparty Pack',
  'Synthetic US retail trader personas for backtesting and agent-in-the-loop simulation of Robinhood agentic-trading strategies. Each persona pairs a Big Five vector with prospect-theory posture and a bias profile (FOMO, disposition effect, loss aversion). Filter by decision style, MBTI, trait ranges, or loss-aversion lambda. Procedurally authored, provenance-stamped, synthetic (not real user data, not trading advice). Free deterministic preview.',
  'b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e',
  '{"type":"flat","amount_usdc":0.03,"packs":[{"slug":"pack-100","label":"100 personas","amount_usdc":2.50,"max_rows":100},{"slug":"pack-1k","label":"1,000-persona bulk","amount_usdc":19.00,"max_rows":1000}]}',
  0.20,
  'live'
);
