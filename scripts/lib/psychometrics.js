'use strict';
/*
 * Psychometrics extension layer for the offline synthesis engine.
 *
 * synth.js authors the Big Five vector, decision style, coherent summary,
 * suggested biases and tags. The three PAID surfaces of the catalog
 * (personality-profile-library / robinhood-counterparty-pack /
 * solana-trading-pack) additionally advertise Dark Triad, prospect-theory and
 * cognitive-reflection filters — those fields must live in `content` and must
 * be DERIVED from the same trait vector so the record stays internally
 * coherent (a high-neuroticism panic-seller must not also read as loss-neutral).
 *
 * This module derives those three blocks from the Big Five vector + chosen
 * biases, with optional per-archetype ANCHORS that override the derivation
 * (e.g. a "100x perps degen" anchors lambda < 1.0 = loss-tolerant). It then
 * assembles the full profile row for insertion. No LLM, fully seeded.
 *
 * This is the replacement for populate-v3-dataset.ts's crude inline templates:
 *   - v3 summary  = one string per archetype, only numbers differ  -> here: synth.buildSummary (combinatorial, trigram-distinct)
 *   - v3 lambda   = archetype base + uniform noise, alpha/beta ~const -> here: derived from neuroticism/openness + loss-aversion bias
 *   - v3 tags     = [...archetypeTags, `batch-<name>-<i>`]           -> here: coherent tags, NO batch pollution
 */

const crypto = require('crypto');
const S = require('./synth.js');

const TRAITS = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'];
const hi = (x) => Math.max(0, x - 0.5) * 2;
const lo = (x) => Math.max(0, 0.5 - x) * 2;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const r2 = (x) => Math.round(x * 100) / 100;

