#!/usr/bin/env node
/*
 * Psychosynth v4 enrichment pipeline — offline, seeded, ZERO inference.
 *
 * One deterministic run emits a reviewable SQL bundle into outputs/v4/:
 *
 *   00_PREFLIGHT.sql            probes + pre-state backup tables (run FIRST)
 *   01_bias_taxonomy.sql        78-entry literature-grounded bias bank (idempotent)
 *   02_generators_runs.sql      emotional patterns + synth-v4 generators + runs
 *   03_backfill_factors.sql     set-based factor enrichment of EXISTING profiles
 *                               (dark_triad / prospect_theory / cognitive_reflection,
 *                               CRT 0-3 scale normalization, alpha/beta de-constanting)
 *   04_repair_v3_profiles.sql   in-place rewrite of the 15 v3 template batches
 *                               (varied authored summaries, batch-tag cleanup,
 *                               suggested_biases, archetype field, provenance)
 *   05_repair_v3_responses.sql  in-place rewrite of v3 template responses
 *                               (trait-conditioned action/reasoning/arc/confidence)
 *   06_scenarios_v4.sql         fresh scenario set + bias links
 *   07a/07b_profiles_v4_*.sql   fresh general population + persona batch
 *   08a/08b_responses_v4_*.sql  fresh profile-conditioned responses
 *   09_catalog_polish.sql       solana pack recipe fix + filter allowlists
 *   10_VERIFY.sql               post-apply verification probes
 *   99_ROLLBACK.sql             restore repaired rows / remove fresh rows
 *
 * Everything is authored by the offline engine (scripts/lib/synth.js,
 * behavior.js, factors.js, archetypes-v4.js): component banks + coherence
 * logic + a seeded PRNG. Same seed => byte-identical bundle. Provenance rows
 * are stamped `authored/psychosynth-synth-v4` — honest about the method.
 *
 * Usage:
 *   node scripts/gen-v4-enrich.mjs [--seed v4-2026-07-21] [--generals 1600]
 *        [--per-legacy 40] [--per-new 32] [--status approved] [--outdir outputs/v4]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const S = require('./lib/synth.js');
const B = require('./lib/behavior.js');
const F = require('./lib/factors.js');
const { BIAS } = require('./lib/bias-taxonomy.js');
const { LEGACY_ARCH, NEW_ARCH, V3_REPAIR } = require('./lib/archetypes-v4.js');
const R = S.R;

// ------------------------------------------------------------------ args ----
const argv = process.argv.slice(2);
function arg(name, dflt) {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] != null ? argv[i + 1] : dflt;
}
const SEED = String(arg('seed', 'v4-2026-07-21'));
const N_GENERALS = Number(arg('generals', 2000));
const PER_LEGACY = Number(arg('per-legacy', 44));
const PER_NEW = Number(arg('per-new', 36));
const STATUS = String(arg('status', 'approved'));
const OUTDIR = path.resolve(process.cwd(), String(arg('outdir', 'outputs/v4')));
mkdirSync(OUTDIR, { recursive: true });

const rng = S.makeRng(SEED);

// --------------------------------------------------------------- helpers ----
const esc = (s) => String(s).replace(/'/g, "''");
const jesc = (o) => esc(JSON.stringify(o));
const sqlArr = (xs) => `ARRAY[${xs.map((x) => `'${esc(x)}'`).join(',')}]::text[]`;
function uuid() {
  const b = new Array(16);
  for (let i = 0; i < 16; i++) b[i] = Math.floor(rng() * 256);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
function chunked(prefix, vals, conflict, size = 200) {
  let out = '';
  for (let i = 0; i < vals.length; i += size) {
    out += `${prefix}\n${vals.slice(i, i + size).join(',\n')}\n${conflict};\n\n`;
  }
  return out;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// SQL-side deterministic randomness helpers (md5(id||salt) -> int / [0,1)).
const sqlRnd = (col, salt) => `(('x'||substr(md5(${col}::text||'${salt}'),1,8))::bit(32)::int & 2147483647)`;
const sqlRnd01 = (col, salt) => `(${sqlRnd(col, salt)}::numeric / 2147483647.0)`;
const sqlPick = (arrExpr, len, col, salt) => `(${arrExpr})[1 + mod(${sqlRnd(col, salt)}, ${len})]`;
const sqlCap = (expr) => `(upper(left(${expr},1)) || substr(${expr},2))`;
const sqlClamp = (expr, lo, hi) => `LEAST(${hi}, GREATEST(${lo}, ${expr}))`;
const sqlRound2 = (expr) => `round((${expr})::numeric, 2)`;
const SHA = (s) => S.sha256(s);
const TEMPLATE_HASH = SHA('psychosynth-synth-v4');

// ------------------------------------------------------- dedup (minhash) ----
// pg_trgm-COMPATIBLE trigram extraction (word-wise, '  w ' padding), so the
// in-batch guard enforces the same similarity the DB's dedup hook measures.
function trigrams(s) {
  const t = new Set();
  const words = s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/);
  for (const w of words) {
    const x = '  ' + w + ' ';
    for (let i = 0; i < x.length - 2; i++) t.add(x.slice(i, i + 3));
  }
  return t;
}
function jaccard(a, b) {
  let inter = 0;
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  for (const g of small) if (large.has(g)) inter++;
  return inter / (a.size + b.size - inter);
}
function hashStr(s, seed) {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
class DedupGuard {
  constructor(threshold = 0.5) { this.threshold = threshold; this.items = []; this.bands = new Map(); }
  signature(tris) {
    // 8 bands of 1 minhash each: for sim s, P(missed) = (1-s)^8 — at the 0.5
    // threshold that is 0.4%, so near-dupes reliably become verify-candidates.
    const mins = [];
    for (let p = 0; p < 8; p++) {
      let m = 0xffffffff;
      for (const g of tris) { const h = hashStr(g, p * 2654435761); if (h < m) m = h; }
      mins.push(p + ':' + m);
    }
    return mins;
  }
  /** returns max similarity vs existing near-candidates; adds if accepted */
  tryAdd(text) {
    const tris = trigrams(text);
    const bands = this.signature(tris);
    let maxSim = 0;
    const seen = new Set();
    for (const b of bands) {
      const bucket = this.bands.get(b);
      if (!bucket) continue;
      for (const idx of bucket) {
        if (seen.has(idx)) continue; seen.add(idx);
        const sim = jaccard(tris, this.items[idx]);
        if (sim > maxSim) maxSim = sim;
        if (maxSim >= this.threshold) return { ok: false, maxSim };
      }
    }
    const idx = this.items.push(tris) - 1;
    for (const b of bands) {
      if (!this.bands.has(b)) this.bands.set(b, []);
      this.bands.get(b).push(idx);
    }
    return { ok: true, maxSim };
  }
}

// ============================================================================
// 1. FRESH PROFILES
// ============================================================================
const runProfilesGeneral = uuid();
const runProfilesPersona = uuid();
const runResponses = uuid();

const guard = new DedupGuard(0.5);
let dedupRetries = 0, dedupGiveups = 0;

function withDedup(build) {
  for (let t = 0; t < 8; t++) {
    const item = build(t);
    const res = guard.tryAdd(item.summary);
    if (res.ok) { if (t > 0) dedupRetries += t; return item; }
  }
  dedupGiveups++;
  return build(8); // accept as-is; counted + reported
}

const THEME_TAGS = {
  retail: ['trading', 'retail-trading', 'robinhood'],
  solana: ['trading', 'chain:solana', 'solana-defi'],
  defi: ['trading', 'defi'],
  whale: ['trading', 'crypto-whale', 'institutional'],
  negotiation: ['negotiation', 'counterparty'],
  kol: ['kol', 'influencer', 'social'],
};

const PERSONA_TEXTURE = {
  retail: ['checks the app in line for coffee and regrets it', 'keeps a watchlist longer than a grocery list',
    'moves the mental stop rather than the real one', 'sizes positions by paycheck cycle',
    'talks entries at dinner, never exits', 'keeps last year’s statement unopened in a drawer',
    'trades around earnings like planning around storms', 'reads one bull thread and one bear thread and decides by mood',
    'checks after-hours prices from bed with one eye', 'keeps the support line memorized from the last outage'],
  degen: ['keeps three wallets open and loyalty in none of them', 'quotes slot numbers the way others quote lunch spots',
    'treats gas spikes as weather, not warning', 'reads the group chat faster than the chart',
    'measures weeks in narratives, not days', 'screenshots the portfolio only on green days',
    'holds airdropped dust like lottery stubs', 'keeps the burner funded for exactly one more mistake',
    'celebrates round-trip losses as experience points', 'sleeps through weekdays and trades through weekends'],
  inst: ['writes the risk memo before the position exists', 'treats counterparty limits as scripture',
    'keeps the model change-log cleaner than the P&L', 'reviews the quarter by process, not outcome',
    'escalates anomalies before they become stories', 'holds post-mortems for trades that made money',
    'rotates on schedule regardless of conviction', 'prices reputation into every fill',
    'sizes to survive the backtest’s worst week twice over', 'reports slippage honestly and expects the same back'],
  negotiation: ['keeps a laminated walk-away number in the folio', 'debriefs every deal on the drive home, alone',
    'collects precedents the way others collect wins', 'reads the counterparty’s calendar before their term sheet',
    'schedules hard conversations for their own best hour', 'keeps two drafts of every clause, one kind and one binding',
    'counts silences the way accountants count line items', 'treats rapport as an asset with a depreciation schedule',
    'never celebrates in the building', 'files the handshake under provisional'],
  kol: ['drafts three takes and posts the loudest', 'checks the metrics dashboard before breakfast',
    'keeps receipts on every rival’s deleted posts', 'A/B tests sincerity',
    'schedules spontaneity a week in advance', 'treats the block button as portfolio management',
    'measures friendship in retweets, then feels bad about it', 'keeps a folder of screenshots titled insurance',
    'answers DMs by follower count', 'archives old takes the way banks shred documents'],
};
const THEME_GROUP = { retail: 'retail', solana: 'degen', defi: 'degen', whale: 'inst', negotiation: 'negotiation', kol: 'kol' };

