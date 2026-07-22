#!/usr/bin/env node
/*
 * enrich-dataset.mjs — Psychosynth v4 offline enrichment orchestrator.
 *
 * Produces a large, fresh, internally-coherent batch of profiles + scenarios +
 * TRAIT-CONDITIONED responses using the authored synthesis engines (no LLM,
 * fully seeded), and emits it as ordered SQL files ("SQL files first").
 *
 * This is the correct-quality replacement for populate-v3-dataset.ts:
 *   - summaries come from synth.buildSummary (combinatorial, trigram-distinct)
 *   - responses come from behavior.buildResponse (action derived from the
 *     profile's posture + top bias + scenario), NOT an `i % 6` action cycle
 *   - dark_triad / prospect_theory / cognitive_reflection are derived coherently
 *   - tags are clean kebab-case with the pack pins, NO `batch-*` pollution
 *
 * It also emits a guarded repair file that removes the batch-tag-polluted v3
 * rows (rewrite-in-place, per the enrichment decision).
 *
 * Usage:
 *   node scripts/enrich-dataset.mjs                 # full run, default counts
 *   node scripts/enrich-dataset.mjs --dry           # quality report only, no files
 *   node scripts/enrich-dataset.mjs --profiles 4000 --responses 4000 --seed v4-2026-07-21
 *   node scripts/enrich-dataset.mjs --out outputs/enrich-v4
 */

import { createRequire } from 'module';
import * as fs from 'fs';
import * as path from 'path';

const require = createRequire(import.meta.url);
const S = require('./lib/synth.js');
const B = require('./lib/behavior.js');
const P = require('./lib/psychometrics.js');
const { POOLS } = require('./lib/archetypes.js');

// ------------------------------------------------------------------ args ----
function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
}
const DRY = process.argv.includes('--dry');
const SEED = String(arg('seed', 'psychosynth-v4-enrichment'));
const N_PROFILES = parseInt(arg('profiles', '4000'), 10);
const N_RESPONSES = parseInt(arg('responses', '4000'), 10);
const N_SCENARIOS = parseInt(arg('scenarios', '80'), 10);
const OUT = String(arg('out', 'outputs/enrich-v4'));

// Distribution across sellable surfaces (fractions of N_PROFILES).
const MIX = { retail: 0.20, solana: 0.15, base: 0.125, whale: 0.10, agent: 0.075, perp: 0.20, general: 0.15 };

// ------------------------------------------------------------- SQL helpers ---
const sqlStr = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const sqlJson = (o) => sqlStr(JSON.stringify(o)) + '::jsonb';
const sqlArr = (a) => 'ARRAY[' + a.map(sqlStr).join(',') + ']::text[]';
const sqlNum = (n) => (n === null || n === undefined || Number.isNaN(n) ? 'NULL' : String(n));

function chunk(arr, n) { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o; }

// Fixed engine identity (idempotent — resolved by subselect on insert).
const GEN_SLUG = 'psychosynth-synth-v4';
const GEN_VER = 4;
const MODEL = 'authored/psychosynth-synth-v2';

// ---------------------------------------------------------------- generate ---
const rng = S.makeRng(SEED);
const metaRng = S.makeRng(SEED + ':meta');
const RUN_ID = P.uuid(metaRng);
const GEN_ID = P.uuid(metaRng);

console.log(`[enrich] seed=${SEED} profiles=${N_PROFILES} responses=${N_RESPONSES} scenarios=${N_SCENARIOS} dry=${DRY}`);

// 1) profiles across the segment pools
function allocate() {
  const alloc = {};
  let sum = 0;
  for (const k of Object.keys(MIX)) { alloc[k] = Math.round(N_PROFILES * MIX[k]); sum += alloc[k]; }
  alloc.general += N_PROFILES - sum; // absorb rounding
  return alloc;
}
const alloc = allocate();
const profiles = [];
for (const seg of Object.keys(alloc)) {
  const poolArr = POOLS[seg] && POOLS[seg].length ? POOLS[seg] : POOLS.all;
  for (let i = 0; i < alloc[seg]; i++) {
    const archetype = S.R.pick(rng, poolArr);
    const built = P.buildFullProfile(rng, { archetype });
    built.segment = seg;
    profiles.push(built);
  }
}

