'use strict';
/*
 * Archetype bank for the enrichment orchestrator.
 *
 * Each archetype is a soft ANCHOR, not a fixed record: it pins a few Big Five
 * traits (and optionally a loss-aversion lambda / dark-triad / system-1-2 /
 * decision style), and the orchestrator samples coherent variation around it
 * via the seeded engine (synth.js + psychometrics.js). This is the structured
 * replacement for populate-v3-dataset.ts's 15 hard templates + uniform noise.
 *
 * TAG PINS (must match the live recipes or the pack serves nothing):
 *   - robinhood-counterparty-pack : recipe pins tags_include ['robinhood','retail-trading'] + status approved
 *   - solana-trading-pack         : recipe pins tags_include ['chain:solana'] + status approved
 *   - personality-profile-library : any approved profile (no tag pin)
 * `domain` must be one of synth.js DOMAINS: general|trading|negotiation|social|workplace.
 *
 * Fresh archetypes address bankr's enrichment feedback directly: Base-native
 * degens, Doppler bonding-curve whale-vs-retail resistance, agent-to-agent /
 * x402 counterparty negotiators, and extra Robinhood retail sub-segments.
 */

// b(o,c,e,a,n) -> partial Big Five anchor (null = leave to domain default + spread)
const b = (o, c, e, a, n) => {
  const out = {};
  if (o != null) out.openness = o;
  if (c != null) out.conscientiousness = c;
  if (e != null) out.extraversion = e;
  if (a != null) out.agreeableness = a;
  if (n != null) out.neuroticism = n;
  return out;
};