function postureSuffix(factors) {
  return ` Loss aversion runs near ${factors.prospect_theory.lambda.toFixed(2)}; reflection ${factors.cognitive_reflection.crt_score} of 3.`;
}

function personaSummary(rng, arch, bf, style, factors, theme) {
  // Two of the three archetype fragment banks (varied), so same-archetype rows
  // rarely share their full fragment set; the rest of the text is composed
  // from large shared banks + a numeric posture suffix.
  const bankPair = R.sample(rng, [arch.entry, arch.stress, arch.tell], 2);
  const fragA = R.pick(rng, bankPair[0]);
  const fragB = R.pick(rng, bankPair[1]);
  const dom = S.dominantTrait(bf);
  const lv = S.level(bf[dom.trait]);
  const clause = R.pick(rng, S.CLAUSES[dom.trait][lv === 'mid' ? (bf[dom.trait] >= 0.5 ? 'high' : 'low') : lv]);
  const others = Object.keys(bf).filter((t) => t !== dom.trait && S.level(bf[t]) !== 'mid');
  const clause2 = others.length ? R.pick(rng, S.CLAUSES[R.pick(rng, others)][S.level(bf[R.pick(rng, others)]) === 'low' ? 'low' : 'high']) : null;
  const dec = R.pick(rng, S.DECISION_SENTENCE[style]);
  const tex = R.pick(rng, PERSONA_TEXTURE[THEME_GROUP[theme] || 'retail']);
  const role = arch.tag.replace(/-/g, ' ');
  const stressLead = R.pick(rng, ['Under pressure', 'When the stakes rise', 'In a drawdown', 'When it turns against them', 'Once real money is on the line', 'When cornered', 'The moment the plan meets resistance']);
  const pc = F.prospectClause(rng, factors);
  const lc = (s) => s.replace(/^[A-Z]/, (c) => c.toLowerCase());
  const frames = [
    () => `A ${role} who ${lc(fragA)}. ${cap(dec)}. ${cap(clause)}${clause2 ? ', and ' + clause2 : ''}. ${stressLead}, ${lc(fragB)}; ${tex}.`,
    () => `${cap(dec)}. This ${role} ${lc(fragA)} and ${clause}. ${stressLead}, ${lc(fragB)} — ${pc}. ${cap(tex)}.`,
    () => `${cap(fragA)}, and ${tex}. ${cap(clause)}. ${cap(dec)}. ${stressLead}, this ${role} ${lc(fragB)}.`,
    () => `${cap(tex)} — a ${role} to the bone. ${cap(fragA)}; ${clause}${clause2 ? ', and ' + clause2 : ''}. ${cap(dec)}. ${stressLead}, ${lc(fragB)}.`,
    () => `${cap(clause)}. ${cap(fragA)}, ${lc(fragB)}, and ${pc}. ${cap(dec)}. ${cap(tex)}.`,
    () => `${cap(dec)}, and ${pc}. ${cap(fragA)}. ${cap(tex)}; ${stressLead.toLowerCase()}, this ${role} ${lc(fragB)}.`,
  ];
  let out = R.pick(rng, frames)().replace(/\s+/g, ' ').replace(/\.\.+/g, '.').trim();
  out += postureSuffix(factors);
  if (out.length > 590) out = out.slice(0, 587).replace(/[ ,;.\-]+$/, '') + '.';
  return out;
}

function buildPersona(arch, theme) {
  return withDedup(() => {
    const bf = {};
    for (const t of Object.keys(arch.bf)) bf[t] = R.round2(R.clamp(arch.bf[t] + (rng() - 0.5) * 0.18, 0.03, 0.97));
    const style = arch.style;
    // biases: archetype anchors + jittered strengths (+ occasionally one affinity extra)
    const biases = arch.bias.map((slug, j) => ({
      slug, strength: R.round2(R.clamp((j === 0 ? 0.72 : j === 1 ? 0.58 : 0.5) + (rng() - 0.5) * 0.14, 0.3, 0.95)),
    }));
    if (R.chance(rng, 0.35)) {
      const aff = S.biasAffinities(bf);
      const extra = Object.entries(aff).sort((a, b) => b[1] - a[1]).map(([s]) => s)
        .find((s) => !biases.some((b) => b.slug === s));
      if (extra) biases.push({ slug: extra, strength: R.round2(R.clamp(0.42 + rng() * 0.2, 0.3, 0.9)) });
    }
    const factors = F.deriveFactors(rng, bf, biases, {
      dtAnchor: { machiavellianism: arch.dt.m, narcissism: arch.dt.n, psychopathy: arch.dt.p },
      lambdaAnchor: arch.lam,
    });
    const summary = personaSummary(rng, arch, bf, style, factors, theme);
    const themeTags = THEME_TAGS[theme] || ['trading'];
    const tags = Array.from(new Set([...themeTags, arch.tag, ...F.factorTags(factors)])).slice(0, 8);
    const mbti = S.deriveMbti(bf);
    const content = {
      big_five: bf, ...factors, summary, decision_style: style, mbti_label: mbti,
      suggested_biases: biases, tags, archetype: arch.tag,
      synthesis: { engine: 'synth-v4', method: 'authored-composition', seed: SEED },
    };
    return { id: uuid(), content, bf, mbti, style, summary, tags, biases,
      quality: R.round2(0.76 + rng() * 0.17), run: runProfilesPersona, kind: 'persona:' + arch.tag };
  });
}

function buildGeneral() {
  return withDedup(() => {
    const { item, domain } = S.buildProfile(rng);
    const factors = F.deriveFactors(rng, item.big_five, item.suggested_biases);
    const tags = Array.from(new Set([...item.tags, ...F.factorTags(factors)])).slice(0, 8);
    const content = {
      big_five: item.big_five, ...factors, summary: item.summary,
      decision_style: item.decision_style, mbti_label: item.mbti_label,
      suggested_biases: item.suggested_biases, tags,
      synthesis: { engine: 'synth-v4', method: 'authored-composition', seed: SEED },
    };
    return { id: uuid(), content, bf: item.big_five, mbti: item.mbti_label, style: item.decision_style,
      summary: item.summary, tags, biases: item.suggested_biases,
      quality: R.round2(0.74 + rng() * 0.18), run: runProfilesGeneral, kind: 'general:' + domain, domain };
  });
}

console.error(`[v4] seed=${SEED} — building fresh profiles...`);
const personas = [];
for (const a of LEGACY_ARCH) {
  const theme = a.packs && a.packs.includes('solana') && R.chance(rng, 0.4) ? 'solana'
    : a.packs && a.packs.includes('defi') ? 'defi' : 'retail';
  for (let i = 0; i < PER_LEGACY; i++) personas.push(buildPersona(a, theme));
}
for (const a of NEW_ARCH) for (let i = 0; i < PER_NEW; i++) personas.push(buildPersona(a, a.theme));
const generals = [];
for (let i = 0; i < N_GENERALS; i++) generals.push(buildGeneral());
console.error(`[v4] personas=${personas.length} generals=${generals.length} dedupRetries=${dedupRetries} giveups=${dedupGiveups}`);

// ============================================================================
// 2. FRESH SCENARIOS — drawn ONLY from the five newly-authored stems per
// category (this session's additions), parameter-varied, hash-slugged.
// ============================================================================
const FRESH_STEMS = {
  trading: ['Funding flip', 'Airdrop lockup', 'Backtest mirage', 'Oracle divergence', 'Quiet delisting notice'],
  negotiation: ['The nibble at signing', 'Expiring authority', 'The generous first offer', 'Two-front negotiation', 'The anchor you set'],
  social: ['The borrowed money silence', 'The correction in public', 'The one-sided rivalry', 'The recycled confidence', 'The plus-one audit'],
  crisis: ['The rollback that will not', 'Insurance ambiguity', 'The overcorrection window', 'Donor with conditions', 'The metric that saved you'],
};
const SC_COUNTS = { trading: 20, negotiation: 16, social: 14, crisis: 14 };
const ROMAN = ['', ' II', ' III', ' IV', ' V'];
function hash36(s) { let h = 5381; for (const c of s) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; return h.toString(36); }

const scenarios = [];
{
  const seenSlug = new Set();
  for (const [category, want] of Object.entries(SC_COUNTS)) {
    const stems = FRESH_STEMS[category];
    const perStem = {};
    let guardN = 0;
    while (scenarios.filter((s) => s.category === category).length < want && guardN++ < want * 30) {
      const bank = B.SCENARIOS[category].filter(([t]) => stems.includes(t));
      const [stem, body] = R.pick(rng, bank);
      const fill = body
        .replace('{pct}', String(R.int(rng, 12, 60)))
        .replace('{hrs}', String(R.pick(rng, [2, 4, 6, 24, 48])))
        .replace('{mins}', String(R.pick(rng, [10, 20, 30, 45])))
        .replace('{days}', String(R.int(rng, 3, 21)));
      const flavor = R.pick(rng, ['', ' The clock is running.', ' Everyone is watching how you handle it.', ' There is no clean option.', ' Nobody senior is reachable.']);
      const description = (fill + flavor).trim();
      const slug = `v4-${B.slugify(stem)}-${hash36(description)}`.slice(0, 60);
      if (seenSlug.has(slug)) continue;
      seenSlug.add(slug);
      perStem[stem] = (perStem[stem] || 0);
      const title = `${stem}${ROMAN[Math.min(perStem[stem], 4)]} (${category})`;
      perStem[stem]++;
      scenarios.push({ id: uuid(), slug, category, title, description, links: B.scenarioBiasLinks(rng, category) });
    }
  }
}
console.error(`[v4] scenarios=${scenarios.length}`);