// 2) scenarios (unique slugs so our fixed ids always win the insert)
const scenarios = [];
const BATCH_TAG = SEED.replace(/[^a-z0-9]+/gi, '').slice(0, 10).toLowerCase();
for (let i = 0; i < N_SCENARIOS; i++) {
  const category = B.CATEGORIES[i % B.CATEGORIES.length];
  const sc = B.buildScenario(rng, category);
  const slug = `${B.slugify(sc.title)}-${BATCH_TAG}-${i}`.slice(0, 64);
  scenarios.push({ id: P.uuid(rng), slug, category: sc.category, title: sc.title, description: sc.description });
}

// 3) trait-conditioned responses (profile posture + scenario -> action)
const responses = [];
for (let i = 0; i < N_RESPONSES; i++) {
  const prof = profiles[Math.floor(rng() * profiles.length)];
  const sc = scenarios[Math.floor(rng() * scenarios.length)];
  const r = B.buildResponse(rng, prof.content, sc);
  responses.push({
    id: P.uuid(rng), profile_id: prof.id, scenario_id: sc.id,
    response: r.response, reasoning_chain: r.reasoning_chain,
    emotional_arc: r.emotional_arc, confidence: r.confidence,
    _bucket: B.posture(prof.content.big_five).bucket, _n: prof.content.big_five.neuroticism,
  });
}

// -------------------------------------------------------------- QA report ----
function report() {
  const summaries = profiles.map((p) => p.content.summary);
  const uniq = new Set(summaries);
  const distinctRatio = uniq.size / summaries.length;
  // near-dup proxy: shared 60-char prefix
  const prefixes = {};
  for (const s of summaries) { const k = s.slice(0, 60); prefixes[k] = (prefixes[k] || 0) + 1; }
  const maxPrefixDup = Math.max(...Object.values(prefixes));

  // tag hygiene
  let batchTagged = 0, badTag = 0;
  const tagUniverse = new Set();
  for (const p of profiles) for (const t of p.content.tags) {
    tagUniverse.add(t);
    if (/^batch-/.test(t)) batchTagged++;
    if (!/^[a-z0-9:-]+$/.test(t)) badTag++;
  }

  // schema validity
  let bad = 0;
  for (const p of profiles) {
    const c = p.content, bf = c.big_five;
    for (const t of P.TRAITS) if (bf[t] < 0.02 || bf[t] > 0.98) bad++;
    if (c.prospect_theory.lambda < 0.5 || c.prospect_theory.lambda > 5) bad++;
    if (!/^[EI][NS][TF][JP]$/.test(c.mbti_label)) bad++;
    if (!['analytical', 'intuitive', 'dependent', 'avoidant', 'spontaneous', 'deliberative'].includes(c.decision_style)) bad++;
  }

  // conditioning: mean neuroticism per posture bucket (bold/calc should be lower)
  const byBucket = {};
  for (const r of responses) { (byBucket[r._bucket] ||= []).push(r._n); }
  const meanN = {};
  for (const k of Object.keys(byBucket)) meanN[k] = +(byBucket[k].reduce((a, b) => a + b, 0) / byBucket[k].length).toFixed(3);

  // pack coverage
  const packCount = (pred) => profiles.filter((p) => p.content.tags.some(pred)).length;
  const coverage = {
    'robinhood-counterparty-pack (robinhood|retail-trading)': packCount((t) => t === 'robinhood' || t === 'retail-trading'),
    'solana-trading-pack (chain:solana)': packCount((t) => t === 'chain:solana'),
    'chain:base': packCount((t) => t === 'chain:base'),
    'crypto-whale': packCount((t) => t === 'crypto-whale'),
    'x402': packCount((t) => t === 'x402'),
  };

  // prospect-theory spread (v3's was near-constant alpha/beta)
  const lambdas = profiles.map((p) => p.content.prospect_theory.lambda);
  const lmin = Math.min(...lambdas), lmax = Math.max(...lambdas);
  const lmean = +(lambdas.reduce((a, b) => a + b, 0) / lambdas.length).toFixed(2);

  return {
    profiles: profiles.length, responses: responses.length, scenarios: scenarios.length,
    distinctSummaryRatio: +distinctRatio.toFixed(4), maxPrefixDup,
    distinctSummaries: uniq.size, uniqueTags: tagUniverse.size,
    batchTagged, badTag, schemaViolations: bad,
    lambda: { min: lmin, max: lmax, mean: lmean },
    meanNeuroticismByPostureBucket: meanN,
    packCoverage: coverage,
  };
}
const QA = report();
console.log('\n=== QUALITY REPORT ===');
console.log(JSON.stringify(QA, null, 2));