// Deterministic v4-shaped UUID from the seeded PRNG (reproducible per seed).
function uuid(rng) {
  const h = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 32; i++) s += h[Math.floor(rng() * 16)];
  const y = '89ab'[Math.floor(rng() * 4)];
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-${y}${s.slice(17, 20)}-${s.slice(20, 32)}`;
}

function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

// ------------------------------------------------------- Dark Triad ----------
// Grounded in the standard FFM↔Dark-Triad correlations: all three load on low
// agreeableness; Machiavellianism adds strategic conscientiousness, Narcissism
// adds extraversion/openness and is dampened by neuroticism, Psychopathy adds
// low neuroticism (fearlessness) + low conscientiousness (disinhibition).
function deriveDarkTriad(rng, bf, anchor = {}) {
  const noise = () => (rng() - 0.5) * 0.08;
  let mach = anchor.machiavellianism != null ? anchor.machiavellianism
    : 0.42 + 0.42 * lo(bf.agreeableness) + 0.22 * hi(bf.conscientiousness) - 0.12 * hi(bf.agreeableness);
  let narc = anchor.narcissism != null ? anchor.narcissism
    : 0.38 + 0.40 * hi(bf.extraversion) + 0.30 * lo(bf.agreeableness) + 0.12 * hi(bf.openness) - 0.18 * hi(bf.neuroticism);
  let psy = anchor.psychopathy != null ? anchor.psychopathy
    : 0.28 + 0.42 * lo(bf.agreeableness) + 0.30 * lo(bf.neuroticism) + 0.22 * lo(bf.conscientiousness);
  return {
    machiavellianism: r2(clamp(mach + noise(), 0.03, 0.97)),
    narcissism: r2(clamp(narc + noise(), 0.03, 0.97)),
    psychopathy: r2(clamp(psy + noise(), 0.03, 0.97)),
  };
}

// ------------------------------------------------- prospect theory -----------
// lambda = loss aversion (Tversky-Kahneman median ~2.25). Higher with
// neuroticism and an explicit loss-aversion/disposition bias; lower (toward
// risk-seeking, <1) with openness. alpha/beta = diminishing sensitivity to
// gains/losses (KT ~0.88), eroded by neuroticism.
function deriveProspectTheory(rng, bf, biases, anchor = {}) {
  const strength = (slug) => { const b = (biases || []).find((x) => x.slug === slug); return b ? b.strength : 0; };
  const lossAv = strength('loss-aversion');
  const dispo = strength('disposition-effect');
  const noise = () => (rng() - 0.5) * 0.1;

  let lambda = anchor.lambda != null
    ? anchor.lambda + (rng() - 0.5) * 0.35
    : 2.0 + 2.4 * (bf.neuroticism - 0.5) - 1.2 * (bf.openness - 0.5) + 0.7 * lossAv + 0.4 * dispo;
  lambda = r2(clamp(lambda, 0.5, 5.0));

  let alpha = anchor.alpha != null ? anchor.alpha : 0.88 - 0.16 * hi(bf.neuroticism) + 0.08 * hi(bf.conscientiousness);
  let beta = anchor.beta != null ? anchor.beta : 0.86 - 0.12 * hi(bf.neuroticism) + 0.06 * hi(bf.openness);
  alpha = r2(clamp(alpha + noise(), 0.40, 0.99));
  beta = r2(clamp(beta + noise(), 0.40, 0.99));
  return { lambda, alpha, beta };
}

// -------------------------------------------- cognitive reflection -----------
// System-2 preference and CRT rise with conscientiousness + openness, fall with
// neuroticism + extraversion (impulsivity proxy).
function deriveCognitive(rng, bf, anchor = {}) {
  const reflect = 0.5 * (bf.conscientiousness - 0.5) + 0.45 * (bf.openness - 0.5)
    - 0.30 * (bf.neuroticism - 0.5) - 0.20 * (bf.extraversion - 0.5);
  const system_preference = anchor.system || (reflect >= 0.02 ? 'system2' : 'system1');
  let crt_score = anchor.crt != null
    ? anchor.crt
    : Math.round(1.5 + 3.0 * reflect + (rng() - 0.5));
  crt_score = Math.max(0, Math.min(3, crt_score));
  return { system_preference, crt_score };
}

// -------------------------------------------- leverage profile --------------
// New for perp-psychology-pack.
function deriveLeverageProfile(rng, bf, pt, anchor = {}) {
  const noise = () => (rng() - 0.5) * 0.1;
  
  let liquidation_anxiety = anchor.liquidation_anxiety != null ? anchor.liquidation_anxiety :
    0.3 + 0.4 * hi(bf.neuroticism) + 0.1 * (pt.lambda - 1.0) - 0.2 * hi(bf.conscientiousness);
  
  let max_leverage_comfort = anchor.max_leverage_comfort != null ? anchor.max_leverage_comfort :
    0.5 + 0.4 * hi(bf.openness) - 0.3 * hi(bf.neuroticism) - 0.1 * (pt.lambda - 1.0);
    
  let funding_sensitivity = anchor.funding_sensitivity != null ? anchor.funding_sensitivity :
    0.4 + 0.5 * hi(bf.conscientiousness) - 0.2 * hi(bf.extraversion);
    
  liquidation_anxiety = r2(clamp(liquidation_anxiety + noise(), 0.05, 0.95));
  max_leverage_comfort = r2(clamp(max_leverage_comfort + noise(), 0.05, 0.95));
  funding_sensitivity = r2(clamp(funding_sensitivity + noise(), 0.05, 0.95));
  
  let deleveraging_style = anchor.deleveraging_style;
  if (!deleveraging_style) {
    if (bf.conscientiousness > 0.65 && liquidation_anxiety < 0.6) deleveraging_style = 'disciplined';
    else if (liquidation_anxiety > 0.7) deleveraging_style = 'panic';
    else if (bf.neuroticism < 0.3 && bf.conscientiousness < 0.4) deleveraging_style = 'hold-to-liquidation';
    else deleveraging_style = 'adaptive';
  }
  
  return { funding_sensitivity, liquidation_anxiety, max_leverage_comfort, deleveraging_style };
}


// Coherence-weighted quality score for the curation column (0..1). Rewards a
// clear dominant trait and a decisive style; mild noise keeps it non-uniform.
function qualityScore(rng, bf) {
  const dom = S.dominantTrait(bf);
  const base = 0.78 + 0.22 * Math.min(1, dom.dist * 2.4);
  return r2(clamp(base + (rng() - 0.5) * 0.08, 0.60, 0.98));
}

// Local tag builder (mirrors synth.buildTags, which is not exported) plus
// archetype tags; guarantees NO `batch-*` pollution and kebab-case output.
function buildTags(rng, domainKey, style, bf, extra = []) {
  const tags = new Set([domainKey, style]);
  for (const t of extra) if (t) tags.add(String(t).toLowerCase());
  const dom = S.dominantTrait(bf);
  const traitTag = {
    openness: bf.openness >= 0.5 ? 'open-minded' : 'conventional',
    conscientiousness: bf.conscientiousness >= 0.5 ? 'disciplined' : 'improviser',
    extraversion: bf.extraversion >= 0.5 ? 'outgoing' : 'reserved',
    agreeableness: bf.agreeableness >= 0.5 ? 'accommodating' : 'assertive',
    neuroticism: bf.neuroticism >= 0.5 ? 'anxious' : 'even-keeled',
  }[dom.trait];
  tags.add(traitTag);
  const flavor = ['decision-making', 'behavioral', 'risk', 'temperament', 'cognition', 'ipip-neo'];
  S.R.sample(rng, flavor, S.R.int(rng, 1, 2)).forEach((t) => tags.add(t));
  return Array.from(tags).filter((t) => /^[a-z0-9:-]+$/.test(t)).slice(0, 8);
}

// Sample a Big Five vector, honoring per-trait archetype anchors (tight noise
// around anchored traits, normal spread otherwise).
function sampleBigFive(rng, domainKey, anchor) {
  const skew = (S.DOMAINS[domainKey] && S.DOMAINS[domainKey].skew) || {};
  const bf = {};
  for (const t of TRAITS) {
    const a = anchor && anchor[t];
    const mean = a != null ? a : 0.5 + (skew[t] || 0);
    const sd = a != null ? 0.06 : 0.15;
    bf[t] = r2(clamp(S.R.gauss(rng, mean, sd), 0.03, 0.97));
  }
  return bf;
}

/*
 * buildFullProfile(rng, { domain?, archetype? }) -> { content, row, id }
 *   row  = a `profiles` insert row (big_five, mbti_label, decision_style,
 *          summary, tags, content, quality_score, status).
 *   content = the JSONB payload (adds dark_triad / prospect_theory /
 *          cognitive_reflection / suggested_biases on top of the synth item).
 */
function buildFullProfile(rng, opts = {}) {
  const arch = opts.archetype || null;
  const domainKey = (arch && arch.domain) || opts.domain || S.R.pick(rng, S.DOMAIN_KEYS);

  const bf = sampleBigFive(rng, domainKey, arch && arch.big_five);
  const style = (arch && arch.decision_style) || S.deriveDecisionStyle(rng, bf);
  const biases = S.chooseBiases(rng, bf);
  const summary = S.buildSummary(rng, bf, domainKey, style, biases);
  const mbti_label = S.deriveMbti(bf);

  const dark_triad = deriveDarkTriad(rng, bf, (arch && arch.dark_triad) || {});
  const prospect_theory = deriveProspectTheory(rng, bf, biases, {
    lambda: arch && arch.lambda != null ? arch.lambda : (arch && arch.prospect_theory && arch.prospect_theory.lambda),
    alpha: arch && arch.prospect_theory && arch.prospect_theory.alpha,
    beta: arch && arch.prospect_theory && arch.prospect_theory.beta,
  });
  const cognitive_reflection = deriveCognitive(rng, bf, {
    system: arch && arch.system, crt: arch && arch.crt,
  });

  const tags = buildTags(rng, domainKey, style, bf, (arch && arch.tags) || []);
  const quality_score = qualityScore(rng, bf);

  const leverage_profile = deriveLeverageProfile(rng, bf, prospect_theory, (arch && arch.leverage_profile) || {});

  const content = {
    big_five: bf,
    dark_triad,
    prospect_theory,
    cognitive_reflection,
    leverage_profile,
    summary,
    decision_style: style,
    mbti_label,
    suggested_biases: biases,
    tags,
    archetype: arch ? arch.key : null,
  };

  const id = uuid(rng);
  const row = {
    id,
    big_five: bf,
    mbti_label,
    decision_style: style,
    summary,
    tags,
    content,
    quality_score,
    status: 'approved',
  };
  return { id, content, row, domain: domainKey };
}

module.exports = {
  TRAITS, hi, lo, clamp, r2, uuid, sha256,
  deriveDarkTriad, deriveProspectTheory, deriveCognitive, deriveLeverageProfile, qualityScore,
  buildTags, sampleBigFive, buildFullProfile,
};