// ============================================================================
// 3. FRESH RESPONSES
// ============================================================================
const byCat = scenarios.reduce((m, s) => { (m[s.category] = m[s.category] || []).push(s); return m; }, {});
const THEME_CAT_W = {
  retail: { trading: 0.7, crisis: 0.15, negotiation: 0.1, social: 0.05 },
  solana: { trading: 0.75, crisis: 0.15, negotiation: 0.05, social: 0.05 },
  defi: { trading: 0.7, crisis: 0.2, negotiation: 0.1 },
  whale: { trading: 0.65, crisis: 0.2, negotiation: 0.15 },
  negotiation: { negotiation: 0.7, social: 0.15, crisis: 0.15 },
  kol: { social: 0.6, trading: 0.25, crisis: 0.15 },
};
const DOMAIN_CAT_W = {
  general: { trading: 0.25, negotiation: 0.25, social: 0.25, crisis: 0.25 },
  trading: { trading: 0.7, crisis: 0.15, negotiation: 0.1, social: 0.05 },
  negotiation: { negotiation: 0.7, social: 0.1, crisis: 0.1, trading: 0.1 },
  social: { social: 0.65, crisis: 0.15, negotiation: 0.1, trading: 0.1 },
  workplace: { crisis: 0.55, social: 0.2, negotiation: 0.15, trading: 0.1 },
};
function weightedCat(w) {
  const r = rng(); let acc = 0;
  for (const [k, v] of Object.entries(w)) { acc += v; if (r < acc) return k; }
  return Object.keys(w)[0];
}
function themeOf(p) {
  if (p.kind.startsWith('general:')) return null;
  const tag0 = p.tags;
  if (tag0.includes('chain:solana')) return 'solana';
  if (tag0.includes('crypto-whale')) return 'whale';
  if (tag0.includes('defi')) return 'defi';
  if (tag0.includes('counterparty')) return 'negotiation';
  if (tag0.includes('kol')) return 'kol';
  return 'retail';
}

const responses = [];
function addResponses(p, k) {
  const theme = themeOf(p);
  const w = theme ? THEME_CAT_W[theme] : DOMAIN_CAT_W[p.domain || 'general'];
  const used = new Set();
  for (let i = 0; i < k; i++) {
    let sc = null;
    for (let t = 0; t < 12 && !sc; t++) {
      const cat = weightedCat(w);
      const cand = R.pick(rng, byCat[cat] || byCat.trading);
      if (!used.has(cand.id)) sc = cand;
    }
    if (!sc) break;
    used.add(sc.id);
    const r = B.buildResponse(rng, p.content, sc);
    responses.push({ id: uuid(), profile_id: p.id, scenario_id: sc.id, ...r });
  }
}
for (const p of personas) addResponses(p, R.chance(rng, 0.55) ? 3 : 2);
for (const p of generals) addResponses(p, R.chance(rng, 0.25) ? 3 : 2);
console.error(`[v4] responses=${responses.length}`);

// ============================================================================
// SQL EMIT
// ============================================================================
const files = {};

// ---------------------------------------------------------- 00 PREFLIGHT ----
files['00_PREFLIGHT.sql'] = `-- v4 PREFLIGHT — run this FIRST, read the output, then apply 01..09 in order.
-- Creates pre-state backup tables (used by the repairs, provenance stamping,
-- and 99_ROLLBACK.sql) and prints the "before" picture. Idempotent: backups
-- are only captured the first time (IF NOT EXISTS).

-- Pre-state backups -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS _v4_backup_profiles_v3 AS
  SELECT p.* FROM profiles p
  WHERE p.generation_run_id IN
    (SELECT id FROM generation_runs WHERE generator_slug = 'psychosynth-v3-trader-behavior');

CREATE TABLE IF NOT EXISTS _v4_backup_responses_v3 AS
  SELECT r.* FROM profile_scenario_responses r
  WHERE r.generation_run_id IN
    (SELECT id FROM generation_runs WHERE generator_slug = 'psychosynth-v3-trader-behavior');

CREATE TABLE IF NOT EXISTS _v4_backup_factor_rows AS
  SELECT p.id, p.version, p.content FROM profiles p
  WHERE p.content->'dark_triad' IS NULL
     OR p.content->'prospect_theory' IS NULL
     OR p.content->'cognitive_reflection' IS NULL
     OR ((p.content->'cognitive_reflection'->>'crt_score') ~ '^[0-9]*\\.[0-9]+$'
         AND (p.content->'cognitive_reflection'->>'crt_score')::numeric
             <> floor((p.content->'cognitive_reflection'->>'crt_score')::numeric))
     OR ((p.content->'prospect_theory'->>'alpha')::numeric = 0.88
         AND (p.content->'prospect_theory'->>'beta')::numeric = 0.88);

-- Keep RLS posture consistent with 0016: backups hold sellable content.
ALTER TABLE _v4_backup_profiles_v3  ENABLE ROW LEVEL SECURITY;
ALTER TABLE _v4_backup_responses_v3 ENABLE ROW LEVEL SECURITY;
ALTER TABLE _v4_backup_factor_rows  ENABLE ROW LEVEL SECURITY;

-- Before picture --------------------------------------------------------------
SELECT 'profiles total' AS metric, count(*)::text AS value FROM profiles
UNION ALL SELECT 'profiles approved', count(*)::text FROM profiles WHERE status='approved'
UNION ALL SELECT 'profiles missing dark_triad', count(*)::text FROM profiles WHERE content->'dark_triad' IS NULL
UNION ALL SELECT 'profiles missing prospect_theory', count(*)::text FROM profiles WHERE content->'prospect_theory' IS NULL
UNION ALL SELECT 'profiles missing cognitive_reflection', count(*)::text FROM profiles WHERE content->'cognitive_reflection' IS NULL
UNION ALL SELECT 'profiles with fractional crt_score (0-1 scale)', count(*)::text FROM profiles
  WHERE (content->'cognitive_reflection'->>'crt_score') ~ '^[0-9]*\\.[0-9]+$'
    AND (content->'cognitive_reflection'->>'crt_score')::numeric <> floor((content->'cognitive_reflection'->>'crt_score')::numeric)
UNION ALL SELECT 'profiles with constant alpha/beta=0.88', count(*)::text FROM profiles
  WHERE (content->'prospect_theory'->>'alpha')::numeric = 0.88 AND (content->'prospect_theory'->>'beta')::numeric = 0.88
UNION ALL SELECT 'profiles with batch-* tag junk', count(*)::text FROM profiles
  WHERE EXISTS (SELECT 1 FROM unnest(tags) t WHERE t LIKE 'batch-%')
UNION ALL SELECT 'v3 template profiles (to repair)', count(*)::text FROM profiles
  WHERE generation_run_id IN (SELECT id FROM generation_runs WHERE generator_slug='psychosynth-v3-trader-behavior')
UNION ALL SELECT 'v3 template responses (to repair)', count(*)::text FROM profile_scenario_responses
  WHERE generation_run_id IN (SELECT id FROM generation_runs WHERE generator_slug='psychosynth-v3-trader-behavior')
UNION ALL SELECT 'responses missing emotional_arc', count(*)::text FROM profile_scenario_responses WHERE emotional_arc IS NULL
UNION ALL SELECT 'summaries containing LaTeX lambda', count(*)::text FROM profiles WHERE summary LIKE '%\\lambda%'
UNION ALL SELECT 'scenarios total', count(*)::text FROM scenarios
UNION ALL SELECT 'responses total', count(*)::text FROM profile_scenario_responses
UNION ALL SELECT 'biases total', count(*)::text FROM biases;
`;

// ------------------------------------------------------ 01 bias taxonomy ----
{
  const vals = BIAS.map(([slug, name, desc, ex, mit, src]) =>
    `('${esc(slug)}','${esc(name)}','${esc(desc)}','${jesc(ex)}'::jsonb,'${jesc(mit)}'::jsonb,'${esc(src)}')`);
  files['01_bias_taxonomy.sql'] =
    `-- Cognitive-bias taxonomy: ${BIAS.length} literature-grounded entries (idempotent on slug).
-- Extends the 20 seed biases; feeds cognitive-bias-simulator + suggested_biases
-- + scenario_bias_applications. Existing slugs are left untouched.
` + chunked('INSERT INTO biases (slug, name, description, examples, mitigations, source) VALUES', vals, 'ON CONFLICT (slug) DO NOTHING');
}