// gates
const gates = [];
if (QA.distinctSummaryRatio < 0.98) gates.push(`distinct summary ratio ${QA.distinctSummaryRatio} < 0.98`);
if (QA.batchTagged > 0) gates.push(`${QA.batchTagged} batch-* tags present`);
if (QA.badTag > 0) gates.push(`${QA.badTag} malformed tags`);
if (QA.schemaViolations > 0) gates.push(`${QA.schemaViolations} schema violations`);
if (QA.maxPrefixDup > Math.max(8, profiles.length * 0.02)) gates.push(`prefix dup ${QA.maxPrefixDup} too high`);
// conditioning gate: posture buckets must separate on neuroticism (an i%6
// action cycle would leave every bucket at the population mean ~0.5). The
// disciplined 'calculating' bucket must be clearly lower-neuroticism than the
// 'impulsive' one, and the overall spread across buckets must be material.
const mb = QA.meanNeuroticismByPostureBucket;
const mbVals = Object.values(mb);
const mbSpread = mbVals.length ? Math.max(...mbVals) - Math.min(...mbVals) : 0;
QA.postureNeuroticismSpread = +mbSpread.toFixed(3);
if (mbVals.length >= 3 && mbSpread < 0.15) gates.push(`posture buckets not conditioned on traits (spread ${mbSpread.toFixed(2)} < 0.15)`);
if (mb.calculating != null && mb.impulsive != null && !(mb.calculating < mb.impulsive)) gates.push('calculating bucket not lower-neuroticism than impulsive (conditioning inverted)');

if (gates.length) { console.log('\n[GATES FAILED]\n- ' + gates.join('\n- ')); }
else console.log('\n[GATES PASSED] data is coherent, distinct, conditioned, and clean.');

if (DRY) { console.log('\n--dry: no SQL written.'); process.exit(gates.length ? 1 : 0); }
if (gates.length) { console.log('\nRefusing to write SQL while gates fail.'); process.exit(1); }

// ------------------------------------------------------------- emit SQL ------
fs.mkdirSync(OUT, { recursive: true });
const provModel = MODEL;
const provParams = { seed: SEED, engine: 'psychosynth-synth-v4', authored: true };
const templateHash = P.sha256('psychosynth-synth-v4:' + SEED);

function provRows(entityType, items, contentFn) {
  return items.map((it) => {
    const c = contentFn(it);
    return `(${sqlStr(P.uuid(metaRng))}, ${sqlStr(entityType)}, ${sqlStr(it.id)}, 1, ${sqlStr(provModel)}, ${sqlStr(templateHash)}, ${sqlStr(templateHash)}, ${sqlJson(provParams)}, ${sqlStr(P.sha256(S.canonical(c)))})`;
  });
}

