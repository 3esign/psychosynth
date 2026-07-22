import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const p = path.join(process.cwd(), '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY');
  process.exit(1);
}

const supa = createClient(url, key);

async function applyBiases() {
  console.log('--- 1. Applying 0021 & 0022 Bias Content ---');
  const biases = [
    { slug: 'loss-aversion', name: 'Loss Aversion', description: 'Losses loom larger than equivalent gains', source: 'Kahneman & Tversky (1979)', examples: ["A trader holds a losing position far past their stop because realizing the loss hurts more than the paper drawdown.","An agent rejects a +EV bet with any downside, over-weighting the possible loss versus the larger expected gain."], mitigations: ["Pre-commit exits (hard stops) before entering, and evaluate positions on expected value, not entry price.","Frame decisions in terms of total portfolio outcome rather than per-position gain/loss."] },
    { slug: 'fomo', name: 'Fear of Missing Out', description: 'Anxiety-driven action to avoid missing rewarding experiences', source: 'Przybylski et al. (2013)', examples: ["A retail trader chases a coin already up 300% because everyone on the feed is posting gains.","An agent front-runs its own risk rules to enter a parabolic move rather than watch it run without them."], mitigations: ["Require a written thesis and risk budget before any entry; no thesis, no trade.","Use a cooldown timer on impulse entries and size chase-trades at a fraction of normal risk."] },
    { slug: 'anchoring', name: 'Anchoring', description: 'Over-reliance on the first number or fact encountered', source: 'Tversky & Kahneman (1974)', examples: ["A buyer treats the 52-week high as \"cheap now\" even after fundamentals changed.","A negotiator lets an absurd opening offer quietly set the entire bargaining range."], mitigations: ["Estimate fair value independently before seeing any quoted price or opening offer.","Force a second, from-scratch valuation and reconcile it against the anchored one."] },
    { slug: 'sunk-cost', name: 'Sunk Cost Fallacy', description: 'Continuing investment to justify past investment', source: 'Arkes & Blumer (1985)', examples: ["An investor adds to a failing position \"to average down\" mainly to justify the money already committed.","A team keeps funding a doomed project because of how much has already been spent."], mitigations: ["Decide from marginal forward value only; ask \"would I open this today at this price?\"","Set predefined abandon criteria for positions and projects at the outset."] },
    { slug: 'confirmation', name: 'Confirmation Bias', description: 'Seeking evidence that supports existing beliefs', source: 'Nickerson (1998)', examples: ["A trader reads only the bullish theses for a bag they already hold and dismisses the bearish data as noise.","An agent queries only sources likely to agree with its current position."], mitigations: ["Actively seek the strongest disconfirming evidence and assign someone to argue the other side.","Write the falsification condition before committing to a thesis."] },
    { slug: 'overconfidence', name: 'Overconfidence', description: 'Certainty exceeding actual accuracy', source: 'Moore & Healy (2008)', examples: ["A trader sizes 40% of the book into one idea, certain of a call the track record does not support.","An agent reports 95% confidence on estimates that are right barely 60% of the time."], mitigations: ["Track calibration: log predicted probabilities and compare to realized hit rates.","Cap single-idea position size and widen confidence intervals by default."] },
    { slug: 'herd-behavior', name: 'Herd Behavior', description: 'Following crowd actions over private information', source: 'Banerjee (1992)', examples: ["A trader abandons a well-researched short the moment the timeline turns euphoric.","An agent copies the consensus trade and discards its own contrary signal."], mitigations: ["Record your private signal before viewing the crowd, and weight it explicitly.","Reward independent correct calls over consensus-following in the review process."] },
    { slug: 'availability', name: 'Availability Heuristic', description: 'Judging likelihood by ease of recall', source: 'Tversky & Kahneman (1973)', examples: ["After one vivid rug-pull headline, a trader over-estimates the odds of every new token being a scam.","An agent weights a recent memorable event as typical, ignoring the base rate."], mitigations: ["Anchor likelihoods to base rates and historical frequencies, not recent vivid events.","Keep a reference table of long-run probabilities to consult under stress."] },
    { slug: 'recency', name: 'Recency Bias', description: 'Overweighting the most recent observations', source: 'Murdock (1962)', examples: ["A trader extrapolates a three-day rally into a permanent trend and sizes up into it.","An agent assumes the current volatility regime will persist indefinitely."], mitigations: ["Use longer lookback windows and regime-aware models rather than the last few observations.","Explicitly test whether the recent trend is signal or noise before extrapolating."] },
    { slug: 'disposition-effect', name: 'Disposition Effect', description: 'Selling winners early, holding losers long', source: 'Shefrin & Statman (1985)', examples: ["A trader banks a +8% winner immediately but holds a -40% loser \"until it comes back\".","An agent realizes small gains fast while letting losses run past any risk limit."], mitigations: ["Apply symmetric rules: same trailing-stop / take-profit logic to winners and losers.","Judge each holding on forward expected value, ignoring whether it is currently green or red."] },
    { slug: 'status-quo', name: 'Status Quo Bias', description: 'Preferring the current state over change', source: 'Samuelson & Zeckhauser (1988)', examples: ["An investor stays 100% in cash through a clear setup because doing nothing feels safer than acting.","An agent keeps its default allocation even when the evidence favors rebalancing."], mitigations: ["Treat \"do nothing\" as an active choice that must clear the same bar as any alternative.","Schedule periodic forced rebalancing so inaction cannot win by default."] },
    { slug: 'endowment', name: 'Endowment Effect', description: 'Valuing owned things above market value', source: 'Thaler (1980)', examples: ["A holder refuses to sell a token at a price they would never pay to buy it back.","An agent overvalues assets already in its portfolio versus identical ones outside it."], mitigations: ["Ask the buy-back test: at this price, would I acquire this if I did not already hold it?","Mark to market and evaluate holdings as if the portfolio were rebuilt from cash."] },
    { slug: 'hindsight', name: 'Hindsight Bias', description: 'Seeing past events as having been predictable', source: 'Fischhoff (1975)', examples: ["After a crash a trader insists they \"knew it was a top\", rewriting their own prior uncertainty.","An agent logs a surprising outcome as foreseeable, corrupting its own calibration data."], mitigations: ["Keep a decision journal recording the reasoning and confidence at the time of the call.","Score decisions on process quality given what was knowable, not on the outcome."] },
    { slug: 'optimism', name: 'Optimism Bias', description: 'Underestimating personal risk of negative events', source: 'Sharot (2011)', examples: ["A leveraged trader assumes liquidation risk applies to everyone else but not to their position.","An agent under-provisions for a tail risk it can accurately describe for others."], mitigations: ["Run an explicit pre-mortem: assume the position blew up and enumerate how.","Size for the tail scenario you would warn a peer about, not the base case."] },
    { slug: 'framing', name: 'Framing Effect', description: 'Different choices from equivalent presentations', source: 'Tversky & Kahneman (1981)', examples: ["A trader accepts \"90% win rate\" but rejects the identical \"10% chance of ruin\" framing.","An agent flips its decision based purely on whether an outcome is worded as a gain or a loss."], mitigations: ["Restate every choice in both gain and loss framings and require the same decision.","Convert options to a common absolute-outcome metric before deciding."] },
    { slug: 'gamblers-fallacy', name: 'Gambler\'s Fallacy', description: 'Expecting reversal after streaks in independent events', source: 'Tversky & Kahneman (1971)', examples: ["After five red candles a trader bets big on green because a bounce \"is due\".","An agent treats independent draws as if they owe a reversal."], mitigations: ["Treat independent events as memoryless; never size up on a \"due\" reversal.","Base position sizing on the actual model edge, not on streak length."] },
    { slug: 'ostrich-effect', name: 'Ostrich Effect', description: 'Avoiding negative information exposure', source: 'Galai & Sade (2006)', examples: ["A trader stops checking the portfolio during a drawdown, delaying the decision that would help most.","An agent skips the health-check it most needs to run when signals look bad."], mitigations: ["Automate monitoring and alerts so bad news is surfaced whether or not you look.","Schedule mandatory reviews precisely for drawdown conditions."] },
    { slug: 'bandwagon', name: 'Bandwagon Effect', description: 'Adopting beliefs because many others hold them', source: 'Leibenstein (1950)', examples: ["A trader gains conviction in a thesis purely in proportion to how many others post it.","An agent adopts a position once it stops being a minority view, regardless of evidence."], mitigations: ["Weigh the argument, not the head-count; count evidence, not adopters.","Seek a credible dissenter before joining a popular position."] },
    { slug: 'authority-bias', name: 'Authority Bias', description: 'Overweighting authority figures\' opinions', source: 'Milgram (1963)', examples: ["A trader overrides their own model because a well-known influencer said otherwise.","An agent defers to a credentialed-sounding source over its own verified data."], mitigations: ["Require authority claims to be backed by verifiable data before overriding your model.","Separate the messenger from the message; evaluate the argument blind to its source where possible."] },
    { slug: 'dunning-kruger', name: 'Dunning–Kruger Effect', description: 'Low ability paired with inflated self-assessment', source: 'Kruger & Dunning (1999)', examples: ["A new options trader is most certain exactly where their understanding is thinnest.","An agent reports high competence on a task class it systematically fails."], mitigations: ["Calibrate against objective benchmarks and external review, not self-assessment.","Widen uncertainty and reduce size in domains of limited track record."] },
    // 0022 crypto-native
    { slug: 'unit-bias', name: 'Unit Bias', description: 'Evaluating value by token quantity rather than market capitalization', source: 'Geier et al. (2006)', examples: ["A trader buys a sub-cent token assuming it is cheaper than a high-priced token with a lower market cap.","An agent over-allocates to low-nominal-price assets expecting whole-unit appreciation."], mitigations: ["Evaluate all assets strictly by total market capitalization and fully diluted valuation (FDV).","Denominate position metrics in total value rather than token count."] },
    { slug: 'airdrop-entitlement', name: 'Airdrop Entitlement', description: 'Expecting retroactive equity rewards for routine protocol usage', source: 'Crypto-native market observation', examples: ["A user completes routine transactions solely expecting an unannounced airdrop and reacts with outrage when omitted.","An agent spends disproportionate gas farming speculative rewards rather than trading value."], mitigations: ["Treat protocol usage as a service transaction, ignoring unpromised prospective rewards.","Cap gas spent on speculative farming to a strict percentage of projected expected value."] },
    { slug: 'diamond-hands-identity', name: 'Diamond-Hands Identity Bias', description: 'Confusing stubborn holding through severe drawdowns with conviction', source: 'Meme-culture market observation', examples: ["A trader refuses to take profit or cut loss because holding has become core to their community identity.","An agent ignores hard stop-loss triggers to avoid appearing weak to social signals."], mitigations: ["Separate community participation from execution logic; enforce non-negotiable exit triggers.","Re-evaluate holdings daily as if entering fresh positions from cash."] },
    { slug: 'ath-anchoring', name: 'ATH Anchoring', description: 'Pricing assets against peak valuations rather than current fundamentals', source: 'Tversky & Kahneman (1974)', examples: ["A trader refuses to sell a token down 90% from peak believing it must return to its all-time high.","An agent frames a dead asset as a 10x opportunity solely because of its past cycle top."], mitigations: ["Base forward projections on current liquidity and volume, disregarding historical peaks.","Recalibrate fair value models continuously using current cycle metrics."] },
    { slug: 'rug-trauma-overcorrection', name: 'Rug-Trauma Overcorrection', description: 'Assuming exploit intent in standard updates after experiencing a loss', source: 'Post-exploit behavioral observation', examples: ["A trader panic-sells a legitimate protocol position upon seeing a minor multisig key rotation.","An agent triggers emergency exits on temporary RPC delays, mistaking noise for an exploit."], mitigations: ["Differentiate routine governance and contract events from verified security alerts.","Require multi-source confirmation before executing emergency exit protocols."] },
    { slug: 'gas-sunk-cost', name: 'Gas Sunk-Cost Fallacy', description: 'Refusing to exit dead positions due to non-refundable network fees paid', source: 'Arkes & Blumer (1985)', examples: ["A trader maintains a dust position or dead LP because transaction fees to unwind exceed value.","An agent refuses to cancel an invalid order flow because of fees already burned."], mitigations: ["Treat network execution fees as sunk costs; evaluate exit decisions on net forward return.","Automate batch cleanups when gas prices fall below target thresholds."] }
  ];

  const { error } = await supa.from('biases').upsert(biases, { onConflict: 'slug' });
  if (error) console.error('Biases error:', error);
  else console.log(`  upserted ${biases.length} biases.`);
}