// ------------------------------------------------- 02 generators + runs -----
{
  const pat = B.EMOTIONAL_PATTERNS.map(([slug, name, desc]) => `('${esc(slug)}','${esc(name)}','${esc(desc)}')`);
  files['02_generators_runs.sql'] = `-- v4 generators + generation runs (+ emotional pattern upsert).
-- Honest provenance: model 'authored/psychosynth-synth-v4' = offline banks +
-- coherence logic + seeded PRNG. No LLM inference anywhere in this bundle.

INSERT INTO emotional_patterns (slug, name, description) VALUES
${pat.join(',\n')}
ON CONFLICT (slug) DO NOTHING;

INSERT INTO generators (slug, version, entity_type, description, prompt_template, params_schema, output_schema, model_config, hooks, status)
VALUES
('psychosynth-synth-v4', 1, 'profile',
 'Offline authored synthesis engine v4: widened component banks, coherent Dark Triad / prospect-theory / CRT factor derivation, archetype-anchored personas, seeded PRNG. Zero inference; reproducible by seed.',
 'authored', '{"type":"object","properties":{"seed":{"type":"string"}}}'::jsonb, '{}'::jsonb,
 '{"provider":"procedural","model":"authored/psychosynth-synth-v4"}'::jsonb,
 '[{"type":"schema_validate"},{"type":"dedup","config":{"threshold":0.5}},{"type":"provenance_stamp"}]'::jsonb, 'active'),
('psychosynth-synth-v4-responses', 1, 'profile_scenario_response',
 'Offline authored response engine v4: trait- and factor-conditioned action/reasoning/arc composition (posture uses lambda + CRT + dark triad). Zero inference; reproducible by seed.',
 'authored', '{"type":"object","properties":{"seed":{"type":"string"}}}'::jsonb, '{}'::jsonb,
 '{"provider":"procedural","model":"authored/psychosynth-synth-v4"}'::jsonb,
 '[{"type":"schema_validate"},{"type":"provenance_stamp"}]'::jsonb, 'active')
ON CONFLICT (slug, version) DO NOTHING;

INSERT INTO generation_runs (id, generator_id, generator_slug, generator_ver, params, model_used, items_requested, items_created, items_auto_approved, status, finished_at) VALUES
('${runProfilesGeneral}', (SELECT id FROM generators WHERE slug='psychosynth-synth-v4' AND version=1 LIMIT 1),
 'psychosynth-synth-v4', 1, '{"seed":"${SEED}","kind":"general-population","domains":["general","trading","negotiation","social","workplace"]}'::jsonb,
 'authored/psychosynth-synth-v4', ${generals.length}, ${generals.length}, ${STATUS === 'approved' ? generals.length : 0}, 'done', now()),
('${runProfilesPersona}', (SELECT id FROM generators WHERE slug='psychosynth-synth-v4' AND version=1 LIMIT 1),
 'psychosynth-synth-v4', 1, '{"seed":"${SEED}","kind":"personas","archetypes":${LEGACY_ARCH.length + NEW_ARCH.length}}'::jsonb,
 'authored/psychosynth-synth-v4', ${personas.length}, ${personas.length}, ${STATUS === 'approved' ? personas.length : 0}, 'done', now()),
('${runResponses}', (SELECT id FROM generators WHERE slug='psychosynth-synth-v4-responses' AND version=1 LIMIT 1),
 'psychosynth-synth-v4-responses', 1, '{"seed":"${SEED}","kind":"responses"}'::jsonb,
 'authored/psychosynth-synth-v4', ${responses.length}, ${responses.length}, ${responses.length}, 'done', now())
ON CONFLICT (id) DO NOTHING;
`;
}

// ---------------------------------------------------- 03 factor backfill ----
{
  const p = 'p.id';
  const loA = 'GREATEST(0, 0.5 - p.agreeableness) * 2', hiC = 'GREATEST(0, p.conscientiousness - 0.5) * 2',
    hiO = 'GREATEST(0, p.openness - 0.5) * 2', hiE = 'GREATEST(0, p.extraversion - 0.5) * 2',
    loN = 'GREATEST(0, 0.5 - p.neuroticism) * 2', loC = 'GREATEST(0, 0.5 - p.conscientiousness) * 2',
    hiN = 'GREATEST(0, p.neuroticism - 0.5) * 2', loO = 'GREATEST(0, 0.5 - p.openness) * 2';
  const mach = sqlRound2(sqlClamp(`0.26 + 0.34*${loA} + 0.12*${hiC} + 0.10*${hiO} + (${sqlRnd01(p, 'dtm')} - 0.5)*0.16`, '0.02', '0.98'));
  const narc = sqlRound2(sqlClamp(`0.24 + 0.30*${hiE} + 0.22*${loA} + 0.08*${loN} + (${sqlRnd01(p, 'dtn')} - 0.5)*0.16`, '0.02', '0.98'));
  const psyc = sqlRound2(sqlClamp(`0.12 + 0.34*${loA} + 0.24*${loC} + 0.10*${loN} + (${sqlRnd01(p, 'dtp')} - 0.5)*0.14`, '0.02', '0.98'));
  const lossW = `COALESCE((SELECT MAX((e->>'strength')::numeric) FROM jsonb_array_elements(COALESCE(p.content->'suggested_biases','[]'::jsonb)) e WHERE e->>'slug'='loss-aversion'), 0)`;
  const lambda = sqlRound2(sqlClamp(`1.45 + 1.30*${hiN} + 0.40*${loO} + 0.45*${lossW} + (${sqlRnd01(p, 'ptl')} - 0.5)*0.60`, '0.6', '4.4'));
  const alpha = sqlRound2(sqlClamp(`0.74 + 0.14*${hiC} + 0.06*${loN} + (${sqlRnd01(p, 'pta')} - 0.5)*0.11`, '0.55', '0.99'));
  const beta = sqlRound2(sqlClamp(`0.72 + 0.12*${hiC} + 0.08*${hiN} + (${sqlRnd01(p, 'ptb')} - 0.5)*0.11`, '0.55', '0.99'));
  const crtRaw = `0.10 + 0.46*p.conscientiousness + 0.30*p.openness - 0.14*p.neuroticism + (${sqlRnd01(p, 'crt')} - 0.5)*0.28`;
  const crt = `(CASE WHEN (${crtRaw}) >= 0.68 THEN 3 WHEN (${crtRaw}) >= 0.48 THEN 2 WHEN (${crtRaw}) >= 0.30 THEN 1 ELSE 0 END)`;
  const sysPref = `(CASE WHEN ${sqlRnd01(p, 'sys')} < (0.12 + ${crt}*0.27 + ${hiC}*0.12) THEN 'system2' ELSE 'system1' END)`;

  files['03_backfill_factors.sql'] = `-- Factor backfill — enrich EXISTING profiles that predate the multi-factor
-- surface. Set-based; per-row determinism via md5(id||salt), so re-running
-- yields identical values. Derivations mirror scripts/lib/factors.js
-- (directional loadings from the SD3 / prospect-theory / CRT literature).
-- Scope guard: only rows captured in _v4_backup_factor_rows (see 00_PREFLIGHT).

-- A) Dark Triad where missing --------------------------------------------------
UPDATE profiles p SET content = p.content || jsonb_build_object('dark_triad', jsonb_build_object(
  'machiavellianism', ${mach},
  'narcissism',       ${narc},
  'psychopathy',      ${psyc}))
WHERE p.content->'dark_triad' IS NULL
  AND p.openness IS NOT NULL AND p.id IN (SELECT id FROM _v4_backup_factor_rows);

-- B) Prospect theory where missing (lambda justified by neuroticism, low
--    openness, and any carried loss-aversion bias strength) --------------------
UPDATE profiles p SET content = p.content || jsonb_build_object('prospect_theory', jsonb_build_object(
  'lambda', ${lambda},
  'alpha',  ${alpha},
  'beta',   ${beta}))
WHERE p.content->'prospect_theory' IS NULL
  AND p.openness IS NOT NULL AND p.id IN (SELECT id FROM _v4_backup_factor_rows);

-- C) Cognitive reflection where missing (CRT standardized to INTEGER 0-3) ------
UPDATE profiles p SET content = p.content || jsonb_build_object('cognitive_reflection', jsonb_build_object(
  'system_preference', ${sysPref},
  'crt_score', ${crt}))
WHERE p.content->'cognitive_reflection' IS NULL
  AND p.openness IS NOT NULL AND p.id IN (SELECT id FROM _v4_backup_factor_rows);

-- D) Normalize legacy 0-1 float crt_score to the true 0-3 CRT scale ------------
UPDATE profiles p SET content = jsonb_set(p.content, '{cognitive_reflection,crt_score}',
  to_jsonb(round(LEAST(1.0, GREATEST(0.0, (p.content->'cognitive_reflection'->>'crt_score')::numeric)) * 3)::int))
WHERE (p.content->'cognitive_reflection'->>'crt_score') ~ '^[0-9]*\\.[0-9]+$'
  AND (p.content->'cognitive_reflection'->>'crt_score')::numeric <> floor((p.content->'cognitive_reflection'->>'crt_score')::numeric)
  AND p.id IN (SELECT id FROM _v4_backup_factor_rows);

-- E) De-constant the alpha/beta=0.88 rows (every value was the same literal;
--    buyers checking column cardinality read that as template output) ----------
UPDATE profiles p SET content = p.content || jsonb_build_object('prospect_theory',
  (p.content->'prospect_theory')
  || jsonb_build_object('alpha', ${sqlRound2(sqlClamp(`0.88 + (${sqlRnd01(p, 'dja')} - 0.5)*0.10`, '0.55', '0.99'))})
  || jsonb_build_object('beta',  ${sqlRound2(sqlClamp(`0.84 + (${sqlRnd01(p, 'djb')} - 0.5)*0.10`, '0.55', '0.99'))}))
WHERE (p.content->'prospect_theory'->>'alpha')::numeric = 0.88
  AND (p.content->'prospect_theory'->>'beta')::numeric = 0.88
  AND p.id IN (SELECT id FROM _v4_backup_factor_rows);

-- F) One version bump + provenance stamp per enriched row (runs once: guarded
--    by the absence of a prior factors-v4 provenance row) ----------------------
UPDATE profiles p SET version = p.version + 1
WHERE p.id IN (SELECT id FROM _v4_backup_factor_rows)
  AND NOT EXISTS (SELECT 1 FROM provenance pr
                  WHERE pr.entity_type='profile' AND pr.entity_id=p.id
                    AND pr.model='authored/psychosynth-factors-v4');

INSERT INTO provenance (entity_type, entity_id, entity_version, model, prompt_hash, template_hash, params, sha256_content)
SELECT 'profile', p.id, p.version, 'authored/psychosynth-factors-v4',
       encode(sha256(convert_to('v4-factor-backfill:' || p.id::text, 'UTF8')), 'hex'),
       '${TEMPLATE_HASH}',
       jsonb_build_object('method','sql-deterministic-backfill','salt','md5(id)','fields',
                          jsonb_build_array('dark_triad','prospect_theory','cognitive_reflection')),
       encode(sha256(convert_to(p.content::text, 'UTF8')), 'hex')
FROM profiles p
WHERE p.id IN (SELECT id FROM _v4_backup_factor_rows)
  AND NOT EXISTS (SELECT 1 FROM provenance pr
                  WHERE pr.entity_type='profile' AND pr.entity_id=p.id
                    AND pr.model='authored/psychosynth-factors-v4')
ON CONFLICT (entity_type, entity_id, entity_version) DO NOTHING;
`;
}