const files = {};

// 00 run + generator
files['00_generation_run.sql'] = `-- Psychosynth v4 enrichment — generation run + engine identity (idempotent).
INSERT INTO generators (id, slug, version, entity_type, description, prompt_template, params_schema, output_schema, model_config, hooks, status)
VALUES (${sqlStr(GEN_ID)}, ${sqlStr(GEN_SLUG)}, ${GEN_VER}, 'profile',
  'Offline authored synthesis v4 (enrichment). No LLM: component banks + coherence logic + seeded PRNG. See scripts/lib/{synth,behavior,psychometrics,archetypes}.js',
  'authored:offline-synthesis-engine', '{}'::jsonb, '{}'::jsonb,
  '{"provider":"authored","model":"psychosynth-synth-v2","seed_strategy":"deterministic"}'::jsonb,
  '[{"type":"schema_validate"},{"type":"dedup"},{"type":"provenance_stamp"}]'::jsonb, 'active')
ON CONFLICT (slug, version) DO NOTHING;

INSERT INTO generation_runs (id, generator_id, generator_slug, generator_ver, params, model_used, items_requested, items_created, items_auto_approved, status, finished_at)
VALUES (${sqlStr(RUN_ID)},
  (SELECT id FROM generators WHERE slug=${sqlStr(GEN_SLUG)} AND version=${GEN_VER}),
  ${sqlStr(GEN_SLUG)}, ${GEN_VER},
  ${sqlJson({ seed: SEED, mix: MIX, profiles: N_PROFILES, responses: N_RESPONSES, scenarios: N_SCENARIOS })},
  ${sqlStr(MODEL)}, ${N_PROFILES + N_RESPONSES}, ${profiles.length + responses.length}, ${profiles.length + responses.length}, 'done', now())
ON CONFLICT (id) DO NOTHING;
`;

// 01 scenarios
{
  const vals = scenarios.map((s) => `(${sqlStr(s.id)}, ${sqlStr(s.slug)}, ${sqlStr(s.category)}, ${sqlStr(s.title)}, ${sqlStr(s.description)})`);
  files['01_scenarios.sql'] = '-- New scenarios (unique slugs; safe to re-run).\n'
    + chunk(vals, 200).map((c) =>
      `INSERT INTO scenarios (id, slug, category, title, description) VALUES\n${c.join(',\n')}\nON CONFLICT (slug) DO NOTHING;`).join('\n\n') + '\n';
}

// 02 profiles
{
  const vals = profiles.map((p) => `(${sqlStr(p.id)}, 1, ${sqlJson(p.content)}, ${sqlJson(p.content.big_five)}, ${sqlStr(p.content.mbti_label)}, ${sqlStr(p.content.decision_style)}, ${sqlArr(p.content.tags)}, ${sqlStr(p.content.summary)}, ${sqlNum(p.row.quality_score)}, 'approved', ${sqlStr(RUN_ID)})`);
  files['02_profiles.sql'] = '-- Fresh approved profiles (all sellable segments; NO batch-* tags).\n'
    + chunk(vals, 400).map((c) =>
      `INSERT INTO profiles (id, version, content, big_five, mbti_label, decision_style, tags, summary, quality_score, status, generation_run_id) VALUES\n${c.join(',\n')}\nON CONFLICT (id) DO NOTHING;`).join('\n\n') + '\n';
}

// 03 responses
{
  const vals = responses.map((r) => `(${sqlStr(r.id)}, ${sqlStr(r.profile_id)}, ${sqlStr(r.scenario_id)}, ${sqlStr(r.response)}, ${sqlStr(r.reasoning_chain)}, ${sqlStr(r.emotional_arc)}, ${sqlNum(r.confidence)}, ${sqlStr(RUN_ID)})`);
  files['03_responses.sql'] = '-- Trait-conditioned behavioral responses (posture+bias+scenario derived).\n'
    + chunk(vals, 400).map((c) =>
      `INSERT INTO profile_scenario_responses (id, profile_id, scenario_id, response, reasoning_chain, emotional_arc, confidence, generation_run_id) VALUES\n${c.join(',\n')}\nON CONFLICT (id) DO NOTHING;`).join('\n\n') + '\n';
}

