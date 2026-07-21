'use strict';
/*
 * Psychosynth — coherent multi-factor enrichment (v4).
 *
 * Derives the full advertised factor surface — Dark Triad (SD3), prospect
 * theory posture (lambda / alpha / beta), and cognitive reflection (CRT 0-3 +
 * System 1/2 preference) — from a profile's Big Five vector (plus optional
 * archetype anchors), with seeded jitter. NO LLM. The point is coherence:
 * every factor is justified by the trait vector that carries it, so a buyer
 * cross-checking columns finds correlations that match the literature instead
 * of uniform noise.
 *
 * Directional grounding (sign of each loading, not exact magnitudes):
 *  - Machiavellianism:  low agreeableness, mildly strategic (some C, some O).
 *    (Paulhus & Williams 2002; SD3 meta-analytic pattern.)
 *  - Narcissism:        high extraversion, low agreeableness, low neuroticism.
 *  - Psychopathy:       low agreeableness, low conscientiousness, low anxiety.
 *  - Loss aversion:     lambda ~1-4, median near 2.25 (Tversky & Kahneman 1992);
 *    higher with neuroticism and a carried loss-aversion bias; risk-seeking
 *    archetypes sit below 1.5.
 *  - Value curvature:   alpha/beta ~0.88 typical (TK92); we vary around the
 *    canonical estimate instead of pinning every row to the same constant.
 *  - CRT:               0-3 integer (Frederick 2005), loads on C and O;
 *    System 2 preference tracks CRT.
 *
 * IMPORTANT SCALE NOTE: crt_score is standardized as an INTEGER 0-3 (the
 * actual Cognitive Reflection Test scale). Earlier batches wrote a 0-1 float;
 * outputs/v4/03_backfill_factors.sql normalizes those in place.
 */

const S = require('./synth.js');
const R = S.R;

const hi = (x) => Math.max(0, x - 0.5) * 2;
const lo = (x) => Math.max(0, 0.5 - x) * 2;

function jit(rng, d) { return (rng() - 0.5) * 2 * d; }

// ------------------------------------------------------------- dark triad ---
function deriveDarkTriad(rng, bf, anchor) {
  if (anchor) {
    return {
      machiavellianism: R.round2(R.clamp(anchor.machiavellianism + jit(rng, 0.08), 0.02, 0.98)),
      narcissism: R.round2(R.clamp(anchor.narcissism + jit(rng, 0.08), 0.02, 0.98)),
      psychopathy: R.round2(R.clamp(anchor.psychopathy + jit(rng, 0.07), 0.02, 0.98)),
    };
  }
  const a = bf.agreeableness, c = bf.conscientiousness, e = bf.extraversion,
        n = bf.neuroticism, o = bf.openness;
  return {
    machiavellianism: R.round2(R.clamp(0.26 + 0.34 * lo(a) + 0.12 * hi(c) + 0.10 * hi(o) + jit(rng, 0.08), 0.02, 0.98)),
    narcissism: R.round2(R.clamp(0.24 + 0.30 * hi(e) + 0.22 * lo(a) + 0.08 * lo(n) + jit(rng, 0.08), 0.02, 0.98)),
    psychopathy: R.round2(R.clamp(0.12 + 0.34 * lo(a) + 0.24 * lo(c) + 0.10 * lo(n) + jit(rng, 0.07), 0.02, 0.98)),
  };
}

// -------------------------------------------------------- prospect theory ---
function deriveProspect(rng, bf, biases, anchorLambda) {
  const lossBias = (biases || []).find((b) => b.slug === 'loss-aversion');
  const lossW = lossBias ? lossBias.strength : 0;
  let lambda;
  if (typeof anchorLambda === 'number') {
    lambda = R.clamp(anchorLambda + jit(rng, 0.30), 0.55, 4.4);
  } else {
    // centered so the population mean lands near the TK92 ~1.8-2.2 band
    lambda = R.clamp(1.45 + 1.30 * hi(bf.neuroticism) + 0.40 * lo(bf.openness) + 0.45 * lossW + jit(rng, 0.30), 0.6, 4.4);
  }
  const alpha = R.clamp(0.74 + 0.14 * hi(bf.conscientiousness) + 0.06 * lo(bf.neuroticism) + jit(rng, 0.055), 0.55, 0.99);
  const beta = R.clamp(0.72 + 0.12 * hi(bf.conscientiousness) + 0.08 * hi(bf.neuroticism) + jit(rng, 0.055), 0.55, 0.99);
  return {
    lambda: R.round2(lambda),
    alpha: R.round2(alpha),
    beta: R.round2(beta),
  };
}

// --------------------------------------------------- cognitive reflection ---
function deriveCognition(rng, bf) {
  const raw = 0.10 + 0.46 * bf.conscientiousness + 0.30 * bf.openness - 0.14 * bf.neuroticism + jit(rng, 0.14);
  const crt = raw >= 0.68 ? 3 : raw >= 0.48 ? 2 : raw >= 0.30 ? 1 : 0;
  // System preference tracks CRT with a little slack, never contradicts hard.
  let system2p = 0.12 + crt * 0.27 + hi(bf.conscientiousness) * 0.12;
  const system_preference = rng() < system2p ? 'system2' : 'system1';
  return { system_preference, crt_score: crt };
}

// ------------------------------------------------------------- composite ----
// opts: { dtAnchor, lambdaAnchor } for archetype-pinned personas.
function deriveFactors(rng, bf, biases, opts = {}) {
  return {
    dark_triad: deriveDarkTriad(rng, bf, opts.dtAnchor),
    prospect_theory: deriveProspect(rng, bf, biases, opts.lambdaAnchor),
    cognitive_reflection: deriveCognition(rng, bf),
  };
}

// Filterable tag enrichment justified by the factors (no batch junk).
function factorTags(f) {
  const t = [];
  const dt = f.dark_triad;
  if (dt.machiavellianism > 0.6 || dt.narcissism > 0.6 || dt.psychopathy > 0.55) t.push('dark-triad-elevated');
  if (f.prospect_theory.lambda >= 2.5) t.push('loss-averse');
  if (f.prospect_theory.lambda < 1.0) t.push('risk-seeking');
  if (f.cognitive_reflection.crt_score >= 2 && f.cognitive_reflection.system_preference === 'system2') t.push('reflective');
  if (f.cognitive_reflection.crt_score === 0 && f.cognitive_reflection.system_preference === 'system1') t.push('heuristic-driven');
  return t;
}

// One optional prose clause surfacing the enriched posture in plain language
// (no LaTeX, no field dumps) — used at low frequency so it never templates.
const LAMBDA_CLAUSE = {
  high: ['a loss stings them roughly three times as hard as the same-size win pays',
    'they will pay real money to avoid booking a loss, and it shows in every exit',
    'downside dread does more of their decision-making than upside appetite'],
  mid: ['losses weigh on them about twice as much as gains, close to the textbook trader',
    'their risk posture is ordinary: losses hurt more than gains, but not cripplingly so'],
  low: ['losses bounce off them — the asymmetry that disciplines most people barely registers',
    'they are unusually numb to drawdowns, which reads as courage right up until it does not'],
};
function prospectClause(rng, f) {
  const l = f.prospect_theory.lambda;
  const bank = l >= 2.5 ? LAMBDA_CLAUSE.high : l < 1.0 ? LAMBDA_CLAUSE.low : LAMBDA_CLAUSE.mid;
  return R.pick(rng, bank);
}

module.exports = {
  hi, lo, deriveDarkTriad, deriveProspect, deriveCognition, deriveFactors,
  factorTags, prospectClause,
};