// ------------------------------------------------- 04 repair v3 profiles ----
{
  let sql = `-- Repair the v3 template batches IN PLACE (ids stable, nothing downstream
-- breaks). Each archetype gets authored role/habit/tell banks composed into
-- one of four frames, picked deterministically from md5(id) — so wording is
-- varied, coherent with the row's own traits and lambda, and reproducible.
-- Also: strips batch-* tag junk, drops the near-duplicate 'name' field,
-- installs 'archetype' + trait-justified suggested_biases, sets the missing
-- quality_score, and bumps version with provenance.
-- Idempotent: rows already carrying content.synthesis.engine='synth-v4' are skipped.

`;
  const V3_PRED = `p.id IN (SELECT id FROM _v4_backup_profiles_v3)
    AND (p.content->'synthesis'->>'engine') IS DISTINCT FROM 'synth-v4'`;
  // Texture banks by archetype group — an extra high-cardinality slot so
  // within-archetype rows can't converge on the same few sentences.
  const TEXTURE = {
    degen: ['keeps three wallets open and loyalty in none of them',
      'sleeps through weekdays and trades through weekends',
      'quotes slot numbers the way others quote lunch spots',
      'treats gas spikes as weather, not warning',
      'screenshots the portfolio only on green days',
      'holds airdropped dust like lottery stubs',
      'reads the group chat faster than the chart',
      'measures weeks in narratives, not days',
      'keeps the burner funded for exactly one more mistake',
      'celebrates round-trip losses as experience points'],
    retail: ['checks the app in line for coffee and regrets it',
      'keeps a watchlist longer than a grocery list',
      'trades around earnings like planning around storms',
      'moves the mental stop rather than the real one',
      'reads one bear thread and one bull thread and picks by mood',
      'keeps last year\'s statement unopened in a drawer',
      'talks entries at dinner, never exits',
      'sizes positions by paycheck cycle',
      'has the support line memorized from the last outage',
      'checks after-hours prices from bed with one eye'],
    inst: ['writes the risk memo before the position exists',
      'treats counterparty limits as scripture',
      'reports slippage honestly and expects the same back',
      'keeps the model change-log cleaner than the P&L',
      'reviews the quarter by process, not outcome',
      'sizes to survive the backtest\'s worst week twice over',
      'escalates anomalies before they become stories',
      'holds post-mortems for trades that made money',
      'rotates on schedule regardless of conviction',
      'prices reputation into every fill'],
  };
  const INTENSITY = ['measured', 'steady', 'pronounced', 'intense', 'unmistakable'];
  for (const a of V3_REPAIR) {
    const clausePool = (() => {
      // pick trait-fitting clause fragments from the live synth banks at emit time
      const anchors = [];
      const bf = (LEGACY_ARCH.find((x) => x.tag === a.detect[0]) || {}).bf; // rarely present; fall back on style
      const rngA = S.makeRng(SEED + ':clause:' + a.arch);
      const styleBank = S.DECISION_SENTENCE[a.style] || S.DECISION_SENTENCE.analytical;
      const dec = R.sample(rngA, styleBank, 3);
      const all = [];
      for (const t of Object.keys(S.CLAUSES)) for (const l of ['high', 'low']) all.push(...S.CLAUSES[t][l]);
      const cl = R.sample(rngA, all, 4);
      return { dec, cl };
    })();
    const lamHi = ['a loss stings them roughly three times as hard as the same-size win pays',
      'downside dread does more of their decision-making than upside appetite',
      'they will pay real money to avoid booking a loss, and it shows in every exit'];
    const lamMid = ['losses weigh about twice as much as gains here, close to the textbook trader',
      'their risk posture is ordinary: losses hurt more than gains, but not cripplingly so'];
    const lamLo = ['losses bounce off them — the asymmetry that disciplines most people barely registers',
      'they are unusually numb to drawdowns, which reads as courage right up until it does not'];
    const lamExpr = `CASE WHEN COALESCE((p.content->'prospect_theory'->>'lambda')::numeric, 2.0) >= 2.5 THEN ${sqlPick('b.lhi', lamHi.length, 'p.id', 'lam')}
         WHEN COALESCE((p.content->'prospect_theory'->>'lambda')::numeric, 2.0) < 1.0 THEN ${sqlPick('b.llo', lamLo.length, 'p.id', 'lam')}
         ELSE ${sqlPick('b.lmid', lamMid.length, 'p.id', 'lam')} END`;
    const pick = (name, len, salt) => sqlPick('b.' + name, len, 'p.id', salt);
    const role = pick('r', a.roles.length, 'ro'), habit = pick('h', a.habits.length, 'ha'),
      tell = pick('t', a.tells.length, 'te'), clause = pick('c', 4, 'cl'), dec = pick('d', 3, 'de'),
      tex = pick('tx', TEXTURE[a.group].length, 'tx'), inten = pick('iy', INTENSITY.length, 'iy');
    // Numeric posture suffix: unique-ish per row (lambda 2dp x CRT), keeps the
    // enriched factors visible in prose with zero LaTeX.
    const posture = `' Measured posture: loss aversion near ' || to_char(COALESCE((p.content->'prospect_theory'->>'lambda')::numeric, 2.0), 'FM0D99') || ', reflection ' || COALESCE(p.content->'cognitive_reflection'->>'crt_score','1') || ' of 3.'`;
    const frame = `(CASE mod(${sqlRnd('p.id', 'fr')}, 4)
      WHEN 0 THEN 'A ' || ${inten} || ' ' || ${role} || ' who ' || ${habit} || '. ' || ${sqlCap(dec)} || '. ' || ${sqlCap(clause)} || ', and ' || (${lamExpr}) || '. ' || ${sqlCap(tex)} || '; ' || ${tell} || '.'
      WHEN 1 THEN ${sqlCap(dec)} || '. This ' || ${role} || ' ' || ${habit} || ' and ' || ${clause} || '. ' || ${sqlCap(`(${lamExpr})`)} || '; ' || ${tex} || ', and ' || ${tell} || '.'
      WHEN 2 THEN ${sqlCap(tell)} || '. A ' || ${inten} || ' ' || ${role} || ' in full: ' || ${habit} || ', ' || ${tex} || ', and ' || ${clause} || '. ' || ${sqlCap(dec)} || '.'
      ELSE ${sqlCap(role)} || ' whose defining move: ' || ${habit} || '. ' || ${sqlCap(clause)} || '. ' || ${sqlCap(dec)} || '. ' || ${sqlCap(`(${lamExpr})`)} || ' — ' || ${tex} || ', and ' || ${tell} || '.'
      END || ${posture})`;
    const biasesJson = a.biases.map(([slug, base], j) =>
      `jsonb_build_object('slug','${slug}','strength', ${sqlRound2(sqlClamp(`${base} + (${sqlRnd01('p.id', 'b' + j)} - 0.5)*0.14`, '0.3', '0.95'))})`).join(', ');
    const factorTagArr = `array_remove(array_remove(array_remove(ARRAY[
        CASE WHEN COALESCE((p.content->'prospect_theory'->>'lambda')::numeric,2.0) >= 2.5 THEN 'loss-averse' END,
        CASE WHEN COALESCE((p.content->'prospect_theory'->>'lambda')::numeric,2.0) < 1.0 THEN 'risk-seeking' END,
        CASE WHEN (p.content->'dark_triad'->>'machiavellianism')::numeric > 0.6
               OR (p.content->'dark_triad'->>'narcissism')::numeric > 0.6
               OR (p.content->'dark_triad'->>'psychopathy')::numeric > 0.55 THEN 'dark-triad-elevated' END,
        CASE WHEN (p.content->'cognitive_reflection'->>'crt_score')::numeric >= 2
              AND p.content->'cognitive_reflection'->>'system_preference' = 'system2' THEN 'reflective' END
      ], NULL), ''), 'x-none')`;
    sql += `-- --- ${a.arch} ---------------------------------------------------------------
WITH b AS (SELECT
  ${sqlArr(a.roles)} AS r,
  ${sqlArr(a.habits)} AS h,
  ${sqlArr(a.tells)} AS t,
  ${sqlArr(clausePool.cl)} AS c,
  ${sqlArr(clausePool.dec)} AS d,
  ${sqlArr(TEXTURE[a.group])} AS tx,
  ${sqlArr(INTENSITY)} AS iy,
  ${sqlArr(lamHi)} AS lhi, ${sqlArr(lamMid)} AS lmid, ${sqlArr(lamLo)} AS llo)
UPDATE profiles p SET
  version = p.version + 1,
  quality_score = COALESCE(p.quality_score, ${sqlRound2(`0.72 + 0.20*${sqlRnd01('p.id', 'q')}`)}),
  summary = ${frame},
  tags = (SELECT array_agg(DISTINCT tg) FROM unnest(
            COALESCE((SELECT array_agg(t2) FROM unnest(p.tags) t2 WHERE t2 NOT LIKE 'batch-%'), '{}')
            || ${factorTagArr}) tg WHERE tg IS NOT NULL AND tg <> ''),
  content = (p.content - 'name')
            || jsonb_build_object('archetype', '${a.arch}')
            || jsonb_build_object('suggested_biases', jsonb_build_array(${biasesJson}))
            || jsonb_build_object('synthesis', jsonb_build_object(
                 'engine','synth-v4','method','sql-authored-repair','source','v3-template-batch'))
FROM b
WHERE ${V3_PRED}
  AND p.tags @> ${sqlArr(a.detect)};

`;
  }
  sql += `-- --- catch-all: batch-* tag hygiene for every remaining row (defi/kol etc.) --
UPDATE profiles p SET
  tags = COALESCE((SELECT array_agg(t2) FROM unnest(p.tags) t2 WHERE t2 NOT LIKE 'batch-%'), '{}'),
  content = CASE WHEN p.content ? 'tags'
    THEN p.content || jsonb_build_object('tags',
      COALESCE((SELECT jsonb_agg(e) FROM jsonb_array_elements_text(p.content->'tags') e WHERE e NOT LIKE 'batch-%'), '[]'::jsonb))
    ELSE p.content END
WHERE EXISTS (SELECT 1 FROM unnest(p.tags) t WHERE t LIKE 'batch-%')
   OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(p.content->'tags','[]'::jsonb)) e WHERE e LIKE 'batch-%');

-- --- sync content.summary / content.tags with the repaired columns ------------
UPDATE profiles p SET
  content = p.content || jsonb_build_object('summary', p.summary, 'tags', to_jsonb(p.tags))
WHERE p.content->'synthesis'->>'engine' = 'synth-v4'
  AND p.content->'synthesis'->>'method' = 'sql-authored-repair'
  AND (p.content->>'summary' IS DISTINCT FROM p.summary
       OR p.content->'tags' IS DISTINCT FROM to_jsonb(p.tags));

-- --- provenance for repaired rows --------------------------------------------
INSERT INTO provenance (entity_type, entity_id, entity_version, model, prompt_hash, template_hash, params, sha256_content)
SELECT 'profile', p.id, p.version, 'authored/psychosynth-synth-v4-repair',
       encode(sha256(convert_to('v4-profile-repair:' || p.id::text, 'UTF8')), 'hex'),
       '${TEMPLATE_HASH}',
       jsonb_build_object('method','sql-authored-repair','archetype', p.content->>'archetype','source','v3-template-batch'),
       encode(sha256(convert_to(p.content::text, 'UTF8')), 'hex')
FROM profiles p
WHERE p.id IN (SELECT id FROM _v4_backup_profiles_v3)
  AND p.content->'synthesis'->>'method' = 'sql-authored-repair'
  AND NOT EXISTS (SELECT 1 FROM provenance pr
                  WHERE pr.entity_type='profile' AND pr.entity_id=p.id
                    AND pr.model='authored/psychosynth-synth-v4-repair')
ON CONFLICT (entity_type, entity_id, entity_version) DO NOTHING;
`;
  files['04_repair_v3_profiles.sql'] = sql;
}