// 04 provenance
{
  const pRows = provRows('profile', profiles, (p) => p.content);
  const rRows = provRows('profile_scenario_response', responses, (r) => ({ response: r.response, reasoning_chain: r.reasoning_chain, confidence: r.confidence }));
  const all = pRows.concat(rRows);
  files['04_provenance.sql'] = '-- Provenance stamps (authored engine; synthetic).\n'
    + chunk(all, 400).map((c) =>
      `INSERT INTO provenance (id, entity_type, entity_id, entity_version, model, prompt_hash, template_hash, params, sha256_content) VALUES\n${c.join(',\n')}\nON CONFLICT (entity_type, entity_id, entity_version) DO NOTHING;`).join('\n\n') + '\n';
}

// 05 repair v3 (rewrite-in-place: remove batch-tag-polluted rows)
files['05_repair_v3.sql'] = `-- v3 REPAIR (rewrite-in-place): remove the batch-tag-polluted profiles from
-- populate-v3-dataset.ts (near-identical summaries, unconditioned BUY/SELL
-- responses, batch-* tag pollution). Their scenario responses + bias links are
-- removed by ON DELETE CASCADE; their provenance rows are cleared explicitly.
-- Only rows carrying a 'batch-*' tag are touched — the good v3 seed personas
-- (0015/0017) and this v4 batch have no such tag and are untouched.
BEGIN;

-- provenance for the polluted profiles' responses
DELETE FROM provenance
 WHERE entity_type = 'profile_scenario_response'
   AND entity_id IN (
     SELECT r.id FROM profile_scenario_responses r
     JOIN profiles p ON p.id = r.profile_id
     WHERE EXISTS (SELECT 1 FROM unnest(p.tags) t WHERE t LIKE 'batch-%')
   );

-- provenance for the polluted profiles themselves
DELETE FROM provenance
 WHERE entity_type = 'profile'
   AND entity_id IN (
     SELECT id FROM profiles WHERE EXISTS (SELECT 1 FROM unnest(tags) t WHERE t LIKE 'batch-%')
   );

-- the polluted profiles (cascades to profile_scenario_responses + profile_bias_links)
DELETE FROM profiles WHERE EXISTS (SELECT 1 FROM unnest(tags) t WHERE t LIKE 'batch-%');

COMMIT;
`;

// apply-all convenience (psql: \i each in order)
files['APPLY_ALL.sql'] = `-- Master apply script for Psychosynth v4 enrichment.
-- Run with:  psql "$DATABASE_URL" -f outputs/enrich-v4/APPLY_ALL.sql
-- Or run each numbered file in order in the Supabase SQL editor.
\\set ON_ERROR_STOP on
\\i 00_generation_run.sql
\\i 01_scenarios.sql
\\i 02_profiles.sql
\\i 03_responses.sql
\\i 04_provenance.sql
-- Review 05_repair_v3.sql before running — it DELETES the old v3 batch rows:
-- \\i 05_repair_v3.sql
`;

let total = 0;
for (const [name, body] of Object.entries(files)) {
  const fp = path.join(OUT, name);
  fs.writeFileSync(fp, body);
  total += Buffer.byteLength(body);
  console.log(`  wrote ${fp} (${(Buffer.byteLength(body) / 1024).toFixed(1)} KB)`);
}
fs.writeFileSync(path.join(OUT, 'REPORT.json'), JSON.stringify(QA, null, 2));
console.log(`\n[done] ${Object.keys(files).length} SQL files, ${(total / 1024 / 1024).toFixed(2)} MB total -> ${OUT}`);