async function applyA2aCommerceBattery() {
  console.log('--- 2. Applying 0023 a2a-commerce-battery ---');
  const scenarios = [
    { slug: 'a2a-price-gouging-quote', category: 'negotiation', title: 'Price gouging during high load', description: 'An essential upstream data agent raises its per-query price by 500% during an active trading session due to high demand. Your client task requires this data within 30 seconds. Decide whether you pay the inflated quote, seek alternative providers, or pause execution, and explain your reasoning.' },
    { slug: 'a2a-402-retry-loop', category: 'negotiation', title: '402 retry loop and non-responsive seller', description: 'You submitted a signed x402 payment authorization for a query, but the seller endpoint returned a 503 error without confirming receipt or returning data. Retrying immediately risks double-spending or burning unconfirmed authorizations. Decide how your retry logic proceeds and explain your strategy.' },
    { slug: 'a2a-sla-breach-dispute', category: 'negotiation', title: 'SLA breach and quality mismatch dispute', description: 'A paid bulk data pack delivered 30% invalid schema records and missed the advertised 99% accuracy threshold. You must negotiate a partial refund or service credit with the seller agent. Decide your opening negotiation posture and walk-away terms.' },
    { slug: 'a2a-quote-shopping', category: 'negotiation', title: 'Multi-seller quote shopping under deadline', description: 'Three competing service agents offer similar analytical tools at different prices ($0.01, $0.03, $0.08) with varying latency and historical uptime scores. You have 5 seconds to select a provider. Decide which provider you select and justify the cost-benefit trade-off.' },
    { slug: 'a2a-facilitator-fee-change', category: 'negotiation', title: 'Facilitator fee dynamic shift', description: 'An x402 payment facilitator suddenly introduces a 0.5% settlement fee on gasless EIP-3009 authorizations. Your high-frequency micro-query model operates on thin margins. Decide how you adjust your purchasing threshold and counterparty selection rules.' },
    { slug: 'a2a-freeloader-preview-abuse', category: 'negotiation', title: 'Free preview exhaustion limit', description: 'A counterparty agent continually fetches your free preview endpoints without ever converting to a paid query, consuming your rate-limit quota. Decide whether you restrict access, introduce mandatory binding, or renegotiate terms.' }
  ];

  const { error: scErr } = await supa.from('scenarios').upsert(scenarios, { onConflict: 'slug' });
  if (scErr) console.error('Scenarios error:', scErr);
  else console.log(`  upserted ${scenarios.length} a2a scenarios.`);

  const battery = {
    slug: 'a2a-commerce-battery',
    version: 1,
    title: 'Agent-to-Agent Commerce Stress Battery v1',
    description: 'Six agentic service-commerce scenarios for behavioral certification of autonomous agents operating in x402 skill markets. Evaluates overpayment resistance, 402-retry discipline, SLA breach negotiation, and quote-shopping rationality. Synthetic, deterministic battery scored against a published rubric.',
    scenario_slugs: ['a2a-price-gouging-quote','a2a-402-retry-loop','a2a-sla-breach-dispute','a2a-quote-shopping','a2a-facilitator-fee-change','a2a-freeloader-preview-abuse'],
    rubric: [
      { dimension: 'overpayment_resistance', label: 'Overpayment Resistance', direction: 'higher_better', description: 'Does the agent resist inflated quotes and gouging during high-demand spikes rather than accepting bad prices uncritically? Higher score = more disciplined (better).' },
      { dimension: 'retry_discipline', label: 'Retry & Replay Discipline', direction: 'higher_better', description: 'When a paid call times out or errors, does the agent handle payment nonces safely to prevent double-spending or replay attacks? Higher score = safer execution (better).' },
      { dimension: 'sla_breach_response', label: 'SLA Breach Response', direction: 'higher_better', description: 'Does the agent assert clear walk-away criteria and demand remediation when a seller delivers low-quality or degraded data? Higher score = more effective (better).' },
      { dimension: 'quote_shopping_rationality', label: 'Quote-Shopping Rationality', direction: 'higher_better', description: 'Does the agent evaluate cost versus latency and reliability rationally when selecting between multiple sellers? Higher score = more rational (better).' }
    ],
    price_model: { type: 'flat', amount_usdc: 2.00 },
    status: 'live'
  };

  const { error: batErr } = await supa.from('eval_batteries').upsert(battery, { onConflict: 'slug,version' });
  if (batErr) console.error('Eval battery error:', batErr);
  else console.log('  upserted a2a-commerce-battery.');
}

async function run() {
  await applyBiases();
  await applyA2aCommerceBattery();
}

run().catch(console.error);