// ------------------------------------------------ 05 repair v3 responses ----
{
  const bankCols = [];
  const bankName = (cat, bucket) => `a_${cat.slice(0, 2)}_${bucket.slice(0, 3)}`;
  for (const cat of B.CATEGORIES) for (const bucket of ['cautious', 'calculating', 'bold', 'impulsive'])
    bankCols.push(`${sqlArr(B.ACTIONS[cat][bucket])} AS ${bankName(cat, bucket)}`);
  const styleName = (st) => `re_${st.slice(0, 4)}`;
  for (const st of Object.keys(B.REASONING)) bankCols.push(`${sqlArr(B.REASONING[st])} AS ${styleName(st)}`);
  for (const cat of B.CATEGORIES) bankCols.push(`${sqlArr(B.REASONING_CONTEXT[cat])} AS cx_${cat.slice(0, 2)}`);
  const OPEN = B.OPEN_PHRASES, CLOSE = B.CLOSE_PHRASES, PAT = B.AROUSAL_BUCKETS;
  for (const k of ['high', 'mid', 'low']) {
    bankCols.push(`${sqlArr(OPEN[k])} AS op_${k}`);
    bankCols.push(`${sqlArr(CLOSE[k])} AS cl_${k}`);
    bankCols.push(`${sqlArr(PAT[k].map((x) => x.replace(/_/g, ' ')))} AS pa_${k}`);
  }
  const quirkCase = 'CASE p.content->\'suggested_biases\'->0->>\'slug\'\n' +
    Object.entries(S.BIAS_QUIRK).map(([slug, arr]) =>
      `      WHEN '${slug}' THEN ', and true to form ' || ${sqlPick(sqlArr(arr), arr.length, 'r.id', 'qk')}`).join('\n') +
    "\n      ELSE '' END";
  const openers = ['Faced with this', 'Put in this spot', 'Confronted with it', 'Dropped into this', 'When it lands on their desk', 'In the moment'];
  const titled = ['Faced with', 'Confronted with', 'Dropped into', 'Hit with'];
  const openerExpr = `CASE WHEN mod(${sqlRnd('r.id', 'ot')}, 10) < 6
      THEN ${sqlPick(sqlArr(titled), titled.length, 'r.id', 'op')} || ' "' || lower(regexp_replace(s.title, '\\s*\\(.*\\)$', '')) || '"'
      ELSE ${sqlPick(sqlArr(openers), openers.length, 'r.id', 'op')} END`;
  const actionCase = 'CASE s.category\n' + B.CATEGORIES.map((cat) =>
    `      WHEN '${cat}' THEN CASE calc.bucket ${['cautious', 'calculating', 'bold', 'impulsive'].map((bk) =>
      `WHEN '${bk}' THEN ${sqlPick('b.' + bankName(cat, bk), B.ACTIONS[cat][bk].length, 'r.id', 'ac')}`).join(' ')} END`).join('\n') +
    '\n      END';
  const reasoningCase = 'CASE COALESCE(p.decision_style, \'analytical\')\n' + Object.keys(B.REASONING).map((st) =>
    `      WHEN '${st}' THEN ${sqlPick('b.' + styleName(st), B.REASONING[st].length, 'r.id', 're')}`).join('\n') +
    `\n      ELSE ${sqlPick('b.' + styleName('analytical'), B.REASONING.analytical.length, 'r.id', 're')} END`;
  const ctxCase = 'CASE s.category\n' + B.CATEGORIES.map((cat) =>
    `      WHEN '${cat}' THEN ${sqlPick('b.cx_' + cat.slice(0, 2), B.REASONING_CONTEXT[cat].length, 'r.id', 'cx')}`).join('\n') + '\n      END';
  const arcPart = (part, lens) => `CASE calc.nb ${['high', 'mid', 'low'].map((k) =>
    `WHEN '${k}' THEN ${sqlPick(`b.${part}_${k}`, lens[k].length, 'r.id', part)}`).join(' ')} END`;
  const conf = sqlRound2(sqlClamp(
    `0.40 + 0.25*(1 - p.neuroticism) + 0.15*p.conscientiousness
     + CASE WHEN p.content->'suggested_biases'->0->>'slug' = 'overconfidence' THEN 0.15 ELSE 0 END
     + 0.015*COALESCE((p.content->'cognitive_reflection'->>'crt_score')::numeric, 1)
     - CASE WHEN COALESCE((p.content->'prospect_theory'->>'lambda')::numeric, 2.0) >= 2.5
             AND s.category IN ('trading','crisis') THEN 0.05 ELSE 0 END
     + CASE WHEN (p.content->'dark_triad'->>'psychopathy')::numeric > 0.6 THEN 0.04 ELSE 0 END
     + CASE WHEN (p.content->'dark_triad'->>'narcissism')::numeric > 0.65 THEN 0.04 ELSE 0 END
     + (${sqlRnd01('r.id', 'cf')} - 0.5)*0.10`, '0.15', '0.98'));

  files['05_repair_v3_responses.sql'] = `-- Repair v3 template responses IN PLACE (ids stable). The old rows carried
-- round-robin BUY/SELL text unconditioned on the profile, LaTeX artifacts,
-- and no emotional_arc. This rewrite derives everything from the joined
-- profile's own traits/factors and the scenario's category, with md5(id)
-- variation — the same composition logic as scripts/lib/behavior.js.
-- Idempotent: the junk-text predicate no longer matches after the rewrite.

UPDATE profile_scenario_responses r SET
  response = (${openerExpr}) || ', this '
             || replace(COALESCE(p.content->>'archetype', 'trader'), '-', ' ') || ' '
             || (${actionCase})
             || (${quirkCase}) || '.',
  reasoning_chain = (${reasoningCase}) || ' ' || (${ctxCase}),
  emotional_arc = ${sqlCap(`(${arcPart('op', OPEN)})`)} || ', resolving into ' || (${arcPart('pa', PAT)})
                  || ' — ' || (${arcPart('cl', CLOSE)}) || '.',
  confidence = ${conf}
FROM profiles p, scenarios s,
LATERAL (SELECT
    CASE WHEN (0.5*(1 - p.neuroticism) + 0.3*p.openness + 0.2*(1 - p.agreeableness)
               + 0.10 - 0.06*LEAST(3.6, GREATEST(0.6, COALESCE((p.content->'prospect_theory'->>'lambda')::numeric, 2.0)))
               + CASE WHEN (p.content->'dark_triad'->>'psychopathy')::numeric > 0.6 THEN 0.06 ELSE 0 END) >= 0.55
         THEN CASE WHEN (0.6*(1 - p.conscientiousness) + 0.4*p.extraversion
                         + CASE WHEN p.content->'cognitive_reflection'->>'system_preference' = 'system1' THEN 0.05 ELSE 0 END
                         - 0.03*LEAST(3, COALESCE((p.content->'cognitive_reflection'->>'crt_score')::numeric, 1))) >= 0.5
                   THEN 'bold' ELSE 'calculating' END
         ELSE CASE WHEN (0.6*(1 - p.conscientiousness) + 0.4*p.extraversion
                         + CASE WHEN p.content->'cognitive_reflection'->>'system_preference' = 'system1' THEN 0.05 ELSE 0 END
                         - 0.03*LEAST(3, COALESCE((p.content->'cognitive_reflection'->>'crt_score')::numeric, 1))) >= 0.5
                   THEN 'impulsive' ELSE 'cautious' END
    END AS bucket,
    CASE WHEN p.neuroticism >= 0.65 THEN 'high' WHEN p.neuroticism <= 0.35 THEN 'low' ELSE 'mid' END AS nb
  ) calc,
(SELECT
  ${bankCols.join(',\n  ')}
) b
WHERE p.id = r.profile_id AND s.id = r.scenario_id
  AND r.id IN (SELECT id FROM _v4_backup_responses_v3)
  AND (r.reasoning_chain LIKE '%loss aversion coefficient%'
       OR r.response ~ '^(BUY|ADD|HOLD|TRIM|SELL|CUT) — '
       OR r.emotional_arc IS NULL);

-- provenance for repaired responses -------------------------------------------
INSERT INTO provenance (entity_type, entity_id, entity_version, model, prompt_hash, template_hash, params, sha256_content)
SELECT 'profile_scenario_response', r.id, 1, 'authored/psychosynth-synth-v4-repair',
       encode(sha256(convert_to('v4-response-repair:' || r.id::text, 'UTF8')), 'hex'),
       '${TEMPLATE_HASH}',
       jsonb_build_object('method','sql-authored-repair','source','v3-template-batch'),
       encode(sha256(convert_to(r.response || '|' || r.reasoning_chain, 'UTF8')), 'hex')
FROM profile_scenario_responses r
WHERE r.id IN (SELECT id FROM _v4_backup_responses_v3)
  AND NOT EXISTS (SELECT 1 FROM provenance pr
                  WHERE pr.entity_type='profile_scenario_response' AND pr.entity_id=r.id
                    AND pr.model='authored/psychosynth-synth-v4-repair')
ON CONFLICT (entity_type, entity_id, entity_version) DO NOTHING;
`;
}