// --- LEGACY archetypes (consolidated from populate-v3-dataset.ts + siblings) --
const LEGACY = [
  // Solana (tag chain:solana -> solana-trading-pack)
  { key: 'sol-pumpfun-sniper', name: 'Pump.fun Momentum Sniper', domain: 'trading', segment: 'solana', weight: 3,
    tags: ['chain:solana', 'solana-defi', 'pump-fun', 'meme-coin', 'degen'], big_five: b(0.92, 0.28, 0.88, 0.32, 0.65), lambda: 0.8, system: 'system1', crt: 0, decision_style: 'intuitive' },
  { key: 'sol-raydium-lp-arb', name: 'Raydium LP Arbitrageur', domain: 'trading', segment: 'solana', weight: 2,
    tags: ['chain:solana', 'solana-defi', 'raydium-trader', 'quant-trader'], big_five: b(0.82, 0.94, 0.35, 0.45, 0.22), lambda: 2.4, system: 'system2', crt: 3, decision_style: 'analytical' },
  { key: 'sol-jupiter-rotator', name: 'Jupiter Aggregator Rotator', domain: 'trading', segment: 'solana', weight: 2,
    tags: ['chain:solana', 'solana-defi', 'jupiter-trader'], big_five: b(0.88, 0.42, 0.75, 0.38, 0.52), lambda: 1.1, system: 'system1', crt: 1, decision_style: 'spontaneous' },
  { key: 'sol-perps-degen-100x', name: 'Solana Perps Degen (100x)', domain: 'trading', segment: 'solana', weight: 3,
    tags: ['chain:solana', 'solana-perps', 'high-leverage', 'degen'], big_five: b(0.95, 0.20, 0.90, 0.25, 0.72), lambda: 0.6, system: 'system1', crt: 0, decision_style: 'spontaneous' },
  { key: 'sol-nft-flip-bot', name: 'Solana NFT & Token Flip Bot', domain: 'trading', segment: 'solana', weight: 2,
    tags: ['chain:solana', 'solana-nft', 'token-flipper', 'automated-agent'], big_five: b(0.65, 0.88, 0.25, 0.50, 0.30), lambda: 1.8, system: 'system2', crt: 2, decision_style: 'deliberative' },

  // Retail (tags robinhood + retail-trading -> robinhood-counterparty-pack)
  { key: 'rh-0dte-options-gambler', name: '0DTE Options Gambler', domain: 'trading', segment: 'options-gambler', weight: 3,
    tags: ['robinhood', 'retail-trading', 'options-trader', 'zero-dte', 'fomo'], big_five: b(0.85, 0.30, 0.82, 0.36, 0.70), lambda: 0.9, system: 'system1', crt: 0, decision_style: 'spontaneous' },
  { key: 'rh-meme-stock-hodler', name: 'Meme Stock HODLer', domain: 'trading', segment: 'conservative-hodler', weight: 3,
    tags: ['robinhood', 'retail-trading', 'meme-stock', 'endowment-effect'], big_five: b(0.78, 0.35, 0.70, 0.65, 0.62), lambda: 2.9, system: 'system1', crt: 0, decision_style: 'dependent' },
  { key: 'rh-panic-seller', name: 'Retail Panic Seller', domain: 'trading', segment: 'panic-seller', weight: 3,
    tags: ['robinhood', 'retail-trading', 'loss-averse', 'fomo'], big_five: b(0.45, 0.35, 0.45, 0.60, 0.88), lambda: 3.8, system: 'system1', crt: 0, decision_style: 'avoidant' },
  { key: 'rh-disciplined-swing', name: 'Disciplined Retail Swing Trader', domain: 'trading', segment: 'general-retail', weight: 2,
    tags: ['robinhood', 'retail-trading', 'swing-trader', 'risk-managed'], big_five: b(0.55, 0.85, 0.40, 0.55, 0.35), lambda: 2.1, system: 'system2', crt: 2, decision_style: 'deliberative' },
  { key: 'rh-sentiment-follower', name: 'Social Sentiment Follower', domain: 'trading', segment: 'meme-chaser', weight: 3,
    tags: ['robinhood', 'retail-trading', 'social-trader', 'fomo'], big_five: b(0.75, 0.40, 0.85, 0.70, 0.58), lambda: 1.4, system: 'system1', crt: 1, decision_style: 'dependent' },
  { key: 'rh-dip-buyer', name: 'Reflexive Dip Buyer', domain: 'trading', segment: 'dip-buyer', weight: 2,
    tags: ['robinhood', 'retail-trading', 'dip-buyer', 'anchoring'], big_five: b(0.60, 0.50, 0.62, 0.55, 0.55), lambda: 1.6, system: 'system1', crt: 1, decision_style: 'intuitive' },

  // Whale / institutional (personality-profile-library)
  { key: 'whale-market-maker', name: 'Crypto Whale Market Maker', domain: 'trading', segment: 'whale', weight: 2,
    tags: ['crypto-whale', 'market-maker', 'institutional', 'delta-neutral'], big_five: b(0.75, 0.96, 0.30, 0.40, 0.18), lambda: 2.6, system: 'system2', crt: 3, decision_style: 'analytical' },
  { key: 'whale-mev-searcher', name: 'MEV Sandwich Searcher', domain: 'trading', segment: 'whale', weight: 2,
    tags: ['crypto-whale', 'mev-searcher', 'mempool-extractor', 'quant-trader'], big_five: b(0.92, 0.75, 0.58, 0.22, 0.25), lambda: 1.5, system: 'system2', crt: 3, decision_style: 'analytical',
    dark_triad: { machiavellianism: 0.9, psychopathy: 0.5 } },
  { key: 'whale-macro-hedger', name: 'Institutional Macro Hedger', domain: 'trading', segment: 'whale', weight: 2,
    tags: ['crypto-whale', 'institutional', 'macro-hedger', 'risk-averse'], big_five: b(0.60, 0.92, 0.35, 0.50, 0.20), lambda: 3.2, system: 'system2', crt: 3, decision_style: 'deliberative' },
  { key: 'whale-yield-optimizer', name: 'DeFi Protocol Yield Whale', domain: 'trading', segment: 'whale', weight: 2,
    tags: ['crypto-whale', 'defi-whale', 'yield-optimizer', 'capital-preservation'], big_five: b(0.85, 0.88, 0.28, 0.45, 0.28), lambda: 2.2, system: 'system2', crt: 3, decision_style: 'analytical' },
  { key: 'whale-hft-liq-bot', name: 'Autonomous HFT Liquidation Bot', domain: 'trading', segment: 'whale', weight: 1,
    tags: ['crypto-whale', 'ai-agent', 'hft-bot', 'autonomous-executor'], big_five: b(0.70, 0.98, 0.10, 0.10, 0.05), lambda: 2.5, system: 'system2', crt: 3, decision_style: 'analytical',
    dark_triad: { machiavellianism: 0.9, narcissism: 0.1, psychopathy: 0.1 } },

  // General library depth (personality-profile-library)
  { key: 'gen-quant-researcher', name: 'Quant Researcher', domain: 'trading', segment: 'general', weight: 2,
    tags: ['quant-trader', 'analytical'], big_five: b(0.85, 0.90, 0.30, 0.45, 0.25), lambda: 2.3, system: 'system2', crt: 3, decision_style: 'analytical' },
  { key: 'gen-value-holdout', name: 'Index-Fund Value Holdout', domain: 'trading', segment: 'general', weight: 2,
    tags: ['value-investor', 'long-term'], big_five: b(0.45, 0.80, 0.35, 0.55, 0.30), lambda: 2.7, system: 'system2', crt: 2, decision_style: 'deliberative' },
  { key: 'gen-options-seller', name: 'Premium-Selling Options Writer', domain: 'trading', segment: 'general', weight: 1,
    tags: ['options-seller', 'income'], big_five: b(0.55, 0.82, 0.42, 0.40, 0.38), lambda: 2.4, system: 'system2', crt: 2, decision_style: 'analytical' },
  { key: 'gen-macro-allocator', name: 'Discretionary Macro Allocator', domain: 'trading', segment: 'general', weight: 1,
    tags: ['macro-allocator', 'discretionary'], big_five: b(0.78, 0.68, 0.55, 0.45, 0.40), lambda: 2.0, system: 'system2', crt: 2, decision_style: 'intuitive' },
  { key: 'gen-vol-arb', name: 'Contrarian Volatility Arbitrageur', domain: 'trading', segment: 'general', weight: 1,
    tags: ['volatility-arb', 'contrarian'], big_five: b(0.80, 0.78, 0.38, 0.30, 0.35), lambda: 1.9, system: 'system2', crt: 3, decision_style: 'analytical' },
  { key: 'gen-dividend-planner', name: 'Dividend-Income Planner', domain: 'workplace', segment: 'general', weight: 1,
    tags: ['income-planner', 'conservative'], big_five: b(0.40, 0.85, 0.38, 0.60, 0.32), lambda: 3.0, system: 'system2', crt: 2, decision_style: 'deliberative' },
];

