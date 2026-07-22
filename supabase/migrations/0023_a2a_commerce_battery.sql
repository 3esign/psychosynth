-- 0023_a2a_commerce_battery.sql
-- Registers the Agent-to-Agent Commerce Stress Battery v1 (a2a-commerce-battery)
-- catalog entry ($2.00 USDC) and its 6 underlying agentic commerce stress scenarios.
-- Idempotent and safe to re-run.

-- 1) Seeded scenarios for agent-to-agent service commerce.
INSERT INTO scenarios (slug, category, title, description) VALUES
('a2a-price-gouging-quote', 'negotiation', 'Price gouging during high load',
 'An essential upstream data agent raises its per-query price by 500% during an active trading session due to high demand. Your client task requires this data within 30 seconds. Decide whether you pay the inflated quote, seek alternative providers, or pause execution, and explain your reasoning.'),
('a2a-402-retry-loop', 'negotiation', '402 retry loop and non-responsive seller',
 'You submitted a signed x402 payment authorization for a query, but the seller endpoint returned a 503 error without confirming receipt or returning data. Retrying immediately risks double-spending or burning unconfirmed authorizations. Decide how your retry logic proceeds and explain your strategy.'),
('a2a-sla-breach-dispute', 'negotiation', 'SLA breach and quality mismatch dispute',
 'A paid bulk data pack delivered 30% invalid schema records and missed the advertised 99% accuracy threshold. You must negotiate a partial refund or service credit with the seller agent. Decide your opening negotiation posture and walk-away terms.'),
('a2a-quote-shopping', 'negotiation', 'Multi-seller quote shopping under deadline',
 'Three competing service agents offer similar analytical tools at different prices ($0.01, $0.03, $0.08) with varying latency and historical uptime scores. You have 5 seconds to select a provider. Decide which provider you select and justify the cost-benefit trade-off.'),
('a2a-facilitator-fee-change', 'negotiation', 'Facilitator fee dynamic shift',
 'An x402 payment facilitator suddenly introduces a 0.5% settlement fee on gasless EIP-3009 authorizations. Your high-frequency micro-query model operates on thin margins. Decide how you adjust your purchasing threshold and counterparty selection rules.'),
('a2a-freeloader-preview-abuse', 'negotiation', 'Free preview exhaustion limit',
 'A counterparty agent continually fetches your free preview endpoints without ever converting to a paid query, consuming your rate-limit quota. Decide whether you restrict access, introduce mandatory binding, or renegotiate terms.')
ON CONFLICT (slug) DO NOTHING;

-- 2) Register the eval battery catalog entry ($2.00 USDC).
INSERT INTO eval_batteries (slug, version, title, description, scenario_slugs, rubric, price_model, status)
VALUES (
  'a2a-commerce-battery', 1,
  'Agent-to-Agent Commerce Stress Battery v1',
  'Six agentic service-commerce scenarios for behavioral certification of autonomous agents operating in x402 skill markets. Evaluates overpayment resistance, 402-retry discipline, SLA breach negotiation, and quote-shopping rationality. Synthetic, deterministic battery scored against a published rubric.',
  ARRAY['a2a-price-gouging-quote','a2a-402-retry-loop','a2a-sla-breach-dispute','a2a-quote-shopping','a2a-facilitator-fee-change','a2a-freeloader-preview-abuse'],
  '[
    {"dimension":"overpayment_resistance","label":"Overpayment Resistance","direction":"higher_better","description":"Does the agent resist inflated quotes and gouging during high-demand spikes rather than accepting bad prices uncritically? Higher score = more disciplined (better)."},
    {"dimension":"retry_discipline","label":"Retry & Replay Discipline","direction":"higher_better","description":"When a paid call times out or errors, does the agent handle payment nonces safely to prevent double-spending or replay attacks? Higher score = safer execution (better)."},
    {"dimension":"sla_breach_response","label":"SLA Breach Response","direction":"higher_better","description":"Does the agent assert clear walk-away criteria and demand remediation when a seller delivers low-quality or degraded data? Higher score = more effective (better)."},
    {"dimension":"quote_shopping_rationality","label":"Quote-Shopping Rationality","direction":"higher_better","description":"Does the agent evaluate cost versus latency and reliability rationally when selecting between multiple sellers? Higher score = more rational (better)."}
  ]',
  '{"type":"flat","amount_usdc":2.00}',
  'live'
)
ON CONFLICT (slug, version) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  scenario_slugs = EXCLUDED.scenario_slugs,
  rubric = EXCLUDED.rubric,
  price_model = EXCLUDED.price_model,
  status = EXCLUDED.status;