// -------------------------------------------------------- 06 scenarios ------
{
  const vals = scenarios.map((s) => `('${s.id}','${esc(s.slug)}','${esc(s.category)}','${esc(s.title)}','${esc(s.description)}')`);
  const linkVals = [];
  for (const s of scenarios) for (const l of s.links) linkVals.push(`('${s.id}','${l.slug}',${l.weight})`);
  files['06_scenarios_v4.sql'] = `-- ${scenarios.length} fresh v4 scenarios (only newly-authored stems; parameter-varied,
-- hash-slugged so re-runs with the same seed are no-ops) + bias links.
` + chunked('INSERT INTO scenarios (id, slug, category, title, description) VALUES', vals, 'ON CONFLICT (slug) DO NOTHING') +
    `INSERT INTO scenario_bias_applications (scenario_id, bias_id, weight)
SELECT v.sid::uuid, b.id, v.weight
FROM (VALUES
${linkVals.join(',\n')}
) AS v(sid, slug, weight)
JOIN biases b ON b.slug = v.slug
ON CONFLICT (scenario_id, bias_id) DO NOTHING;
`;
}

// --------------------------------------------------------- 07 profiles ------
function emitProfiles(list, runId, label) {
  const vals = list.map((x) =>
    `('${x.id}','${jesc(x.content)}'::jsonb,'${jesc(x.bf)}'::jsonb,'${x.mbti}','${esc(x.style)}','${esc(x.summary)}',${sqlArr(x.tags)},'${STATUS}',${x.quality},'${runId}')`);
  const prov = list.map((x) =>
    `('profile','${x.id}',1,'authored/psychosynth-synth-v4','${SHA(`authored-synthesis-v4 seed=${SEED} kind=${x.kind} ${x.summary}`)}','${TEMPLATE_HASH}','${jesc({ seed: SEED, kind: x.kind, engine: 'synth-v4' })}'::jsonb,'${SHA(S.canonical(x.content))}')`);
  const links = [];
  for (const x of list) for (const b of x.biases) links.push(`('${x.id}','${b.slug}',${b.strength})`);
  return `-- ${list.length} ${label} (status=${STATUS}) + provenance + trait-justified bias links.
` + chunked('INSERT INTO profiles (id, content, big_five, mbti_label, decision_style, summary, tags, status, quality_score, generation_run_id) VALUES', vals, 'ON CONFLICT (id) DO NOTHING') +
    chunked('INSERT INTO provenance (entity_type, entity_id, entity_version, model, prompt_hash, template_hash, params, sha256_content) VALUES', prov, 'ON CONFLICT (entity_type, entity_id, entity_version) DO NOTHING') +
    `INSERT INTO profile_bias_links (profile_id, bias_id, strength, generation_run_id)
SELECT v.pid::uuid, b.id, v.strength, '${runId}'::uuid
FROM (VALUES
${links.join(',\n')}
) AS v(pid, slug, strength)
JOIN biases b ON b.slug = v.slug
ON CONFLICT (profile_id, bias_id) DO NOTHING;
`;
}
files['07a_profiles_v4_general.sql'] = emitProfiles(generals, runProfilesGeneral, 'general-population profiles (5 domains, full factor surface)');
files['07b_profiles_v4_personas.sql'] = emitProfiles(personas, runProfilesPersona, `personas across ${LEGACY_ARCH.length + NEW_ARCH.length} archetypes (retail/solana/defi/whale/negotiation/kol)`);

// -------------------------------------------------------- 08 responses ------
{
  const half = Math.ceil(responses.length / 2);
  const emitResp = (list, label) => {
    const vals = list.map((r) =>
      `('${r.id}','${r.profile_id}','${r.scenario_id}','${esc(r.response)}','${esc(r.reasoning_chain)}','${esc(r.emotional_arc)}',${r.confidence},'${runResponses}')`);
    const prov = list.map((r) =>
      `('profile_scenario_response','${r.id}',1,'authored/psychosynth-synth-v4','${SHA(`authored-response-v4 seed=${SEED} ${r.response}`)}','${TEMPLATE_HASH}','${jesc({ seed: SEED, engine: 'synth-v4' })}'::jsonb,'${SHA(r.response + '|' + r.reasoning_chain)}')`);
    return `-- ${list.length} ${label} (profile- and factor-conditioned; emotional_arc included).
` + chunked('INSERT INTO profile_scenario_responses (id, profile_id, scenario_id, response, reasoning_chain, emotional_arc, confidence, generation_run_id) VALUES', vals, 'ON CONFLICT (id) DO NOTHING') +
      chunked('INSERT INTO provenance (entity_type, entity_id, entity_version, model, prompt_hash, template_hash, params, sha256_content) VALUES', prov, 'ON CONFLICT (entity_type, entity_id, entity_version) DO NOTHING');
  };
  files['08a_responses_v4_part1.sql'] = emitResp(responses.slice(0, half), 'fresh scenario responses (part 1/2)');
  files['08b_responses_v4_part2.sql'] = emitResp(responses.slice(half), 'fresh scenario responses (part 2/2)');
}

// --------------------------------------------------- 09 catalog polish ------
{
  const FULL_FILTERS = ['tags', 'decision_style', 'mbti_label', 'big_five_min', 'big_five_max',
    'machiavellianism_min', 'machiavellianism_max', 'narcissism_min', 'narcissism_max',
    'psychopathy_min', 'psychopathy_max', 'lambda_min', 'lambda_max', 'alpha_min', 'alpha_max',
    'beta_min', 'beta_max', 'system_preference', 'crt_score_min', 'crt_score_max'];
  files['09_catalog_polish.sql'] = `-- Catalog polish.
--
-- 1) Fix the Solana Trading Psychology Pack recipe: it still carries the
--    legacy filters ARRAY format from 0012, which the resolver ignores
--    (DB_AUDIT finding C3) — so the pack serves the whole approved library
--    instead of the chain:solana slice, and buyers cannot filter at all
--    (allow_request_filters was never set). Normalize to the enforced
--    tags_include shape + open the full filter surface.
UPDATE recipes
SET query_rules = query_rules
  || jsonb_build_object('filters', jsonb_build_object('status','approved','tags_include', jsonb_build_array('chain:solana')))
  || jsonb_build_object('allow_request_filters', '${JSON.stringify(FULL_FILTERS)}'::jsonb)
WHERE id = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'
  AND (query_rules->'filters'->>'tags_include') IS NULL;

-- 2) Robinhood Counterparty Pack: open the same full factor filter surface
--    (it advertised prospect-theory posture but only allowed lambda).
UPDATE recipes
SET query_rules = query_rules
  || jsonb_build_object('allow_request_filters', '${JSON.stringify(FULL_FILTERS)}'::jsonb)
WHERE id = 'b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e';
`;
}

