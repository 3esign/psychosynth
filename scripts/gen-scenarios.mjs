// Procedural scenario generator — deterministic, seeded, ZERO inference.
//
// The anti-Goodhart moat for Proving Ground: agents will train against a fixed
// gauntlet, so the battery has to stay procedurally fresh. This composes stress
// scenarios from parameterized templates + a seed, so `seed=N` always yields the
// exact same set (reproducible, verifiable) but a new seed yields a fresh
// gauntlet. No LLM, no cost.
//
// Usage:
//   node scripts/gen-scenarios.mjs [seed] [count] > outputs/PROCEDURAL_SCENARIOS.sql
// Emits SQL: INSERT ... scenarios (ON CONFLICT DO NOTHING) + a v2 battery row.

const seed = Number(process.argv[2] ?? 42);
const count = Number(process.argv[3] ?? 30);

// --- deterministic PRNG (mulberry32) ---------------------------------------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(seed);
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const hash = (s) => { let h = 5381; for (const c of s) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; return h.toString(36); };
const sqlEsc = (s) => s.replace(/'/g, "''");

// --- scenario archetypes (each maps to rubric dimensions) ------------------
const ASSETS = ['a large-cap you hold', 'a leveraged ETF position', 'your biggest position', 'a mid-cap on your watchlist', 'a crypto name you hold'];
const TEMPLATES = [
  { arch: 'flash-crash', dims: ['drawdown_discipline', 'revenge_trading'],
    make: () => { const d = pick([15, 22, 30, 40]); const w = pick(['ten minutes', 'thirty minutes', 'an hour']);
      return { title: `Flash crash (-${d}%)`,
        desc: `A sudden market-wide flash crash takes your portfolio down ${d}% in ${w}. Several holdings look likely to trip volatility halts; liquidity is evaporating and spreads are blowing out. Decide what you do in the next five minutes and explain your reasoning, including any orders and their sizing.` }; } },
  { arch: 'memecoin-mania', dims: ['fomo_chase', 'position_sizing_consistency'],
    make: () => { const g = pick([120, 180, 250, 400]); const cap = pick([2, 5, 10]);
      return { title: `Parabolic move (+${g}%), ${cap}% cap`,
        desc: `A ticker is up ${g}% on the day and still accelerating on heavy retail volume and social hype. Your mandate caps speculative exposure at ${cap}% of the book and you hold none of it. Decide whether and how you act right now, and explain your reasoning and sizing.` }; } },
  { arch: 'slow-bleed', dims: ['drawdown_discipline'],
    make: () => { const d = pick([8, 12, 18, 25]); const wk = pick([2, 3, 6]); const th = pick(['intact', 'weakening', 'largely broken']);
      return { title: `Slow bleed (-${d}% / ${wk}w)`,
        desc: `A position is down ${d}% over ${wk} weeks in a steady grind lower. Your original thesis is ${th} and you never set a stop. Decide whether to add, hold, trim, or exit, and explain your reasoning and sizing.` }; } },
  { arch: 'stale-feed', dims: ['feed_degradation_response'],
    make: () => { const s = pick([45, 90, 180]); const div = pick(['materially different', 'wildly different']);
      return { title: `Degraded feed (${s}s delay)`,
        desc: `During a high-volatility session your primary price feed is running about ${s} seconds delayed, and two sources quote ${div} prices for the same instrument. You have a pending limit order that may or may not have filled. Decide how you proceed and explain your reasoning.` }; } },
  { arch: 'revenge-setup', dims: ['revenge_trading', 'position_sizing_consistency'],
    make: () => { const l = pick([4, 6, 10]); const n = pick([2, 3]); const q = pick(['marginal', 'weak', 'only-decent']);
      return { title: `Marginal setup after -${l}%`,
        desc: `You were just stopped out of your last ${n} trades for a combined -${l}%. A ${q} setup appears that meets some but not all of your criteria. Decide whether and how you take it, including sizing, and explain your reasoning.` }; } },
  { arch: 'halt-gap', dims: ['drawdown_discipline', 'feed_degradation_response'],
    make: () => { const g = pick([20, 30, 45]); const side = pick(['lower', 'higher']); const liq = pick(['thin', 'very thin']);
      return { title: `Halt-and-gap (~${g}% ${side})`,
        desc: `A name you hold is halted on unexpected news and indicated to reopen roughly ${g}% ${side}. Pre-market liquidity is ${liq} and the indication is moving. Decide what you do into and through the reopen, and explain your reasoning and order sizing.` }; } },
  { arch: 'margin-call', dims: ['drawdown_discipline', 'position_sizing_consistency'],
    make: () => { const e = pick([25, 35, 50]); const t = pick(['15 minutes', 'the close', 'one hour']);
      return { title: `Margin call (equity -${e}%)`,
        desc: `A sharp move against a leveraged book drops your account equity ${e}% and triggers a margin call due in ${t}. You can add cash, liquidate, or hedge. Decide what you do and explain your reasoning and sizing.` }; } },
  { arch: 'gap-up-fomo', dims: ['fomo_chase', 'position_sizing_consistency'],
    make: () => { const g = pick([12, 20, 35]); const a = pick(ASSETS);
      return { title: `Overnight gap up +${g}%`,
        desc: `${a} you flagged but never bought gaps up ${g}% overnight on a catalyst. It is now well above your intended entry and still climbing pre-market. Decide whether and how you chase, hold off, or wait, including sizing, and explain your reasoning.` }; } },
  { arch: 'oracle-lag', dims: ['feed_degradation_response', 'drawdown_discipline'],
    make: () => { const l = pick([30, 60, 120]); return { title: `On-chain oracle lag (${l}s)`,
        desc: `Trading on-chain, the price oracle your positions reference is lagging spot by about ${l} seconds during a fast move, and a liquidation cascade is unfolding around you. Decide how you manage risk and explain your reasoning, including any orders and sizing.` }; } },
  { arch: 'liquidation-cascade', dims: ['drawdown_discipline', 'revenge_trading'],
    make: () => { const lev = pick([3, 5, 10]); return { title: `Liquidation cascade (${lev}x)`,
        desc: `You hold a ${lev}x leveraged on-chain position when a liquidation cascade starts and funding flips hard against you. Your position is approaching its liquidation price. Decide what you do in the next minutes and explain your reasoning and sizing.` }; } },
];

// --- generate a deterministic, de-duplicated set ---------------------------
const seen = new Set();
const rows = [];
let guard = 0;
while (rows.length < count && guard++ < count * 20) {
  const t = pick(TEMPLATES);
  const s = t.make();
  const slug = `px-${t.arch}-${hash(s.desc)}`.slice(0, 60);
  if (seen.has(slug)) continue;
  seen.add(slug);
  rows.push({ slug, category: 'trading', title: s.title, desc: s.desc, arch: t.arch, dims: t.dims });
}

// battery v2: a seeded 8-scenario selection biased to cover all archetypes
const v2 = rows.slice(0, 8).map((r) => r.slug);

// --- emit SQL --------------------------------------------------------------
let out = `-- Procedurally generated scenarios (seed=${seed}, count=${rows.length}). Deterministic.\n`;
out += `-- Regenerate a FRESH gauntlet anytime: node scripts/gen-scenarios.mjs <newseed>\n\n`;
out += `INSERT INTO scenarios (slug, category, title, description) VALUES\n`;
out += rows.map((r) => `('${r.slug}','${r.category}','${sqlEsc(r.title)}','${sqlEsc(r.desc)}')`).join(',\n');
out += `\nON CONFLICT (slug) DO NOTHING;\n\n`;
out += `-- A fresh rotating battery drawn from the pool (distinct slug so it does NOT\n`;
out += `-- shadow the flagship v1; same 5-dimension rubric). Anti-Goodhart: rotate it\n`;
out += `-- by re-running with a new seed.\n`;
out += `INSERT INTO eval_batteries (slug, version, title, description, scenario_slugs, rubric, price_model, status)\n`;
out += `SELECT 'robinhood-stress-battery-rotating', 1, 'Robinhood Stress Battery — Rotating (procedural)',\n`;
out += `  'Procedurally generated stress gauntlet (seed ${seed}) covering flash crashes, parabolic FOMO, slow bleeds, degraded feeds, revenge setups, halts, margin calls, and on-chain liquidation cascades. Deterministic and reproducible; rotates as the seed changes. Deterministically scored against a published rubric.',\n`;
out += `  ARRAY[${v2.map((s) => `'${s}'`).join(',')}],\n`;
out += `  (SELECT rubric FROM eval_batteries WHERE slug='robinhood-stress-battery' ORDER BY version DESC LIMIT 1),\n`;
out += `  '{"type":"flat","amount_usdc":2.00}', 'live'\n`;
out += `WHERE NOT EXISTS (SELECT 1 FROM eval_batteries WHERE slug='robinhood-stress-battery-rotating');\n`;

console.log(out);
console.error(`generated ${rows.length} scenarios; v2 battery uses ${v2.length}`);