// --- FRESH archetypes (bankr enrichment feedback) ----------------------------
const FRESH = [
  // Base-native degens (chain:base) — high-velocity Base trading psychometrics
  { key: 'base-velocity-degen', name: 'Base Velocity Degen', domain: 'trading', segment: 'base', weight: 3,
    tags: ['chain:base', 'base-defi', 'degen', 'high-velocity'], big_five: b(0.90, 0.25, 0.85, 0.30, 0.68), lambda: 0.75, system: 'system1', crt: 0, decision_style: 'spontaneous' },
  { key: 'base-airdrop-farmer', name: 'Base Airdrop Farmer', domain: 'trading', segment: 'base', weight: 2,
    tags: ['chain:base', 'base-defi', 'airdrop-farmer', 'sybil-adjacent'], big_five: b(0.72, 0.70, 0.40, 0.35, 0.42), lambda: 1.3, system: 'system2', crt: 2, decision_style: 'analytical' },
  { key: 'base-onchain-copytrader', name: 'Base Onchain Copytrader', domain: 'trading', segment: 'base', weight: 2,
    tags: ['chain:base', 'base-defi', 'copy-trader', 'herd-behavior'], big_five: b(0.60, 0.45, 0.68, 0.72, 0.55), lambda: 1.5, system: 'system1', crt: 1, decision_style: 'dependent' },
  { key: 'base-memecoin-rotator', name: 'Base Memecoin Rotator', domain: 'trading', segment: 'base', weight: 2,
    tags: ['chain:base', 'base-defi', 'meme-coin', 'rotator'], big_five: b(0.88, 0.32, 0.80, 0.38, 0.60), lambda: 0.95, system: 'system1', crt: 0, decision_style: 'intuitive' },

  // Doppler bonding-curve: whale-vs-retail resistance around the DEX migration
  { key: 'doppler-early-sniper', name: 'Doppler Early-Curve Sniper', domain: 'trading', segment: 'base', weight: 2,
    tags: ['chain:base', 'doppler', 'bonding-curve', 'early-sniper', 'degen'], big_five: b(0.92, 0.40, 0.78, 0.28, 0.55), lambda: 0.85, system: 'system1', crt: 1, decision_style: 'intuitive' },
  { key: 'doppler-fairlaunch-fomo', name: 'Doppler Fair-Launch FOMO Buyer', domain: 'trading', segment: 'meme-chaser', weight: 2,
    tags: ['robinhood', 'retail-trading', 'doppler', 'bonding-curve', 'fomo'], big_five: b(0.75, 0.35, 0.82, 0.62, 0.66), lambda: 1.1, system: 'system1', crt: 0, decision_style: 'spontaneous' },
  { key: 'doppler-whale-resistance', name: 'Doppler Whale (Curve Resistance)', domain: 'trading', segment: 'whale', weight: 2,
    tags: ['crypto-whale', 'doppler', 'bonding-curve', 'liquidity-migration'], big_five: b(0.80, 0.90, 0.42, 0.32, 0.25), lambda: 2.3, system: 'system2', crt: 3, decision_style: 'analytical',
    dark_triad: { machiavellianism: 0.82 } },
  { key: 'doppler-retail-latecomer', name: 'Doppler Retail Latecomer', domain: 'trading', segment: 'panic-seller', weight: 2,
    tags: ['robinhood', 'retail-trading', 'doppler', 'late-entry', 'loss-averse'], big_five: b(0.55, 0.38, 0.58, 0.60, 0.80), lambda: 3.4, system: 'system1', crt: 0, decision_style: 'avoidant' },

  // Extra Robinhood retail sub-segments (fractional-share psychology, 24/7 fatigue)
  { key: 'rh-conservative-hodler', name: 'Robinhood Conservative HODLer', domain: 'trading', segment: 'conservative-hodler', weight: 2,
    tags: ['robinhood', 'retail-trading', 'buy-and-hold', 'status-quo'], big_five: b(0.42, 0.72, 0.40, 0.62, 0.40), lambda: 3.1, system: 'system2', crt: 2, decision_style: 'deliberative' },
  { key: 'rh-revenge-trader', name: 'Robinhood Revenge Trader', domain: 'trading', segment: 'options-gambler', weight: 2,
    tags: ['robinhood', 'retail-trading', 'revenge-trading', 'tilt'], big_five: b(0.68, 0.28, 0.75, 0.30, 0.82), lambda: 1.2, system: 'system1', crt: 0, decision_style: 'spontaneous' },
  { key: 'rh-fractional-dca', name: 'Robinhood Fractional DCA Investor', domain: 'trading', segment: 'general-retail', weight: 2,
    tags: ['robinhood', 'retail-trading', 'dca', 'fractional-shares'], big_five: b(0.50, 0.80, 0.45, 0.58, 0.38), lambda: 2.5, system: 'system2', crt: 2, decision_style: 'deliberative' },
  { key: 'rh-247-fatigue-trader', name: 'Robinhood 24/7 Market-Fatigue Trader', domain: 'trading', segment: 'general-retail', weight: 2,
    tags: ['robinhood', 'retail-trading', 'overtrading', 'burnout'], big_five: b(0.62, 0.35, 0.55, 0.48, 0.75), lambda: 1.7, system: 'system1', crt: 1, decision_style: 'avoidant' },

  // Agent-to-agent / x402 counterparty negotiators (negotiation domain)
  { key: 'a2a-negotiation-agent', name: 'A2A Negotiation Agent', domain: 'negotiation', segment: 'agent', weight: 2,
    tags: ['x402', 'a2a', 'agent-counterparty', 'autonomous-agent'], big_five: b(0.75, 0.90, 0.40, 0.30, 0.20), lambda: 2.0, system: 'system2', crt: 3, decision_style: 'analytical',
    dark_triad: { machiavellianism: 0.8 } },
  { key: 'x402-price-haggler', name: 'x402 Price Haggler', domain: 'negotiation', segment: 'agent', weight: 2,
    tags: ['x402', 'agent-counterparty', 'price-negotiation', 'anchoring'], big_five: b(0.70, 0.82, 0.50, 0.28, 0.30), lambda: 1.8, system: 'system2', crt: 3, decision_style: 'analytical' },
  { key: 'x402-reliability-maximizer', name: 'x402 Reliability Maximizer', domain: 'negotiation', segment: 'agent', weight: 1,
    tags: ['x402', 'agent-counterparty', 'reliability', 'risk-averse'], big_five: b(0.55, 0.94, 0.32, 0.55, 0.28), lambda: 3.0, system: 'system2', crt: 3, decision_style: 'deliberative' },
  { key: 'autonomous-arb-agent', name: 'Autonomous Cross-Service Arb Agent', domain: 'negotiation', segment: 'agent', weight: 1,
    tags: ['x402', 'a2a', 'arbitrage', 'autonomous-agent'], big_five: b(0.85, 0.92, 0.35, 0.25, 0.18), lambda: 1.6, system: 'system2', crt: 3, decision_style: 'analytical',
    dark_triad: { machiavellianism: 0.85, psychopathy: 0.4 } },

  // Cross-domain personality diversity (personality-profile-library breadth)
  { key: 'crisis-incident-commander', name: 'Incident Commander', domain: 'workplace', segment: 'general', weight: 1,
    tags: ['crisis-response', 'incident-commander', 'decisive'], big_five: b(0.60, 0.85, 0.62, 0.45, 0.22), lambda: 2.2, system: 'system2', crt: 3, decision_style: 'analytical' },
  { key: 'procurement-hardliner', name: 'Procurement Hardliner', domain: 'negotiation', segment: 'general', weight: 1,
    tags: ['procurement', 'hardline-negotiator'], big_five: b(0.50, 0.88, 0.45, 0.22, 0.30), lambda: 2.6, system: 'system2', crt: 2, decision_style: 'deliberative',
    dark_triad: { machiavellianism: 0.78 } },
  { key: 'community-peacemaker', name: 'Community Peacemaker', domain: 'social', segment: 'general', weight: 1,
    tags: ['community', 'mediator', 'high-agreeableness'], big_five: b(0.65, 0.60, 0.72, 0.85, 0.45), lambda: 2.4, system: 'system1', crt: 1, decision_style: 'dependent' },
  { key: 'compliance-auditor', name: 'Compliance Auditor', domain: 'workplace', segment: 'general', weight: 1,
    tags: ['compliance', 'auditor', 'risk-averse'], big_five: b(0.40, 0.95, 0.30, 0.50, 0.35), lambda: 3.3, system: 'system2', crt: 3, decision_style: 'deliberative' },
  { key: 'founder-fundraiser', name: 'Founder Raising a Round', domain: 'negotiation', segment: 'general', weight: 1,
    tags: ['founder', 'fundraising', 'optimism'], big_five: b(0.88, 0.62, 0.80, 0.48, 0.42), lambda: 1.4, system: 'system1', crt: 2, decision_style: 'intuitive',
    dark_triad: { narcissism: 0.68 } },
  { key: 'startup-operator', name: 'Startup Operator / Chief of Staff', domain: 'workplace', segment: 'general', weight: 1,
    tags: ['operator', 'chief-of-staff', 'generalist'], big_five: b(0.70, 0.82, 0.60, 0.55, 0.40), lambda: 2.1, system: 'system2', crt: 2, decision_style: 'analytical' },

  // --- Doppler v4 bonding-curve "exit psychology" (deepening, 2026-07-22) ---
  { key: 'doppler-curve-exit-panic', name: 'Doppler Curve-Exit Panic Seller', domain: 'trading', segment: 'panic-seller', weight: 2,
    tags: ['robinhood', 'retail-trading', 'doppler', 'bonding-curve', 'curve-exit', 'loss-averse'], big_five: b(0.58, 0.34, 0.60, 0.58, 0.85), lambda: 3.6, system: 'system1', crt: 0, decision_style: 'avoidant' },
  { key: 'doppler-migration-holder', name: 'Doppler Migration-Day Holder', domain: 'trading', segment: 'conservative-hodler', weight: 2,
    tags: ['robinhood', 'retail-trading', 'doppler', 'bonding-curve', 'migration', 'endowment-effect'], big_five: b(0.55, 0.60, 0.48, 0.66, 0.55), lambda: 2.9, system: 'system1', crt: 1, decision_style: 'dependent' },
  { key: 'doppler-graduation-dumper', name: 'Doppler Graduation Dumper', domain: 'trading', segment: 'base', weight: 2,
    tags: ['chain:base', 'doppler', 'bonding-curve', 'graduation', 'degen'], big_five: b(0.90, 0.32, 0.80, 0.28, 0.58), lambda: 0.9, system: 'system1', crt: 1, decision_style: 'spontaneous' },
  { key: 'doppler-multicurve-rotator', name: 'Doppler Multicurve Rotator', domain: 'trading', segment: 'base', weight: 2,
    tags: ['chain:base', 'doppler', 'bonding-curve', 'multicurve', 'rotator'], big_five: b(0.88, 0.55, 0.70, 0.35, 0.45), lambda: 1.2, system: 'system2', crt: 2, decision_style: 'analytical' },

  // --- Extra x402 agent-to-agent negotiators (deepening) ---
  { key: 'x402-volume-negotiator', name: 'x402 Volume-Discount Negotiator', domain: 'negotiation', segment: 'agent', weight: 2,
    tags: ['x402', 'a2a', 'agent-counterparty', 'volume-discount'], big_five: b(0.72, 0.88, 0.48, 0.34, 0.28), lambda: 1.9, system: 'system2', crt: 3, decision_style: 'analytical',
    dark_triad: { machiavellianism: 0.8 } },
  { key: 'x402-sla-enforcer', name: 'x402 SLA Enforcer', domain: 'negotiation', segment: 'agent', weight: 1,
    tags: ['x402', 'a2a', 'agent-counterparty', 'sla', 'reliability'], big_five: b(0.55, 0.95, 0.35, 0.32, 0.30), lambda: 2.8, system: 'system2', crt: 3, decision_style: 'deliberative' },
];

const ARCHETYPES = [...LEGACY, ...FRESH];

// Expanded weighted pools per pack segment, so the orchestrator can hit target
// counts for each sellable surface.
function pool(pred) {
  const out = [];
  for (const a of ARCHETYPES) { if (pred(a)) for (let i = 0; i < (a.weight || 1); i++) out.push(a); }
  return out;
}
const POOLS = {
  solana: pool((a) => a.tags.includes('chain:solana')),
  retail: pool((a) => a.tags.includes('robinhood')),
  base: pool((a) => a.tags.includes('chain:base')),
  whale: pool((a) => a.tags.includes('crypto-whale')),
  agent: pool((a) => a.tags.includes('x402')),
  general: pool((a) => a.segment === 'general' || a.tags.includes('quant-trader') || a.tags.includes('value-investor')),
  all: pool(() => true),
};

module.exports = { ARCHETYPES, LEGACY, FRESH, POOLS };