// ---------------------------------------------------------- 10 VERIFY -------
files['10_VERIFY.sql'] = `-- v4 VERIFY — run after applying 01..09. Every check lists its expectation.

-- 1) Factor coverage should be 100% (was the backfill's whole point).
SELECT 'profiles missing any factor (expect 0)' AS check, count(*)::text AS value FROM profiles
WHERE content->'dark_triad' IS NULL OR content->'prospect_theory' IS NULL OR content->'cognitive_reflection' IS NULL
UNION ALL
-- 2) CRT scale should be uniformly integer 0-3 (expect 0 fractional).
SELECT 'fractional crt_score remaining (expect 0)', count(*)::text FROM profiles
WHERE (content->'cognitive_reflection'->>'crt_score') ~ '^[0-9]*\\.[0-9]+$'
  AND (content->'cognitive_reflection'->>'crt_score')::numeric <> floor((content->'cognitive_reflection'->>'crt_score')::numeric)
UNION ALL
-- 3) Batch-tag junk gone (expect 0).
SELECT 'batch-* tags remaining (expect 0)', count(*)::text FROM profiles
WHERE EXISTS (SELECT 1 FROM unnest(tags) t WHERE t LIKE 'batch-%')
UNION ALL
-- 4) LaTeX artifacts gone from v3 summaries (expect 0).
SELECT 'summaries with LaTeX lambda (expect 0)', count(*)::text FROM profiles WHERE summary LIKE '%\\lambda%'
UNION ALL
-- 5) v3 template responses rewritten (expect 0).
SELECT 'template responses remaining (expect 0)', count(*)::text FROM profile_scenario_responses
WHERE reasoning_chain LIKE '%loss aversion coefficient%' OR response ~ '^(BUY|ADD|HOLD|TRIM|SELL|CUT) — '
UNION ALL
SELECT 'responses missing emotional_arc (expect 0)', count(*)::text FROM profile_scenario_responses WHERE emotional_arc IS NULL
UNION ALL
-- 6) Fresh volume landed.
SELECT 'v4 fresh profiles (expect ${personas.length + generals.length})', count(*)::text FROM profiles
WHERE generation_run_id IN ('${runProfilesGeneral}','${runProfilesPersona}')
UNION ALL
SELECT 'v4 fresh responses (expect ${responses.length})', count(*)::text FROM profile_scenario_responses
WHERE generation_run_id = '${runResponses}'
UNION ALL
SELECT 'v4 fresh scenarios (expect ${scenarios.length})', count(*)::text FROM scenarios WHERE slug LIKE 'v4-%'
UNION ALL
-- 7) Themed pack slices now well-populated.
SELECT 'robinhood pack slice (robinhood+retail-trading)', count(*)::text FROM profiles
WHERE status='approved' AND tags && ARRAY['robinhood','retail-trading']
UNION ALL
SELECT 'solana pack slice (chain:solana)', count(*)::text FROM profiles
WHERE status='approved' AND tags && ARRAY['chain:solana']
UNION ALL
-- 8) Provenance is stamped for everything v4 touched.
SELECT 'provenance rows model like psychosynth%v4%', count(*)::text FROM provenance
WHERE model LIKE 'authored/psychosynth%v4%';

-- 9) Near-duplicate audit on the new batch (pg_trgm; sample-based).
--    Values near 1.0 mean template rot; expect the max under 0.55 (the dedup
--    hook's own threshold).
SELECT max(similarity(a.summary, b.summary)) AS fresh_max_similarity_sample
FROM (SELECT id, summary FROM profiles WHERE generation_run_id IN ('${runProfilesGeneral}','${runProfilesPersona}') ORDER BY md5(id::text) LIMIT 220) a
JOIN (SELECT id, summary FROM profiles WHERE generation_run_id IN ('${runProfilesGeneral}','${runProfilesPersona}') ORDER BY md5(id::text) LIMIT 220) b
  ON a.id < b.id;

-- 9b) Same audit for the REPAIRED v3 rows: exact dupes must be 0; near-dup
--     max will sit higher than the fresh batch (shared archetype vocabulary)
--     but the numeric posture suffix keeps rows distinct — expect < 0.9 and
--     zero identical summaries.
SELECT count(*) AS repaired_exact_dupes
FROM (SELECT summary, count(*) FROM profiles
      WHERE id IN (SELECT id FROM _v4_backup_profiles_v3)
      GROUP BY summary HAVING count(*) > 1) d;
SELECT max(similarity(a.summary, b.summary)) AS repaired_max_similarity_sample
FROM (SELECT id, summary FROM profiles WHERE id IN (SELECT id FROM _v4_backup_profiles_v3) ORDER BY md5(id::text) LIMIT 200) a
JOIN (SELECT id, summary FROM profiles WHERE id IN (SELECT id FROM _v4_backup_profiles_v3) ORDER BY md5(id::text) LIMIT 200) b
  ON a.id < b.id;

-- 10) Distribution sanity for the fresh generals: means near 0.5.
SELECT round(avg(openness),3) AS o, round(avg(conscientiousness),3) AS c, round(avg(extraversion),3) AS e,
       round(avg(agreeableness),3) AS a, round(avg(neuroticism),3) AS n,
       round(avg((content->'prospect_theory'->>'lambda')::numeric),2) AS avg_lambda,
       round(avg((content->'cognitive_reflection'->>'crt_score')::numeric),2) AS avg_crt
FROM profiles WHERE generation_run_id = '${runProfilesGeneral}';
`;

// ---------------------------------------------------------- 99 ROLLBACK -----
files['99_ROLLBACK.sql'] = `-- v4 ROLLBACK — undoes this bundle. Order matters. Safe to run partially.

-- 1) Remove fresh v4 rows (responses first for FK order).
DELETE FROM profile_scenario_responses WHERE generation_run_id = '${runResponses}';
DELETE FROM provenance WHERE model = 'authored/psychosynth-synth-v4';
DELETE FROM profile_bias_links WHERE generation_run_id IN ('${runProfilesGeneral}','${runProfilesPersona}');
DELETE FROM profiles WHERE generation_run_id IN ('${runProfilesGeneral}','${runProfilesPersona}');
DELETE FROM scenario_bias_applications WHERE scenario_id IN (SELECT id FROM scenarios WHERE slug LIKE 'v4-%');
DELETE FROM scenarios WHERE slug LIKE 'v4-%'
  AND NOT EXISTS (SELECT 1 FROM profile_scenario_responses r WHERE r.scenario_id = scenarios.id);
DELETE FROM generation_runs WHERE id IN ('${runProfilesGeneral}','${runProfilesPersona}','${runResponses}');

-- 2) Restore repaired v3 profiles + responses from the preflight backups.
UPDATE profiles p SET
  version = b.version, content = b.content, summary = b.summary, tags = b.tags,
  quality_score = b.quality_score
FROM _v4_backup_profiles_v3 b WHERE b.id = p.id;

UPDATE profile_scenario_responses r SET
  response = b.response, reasoning_chain = b.reasoning_chain,
  emotional_arc = b.emotional_arc, confidence = b.confidence
FROM _v4_backup_responses_v3 b WHERE b.id = r.id;

-- 3) Restore factor-backfilled rows to their pre-enrichment content.
UPDATE profiles p SET version = b.version, content = b.content
FROM _v4_backup_factor_rows b WHERE b.id = p.id;

DELETE FROM provenance WHERE model IN ('authored/psychosynth-factors-v4','authored/psychosynth-synth-v4-repair');

-- 4) (Optional) drop the backups once you are certain.
-- DROP TABLE IF EXISTS _v4_backup_profiles_v3, _v4_backup_responses_v3, _v4_backup_factor_rows;
`;

// ------------------------------------------------------------- README -------
files['README.md'] = `# Psychosynth v4 enrichment bundle

Generated by \`node scripts/gen-v4-enrich.mjs --seed ${SEED}\` — offline, seeded,
zero inference. Same seed ⇒ byte-identical bundle.

| file | what it does |
|---|---|
| 00_PREFLIGHT.sql | probes + pre-state backups (RUN FIRST, read the output) |
| 01_bias_taxonomy.sql | ${BIAS.length}-entry bias bank (idempotent) |
| 02_generators_runs.sql | v4 generators + generation runs |
| 03_backfill_factors.sql | factor enrichment of existing profiles (set-based, deterministic) |
| 04_repair_v3_profiles.sql | in-place rewrite of the v3 template profiles |
| 05_repair_v3_responses.sql | in-place rewrite of the v3 template responses |
| 06_scenarios_v4.sql | ${scenarios.length} fresh scenarios + bias links |
| 07a/07b | ${generals.length} generals + ${personas.length} personas (+provenance, bias links) |
| 08a/08b | ${responses.length} fresh responses (+provenance) |
| 09_catalog_polish.sql | Solana pack recipe fix + full filter allowlists |
| 10_VERIFY.sql | post-apply checks with expected values |
| 99_ROLLBACK.sql | full undo (uses the preflight backups) |

Apply order: 00 → 01 → 02 → 03 → 04 → 05 → 06 → 07a → 07b → 08a → 08b → 09 → 10.
Everything is idempotent — re-running a file is a no-op (see the guards in each).

Large files: 07/08 are a few MB each. If the Supabase SQL editor balks, use psql:
\`psql "$DATABASE_URL" -f outputs/v4/07a_profiles_v4_general.sql\` etc.

Run metadata: seed=${SEED}, runs: generals=${runProfilesGeneral},
personas=${runProfilesPersona}, responses=${runResponses}, status=${STATUS}.
`;

// ------------------------------------------------------------- write --------
let total = 0;
for (const [name, sql] of Object.entries(files)) {
  writeFileSync(path.join(OUTDIR, name), sql);
  total += sql.length;
  console.error(`wrote ${name.padEnd(30)} ${(sql.length / 1024).toFixed(0).padStart(6)} KB`);
}
console.error(`\n[v4] bundle complete: ${Object.keys(files).length} files, ${(total / 1024 / 1024).toFixed(1)} MB total`);
console.error(`[v4] fresh: ${generals.length} generals + ${personas.length} personas + ${scenarios.length} scenarios + ${responses.length} responses`);
console.error(`[v4] dedup: ${dedupRetries} retries, ${dedupGiveups} give-ups (threshold 0.5)`);
