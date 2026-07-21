// Procedural persona generator — deterministic, seeded, ZERO inference.
// Deepens the Robinhood Counterparty Pack with varied retail personas built from
// archetype trait templates + seeded jitter + composed summaries. Same seed =>
// same personas. Tags include robinhood + retail-trading so they match the pack.
//
// Usage: node scripts/gen-personas.mjs [seed] [perArchetype] > outputs/PROCEDURAL_PERSONAS.sql

const seed = Number(process.argv[2] ?? 7);
const per = Number(process.argv[3] ?? 4);

function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
const rng = mulberry32(seed);
const clamp = (n) => Math.min(0.95, Math.max(0.05, Math.round(n * 100) / 100));
const jit = (base, d = 0.08) => clamp(base + (rng() * 2 - 1) * d);
const pick = (a) => a[Math.floor(rng() * a.length)];
const esc = (s) => s.replace(/'/g, "''");
const mbti = (b) => (b.extraversion > 0.5 ? 'E' : 'I') + (b.openness > 0.5 ? 'N' : 'S') + (b.agreeableness > 0.5 ? 'F' : 'T') + (b.conscientiousness > 0.5 ? 'J' : 'P');

// archetype: base traits, lambda, style, biases, and summary fragment pools
const A = [
  { tag: 'panic-seller', style: 'avoidant', lam: 2.7, bf: { openness: .45, conscientiousness: .38, extraversion: .42, agreeableness: .55, neuroticism: .78 }, bias: ['loss-aversion', 'ostrich-effect'],
    entry: ['Enters cautiously and small', 'Waits for obvious confirmation before buying'], stress: ['bails at the first sign of red', 'liquidates into any sharp drawdown'], tell: ['checks the P&L compulsively', 'cannot look when the book is red'] },
  { tag: 'revenge-trader', style: 'intuitive', lam: 2.6, bf: { openness: .55, conscientiousness: .32, extraversion: .6, agreeableness: .4, neuroticism: .76 }, bias: ['loss-aversion', 'sunk-cost'],
    entry: ['Sizes up quickly after a loss', 'Trades bigger to get even'], stress: ['doubles down on losers to justify the entry', 'chases the loss with more size'], tell: ['trades hardest right after a stop-out', 'confuses being right with being whole'] },
  { tag: 'meme-chaser', style: 'spontaneous', lam: 1.4, bf: { openness: .84, conscientiousness: .32, extraversion: .74, agreeableness: .45, neuroticism: .6 }, bias: ['fomo', 'herd-behavior'],
    entry: ['Chases whatever is trending', 'Enters late into parabolic moves'], stress: ['adds into the vertical move', 'refuses to miss the run'], tell: ['trades the feed, not the thesis', 'lives for the excitement'] },
  { tag: 'disciplined-swing', style: 'analytical', lam: 1.9, bf: { openness: .6, conscientiousness: .8, extraversion: .45, agreeableness: .5, neuroticism: .36 }, bias: ['confirmation', 'anchoring'],
    entry: ['Enters on a rules-based signal', 'Sizes consistently against a plan'], stress: ['honors predefined stops', 'trims into strength by rule'], tell: ['over-weights confirming evidence', 'journals every trade'] },
  { tag: 'options-gambler', style: 'spontaneous', lam: 1.3, bf: { openness: .8, conscientiousness: .35, extraversion: .7, agreeableness: .36, neuroticism: .64 }, bias: ['overconfidence', 'gamblers-fallacy'],
    entry: ['Buys short-dated options for the payoff', 'Bets on the binary event'], stress: ['expects a reversal after any streak', 'presses the bet when it moves'], tell: ['overrates its own edge', 'treats variance as skill'] },
  { tag: 'conservative-hodler', style: 'deliberative', lam: 2.2, bf: { openness: .42, conscientiousness: .8, extraversion: .36, agreeableness: .6, neuroticism: .3 }, bias: ['status-quo', 'endowment'],
    entry: ['Buys quality and holds', 'Rarely trades, adds slowly'], stress: ['sits through volatility unmoved', 'is slow to rebalance even when it helps'], tell: ['values the position above the market', 'prefers the current allocation'] },
  { tag: 'copy-trader', style: 'dependent', lam: 1.8, bf: { openness: .45, conscientiousness: .45, extraversion: .58, agreeableness: .72, neuroticism: .58 }, bias: ['herd-behavior', 'authority-bias'],
    entry: ['Mirrors popular traders', 'Enters when the accounts it follows do'], stress: ['exits a beat behind the crowd', 'defers to loud authority'], tell: ['trades social proof over analysis', 'always a step late'] },
  { tag: 'news-reactor', style: 'intuitive', lam: 2.1, bf: { openness: .6, conscientiousness: .4, extraversion: .65, agreeableness: .5, neuroticism: .68 }, bias: ['recency', 'availability'],
    entry: ['Trades the headline reflexively', 'Reacts before the dust settles'], stress: ['overweights the latest vivid story', 'flips on every new print'], tell: ['anchors to whatever is most recent', 'mistakes noise for signal'] },
  { tag: 'scalper', style: 'intuitive', lam: 1.7, bf: { openness: .55, conscientiousness: .65, extraversion: .6, agreeableness: .42, neuroticism: .55 }, bias: ['recency', 'disposition-effect'],
    entry: ['Scalps intraday for small edges', 'Takes many quick shots'], stress: ['cuts winners early for small gains', 'occasionally lets a loser run'], tell: ['realizes gains too fast', 'holds losers hoping for scratch'] },
  { tag: 'yield-chaser', style: 'dependent', lam: 1.9, bf: { openness: .52, conscientiousness: .58, extraversion: .5, agreeableness: .55, neuroticism: .52 }, bias: ['herd-behavior', 'authority-bias'],
    entry: ['Chases the highest advertised yield', 'Trusts popular picks'], stress: ['ignores the underlying risk for the number', 'follows the loudest expert'], tell: ['confuses yield with safety', 'reaches for return'] },
];

const rows = [];
for (const a of A) {
  for (let i = 0; i < per; i++) {
    const bf = { openness: jit(a.bf.openness), conscientiousness: jit(a.bf.conscientiousness), extraversion: jit(a.bf.extraversion), agreeableness: jit(a.bf.agreeableness), neuroticism: jit(a.bf.neuroticism) };
    const lam = Math.round((a.lam + (rng() * 0.6 - 0.3)) * 100) / 100;
    const summary = `${pick(a.entry)} and ${pick(a.stress)}. ${pick(a.tell).charAt(0).toUpperCase()}${pick(a.tell).slice(1)}.`;
    const ml = mbti(bf);
    const content = { big_five: bf, prospect_theory: { lambda: lam, alpha: 0.88, beta: 0.88 }, cognitive_reflection: { system_preference: bf.conscientiousness > 0.6 ? 'system2' : 'system1', crt_score: Math.round(bf.conscientiousness * 100) / 100 }, summary, decision_style: a.style, mbti_label: ml, suggested_biases: a.bias.map((s, j) => ({ slug: s, strength: j === 0 ? 0.7 : 0.55 })), tags: ['trading', 'retail-trading', 'robinhood', a.tag] };
    rows.push({ content, bf, ml, style: a.style, summary, tag: a.tag });
  }
}

let out = `-- Procedurally generated retail personas (seed=${seed}, ${rows.length} rows). Deterministic, zero-inference.\n`;
out += `-- Tagged robinhood + retail-trading so they join the Counterparty Pack.\n\n`;
out += `INSERT INTO profiles (content, big_five, mbti_label, decision_style, summary, tags, status, quality_score) VALUES\n`;
out += rows.map((r) => {
  const c = JSON.stringify(r.content); const bf = JSON.stringify(r.bf);
  const tags = `ARRAY['trading','retail-trading','robinhood','${r.tag}']`;
  return `('${esc(c)}','${esc(bf)}','${r.ml}','${r.style}','${esc(r.summary)}',${tags},'approved',0.80)`;
}).join(',\n');
out += `;\n`;
console.log(out);
console.error(`generated ${rows.length} personas across ${A.length} archetypes`);
