#!/usr/bin/env node
/*
 * enrich-doppler-a2a.mjs — supplemental v4 batch (roadmap #2).
 *
 * Additive, no schema/resolver change. Produces:
 *   - Doppler bonding-curve "exit psychology" personas (tagged robinhood /
 *     retail-trading / doppler → ride the existing robinhood-counterparty-pack,
 *     or chain:base → personality library), plus their conditioned responses to
 *     trading scenarios.
 *   - Agent-to-agent (x402) counterparty personas + their responses to the new
 *     a2a negotiation scenarios (reliability disputes, volume-discount haggling,
 *     SLA-breach renegotiation, …) → land in behavioral-response-library.
 *
 * Same authored engines (synth/behavior/psychometrics), same SQL-first output.
 *
 * Usage:
 *   node scripts/enrich-doppler-a2a.mjs --dry
 *   node scripts/enrich-doppler-a2a.mjs --seed doppler-a2a-v1
 */
import { createRequire } from 'module';
import * as fs from 'fs';
import * as path from 'path';

const require = createRequire(import.meta.url);
const S = require('./lib/synth.js');
const B = require('./lib/behavior.js');
const P = require('./lib/psychometrics.js');
const { ARCHETYPES } = require('./lib/archetypes.js');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
}
const DRY = process.argv.includes('--dry');
const SEED = String(arg('seed', 'doppler-a2a-v1'));
const N_DOPPLER = parseInt(arg('doppler', '900'), 10);
const N_AGENT = parseInt(arg('agent', '400'), 10);
const N_A2A_SCEN = parseInt(arg('a2a-scenarios', '48'), 10);
const N_TRADE_SCEN = parseInt(arg('trade-scenarios', '24'), 10);
const OUT = String(arg('out', 'outputs/doppler-a2a-v1'));

const sqlStr = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const sqlJson = (o) => sqlStr(JSON.stringify(o)) + '::jsonb';
const sqlArr = (a) => 'ARRAY[' + a.map(sqlStr).join(',') + ']::text[]';
const sqlNum = (n) => (n === null || n === undefined || Number.isNaN(n) ? 'NULL' : String(n));
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

const GEN_SLUG = 'psychosynth-synth-v4';
const GEN_VER = 4;
const MODEL = 'authored/psychosynth-synth-v2';

const rng = S.makeRng(SEED);
const metaRng = S.makeRng(SEED + ':meta');
const RUN_ID = P.uuid(metaRng);
const GEN_ID = P.uuid(metaRng);

const dopplerPool = ARCHETYPES.filter((a) => a.tags.includes('doppler'));
const agentPool = ARCHETYPES.filter((a) => a.tags.includes('x402'));
if (!dopplerPool.length || !agentPool.length) throw new Error('empty archetype pool');

console.log(`[doppler-a2a] seed=${SEED} doppler=${N_DOPPLER} agent=${N_AGENT} dry=${DRY}`);
console.log(`  doppler archetypes: ${dopplerPool.map((a) => a.key).join(', ')}`);
console.log(`  agent archetypes:   ${agentPool.map((a) => a.key).join(', ')}`);

// profiles
const profiles = [];
for (let i = 0; i < N_DOPPLER; i++) profiles.push({ ...P.buildFullProfile(rng, { archetype: S.R.pick(rng, dopplerPool) }), kind: 'doppler' });
for (let i = 0; i < N_AGENT; i++) profiles.push({ ...P.buildFullProfile(rng, { archetype: S.R.pick(rng, agentPool) }), kind: 'agent' });
const dopplerProfiles = profiles.filter((p) => p.kind === 'doppler');
const agentProfiles = profiles.filter((p) => p.kind === 'agent');

// scenarios: a2a negotiation (from A2A_SCENARIOS) + doppler trading
const BATCH_TAG = SEED.replace(/[^a-z0-9]+/gi, '').slice(0, 10).toLowerCase();
const scenarios = [];
for (let i = 0; i < N_A2A_SCEN; i++) {
  const tpl = B.A2A_SCENARIOS[i % B.A2A_SCENARIOS.length];
  const sc = B.fillScenario(rng, 'negotiation', tpl);
  scenarios.push({ id: P.uuid(rng), slug: `${B.slugify(sc.title)}-a2a-${BATCH_TAG}-${i}`.slice(0, 64), category: sc.category, title: sc.title, description: sc.description, kind: 'a2a' });
}
for (let i = 0; i < N_TRADE_SCEN; i++) {
  const sc = B.buildScenario(rng, 'trading');
  scenarios.push({ id: P.uuid(rng), slug: `${B.slugify(sc.title)}-dop-${BATCH_TAG}-${i}`.slice(0, 64), category: sc.category, title: sc.title, description: sc.description, kind: 'trade' });
}
const a2aScen = scenarios.filter((s) => s.kind === 'a2a');
const tradeScen = scenarios.filter((s) => s.kind === 'trade');

// responses: agents × a2a scenarios; doppler personas × trading scenarios
const responses = [];
function respond(profArr, scenArr, n) {
  for (let i = 0; i < n; i++) {
    const prof = profArr[Math.floor(rng() * profArr.length)];
    const sc = scenArr[Math.floor(rng() * scenArr.length)];
    const r = B.buildResponse(rng, prof.content, sc);
    responses.push({ id: P.uuid(rng), profile_id: prof.id, scenario_id: sc.id, response: r.response, reasoning_chain: r.reasoning_chain, emotional_arc: r.emotional_arc, confidence: r.confidence, _bucket: B.posture(prof.content.big_five).bucket, _n: prof.content.big_five.neuroticism });
  }
}
respond(agentProfiles, a2aScen, Math.round(N_AGENT * 3));       // a2a negotiation responses
respond(dopplerProfiles, tradeScen, Math.round(N_DOPPLER * 1.2)); // doppler exit responses

// QA
const summaries = profiles.map((p) => p.content.summary);
const distinctRatio = new Set(summaries).size / summaries.length;
let batchTagged = 0, badTag = 0, schemaBad = 0;
for (const p of profiles) {
  for (const t of p.content.tags) { if (/^batch-/.test(t)) batchTagged++; if (!/^[a-z0-9:-]+$/.test(t)) badTag++; }
  const c = p.content;
  if (!/^[EI][NS][TF][JP]$/.test(c.mbti_label)) schemaBad++;
  if (c.prospect_theory.lambda < 0.5 || c.prospect_theory.lambda > 5) schemaBad++;
}
const byBucket = {};
for (const r of responses) (byBucket[r._bucket] ||= []).push(r._n);
const meanN = {}; for (const k of Object.keys(byBucket)) meanN[k] = +(byBucket[k].reduce((a, b) => a + b, 0) / byBucket[k].length).toFixed(3);
const robinhoodEligible = dopplerProfiles.filter((p) => p.content.tags.some((t) => t === 'robinhood' || t === 'retail-trading')).length;

const QA = {
  profiles: profiles.length, doppler: dopplerProfiles.length, agent: agentProfiles.length,
  scenarios: scenarios.length, responses: responses.length,
  distinctSummaryRatio: +distinctRatio.toFixed(4), batchTagged, badTag, schemaViolations: schemaBad,
  robinhoodPackEligibleDoppler: robinhoodEligible, meanNeuroticismByPostureBucket: meanN,
};
console.log('\n=== QA ===\n' + JSON.stringify(QA, null, 2));

const gates = [];
if (QA.distinctSummaryRatio < 0.97) gates.push(`distinct ratio ${QA.distinctSummaryRatio}`);
if (batchTagged || badTag || schemaBad) gates.push('tag/schema violations');
const mb = Object.values(meanN); if (mb.length >= 2 && (Math.max(...mb) - Math.min(...mb)) < 0.12) gates.push('posture not conditioned');
if (gates.length) { console.log('[GATES FAILED] ' + gates.join('; ')); if (!DRY) process.exit(1); }
else console.log('[GATES PASSED]');
if (DRY) { console.log('--dry: no SQL written.'); process.exit(gates.length ? 1 : 0); }

// emit SQL
fs.mkdirSync(OUT, { recursive: true });
const provParams = { seed: SEED, engine: 'psychosynth-synth-v4', batch: 'doppler-a2a', authored: true };
const tHash = P.sha256('doppler-a2a:' + SEED);
const files = {};

files['00_generation_run.sql'] = `-- doppler-a2a supplemental batch — engine + run (idempotent).
INSERT INTO generators (id, slug, version, entity_type, description, prompt_template, params_schema, output_schema, model_config, hooks, status)
VALUES (${sqlStr(GEN_ID)}, ${sqlStr(GEN_SLUG)}, ${GEN_VER}, 'profile', 'Offline authored synthesis v4 (enrichment).', 'authored:offline-synthesis-engine', '{}'::jsonb, '{}'::jsonb, '{"provider":"authored","model":"psychosynth-synth-v2","seed_strategy":"deterministic"}'::jsonb, '[{"type":"schema_validate"},{"type":"dedup"},{"type":"provenance_stamp"}]'::jsonb, 'active')
ON CONFLICT (slug, version) DO NOTHING;
INSERT INTO generation_runs (id, generator_id, generator_slug, generator_ver, params, model_used, items_requested, items_created, items_auto_approved, status, finished_at)
VALUES (${sqlStr(RUN_ID)}, (SELECT id FROM generators WHERE slug=${sqlStr(GEN_SLUG)} AND version=${GEN_VER}), ${sqlStr(GEN_SLUG)}, ${GEN_VER}, ${sqlJson({ seed: SEED, batch: 'doppler-a2a', doppler: N_DOPPLER, agent: N_AGENT })}, ${sqlStr(MODEL)}, ${profiles.length + responses.length}, ${profiles.length + responses.length}, ${profiles.length + responses.length}, 'done', now())
ON CONFLICT (id) DO NOTHING;
`;
{
  const vals = scenarios.map((s) => `(${sqlStr(s.id)}, ${sqlStr(s.slug)}, ${sqlStr(s.category)}, ${sqlStr(s.title)}, ${sqlStr(s.description)})`);
  files['01_scenarios.sql'] = '-- a2a negotiation + doppler trading scenarios (unique slugs).\n'
    + chunk(vals, 200).map((c) => `INSERT INTO scenarios (id, slug, category, title, description) VALUES\n${c.join(',\n')}\nON CONFLICT (slug) DO NOTHING;`).join('\n\n') + '\n';
}
{
  const vals = profiles.map((p) => `(${sqlStr(p.id)}, 1, ${sqlJson(p.content)}, ${sqlJson(p.content.big_five)}, ${sqlStr(p.content.mbti_label)}, ${sqlStr(p.content.decision_style)}, ${sqlArr(p.content.tags)}, ${sqlStr(p.content.summary)}, ${sqlNum(p.row.quality_score)}, 'approved', ${sqlStr(RUN_ID)})`);
  files['02_profiles.sql'] = '-- Doppler exit + a2a agent personas (approved).\n'
    + chunk(vals, 400).map((c) => `INSERT INTO profiles (id, version, content, big_five, mbti_label, decision_style, tags, summary, quality_score, status, generation_run_id) VALUES\n${c.join(',\n')}\nON CONFLICT (id) DO NOTHING;`).join('\n\n') + '\n';
}
{
  const vals = responses.map((r) => `(${sqlStr(r.id)}, ${sqlStr(r.profile_id)}, ${sqlStr(r.scenario_id)}, ${sqlStr(r.response)}, ${sqlStr(r.reasoning_chain)}, ${sqlStr(r.emotional_arc)}, ${sqlNum(r.confidence)}, ${sqlStr(RUN_ID)})`);
  files['03_responses.sql'] = '-- Trait-conditioned responses (a2a negotiation + doppler exit).\n'
    + chunk(vals, 400).map((c) => `INSERT INTO profile_scenario_responses (id, profile_id, scenario_id, response, reasoning_chain, emotional_arc, confidence, generation_run_id) VALUES\n${c.join(',\n')}\nON CONFLICT (id) DO NOTHING;`).join('\n\n') + '\n';
}
{
  const prov = [];
  for (const p of profiles) prov.push(`(${sqlStr(P.uuid(metaRng))}, 'profile', ${sqlStr(p.id)}, 1, ${sqlStr(MODEL)}, ${sqlStr(tHash)}, ${sqlStr(tHash)}, ${sqlJson(provParams)}, ${sqlStr(P.sha256(S.canonical(p.content)))})`);
  for (const r of responses) prov.push(`(${sqlStr(P.uuid(metaRng))}, 'profile_scenario_response', ${sqlStr(r.id)}, 1, ${sqlStr(MODEL)}, ${sqlStr(tHash)}, ${sqlStr(tHash)}, ${sqlJson(provParams)}, ${sqlStr(P.sha256(S.canonical({ response: r.response, reasoning_chain: r.reasoning_chain })))})`);
  files['04_provenance.sql'] = '-- Provenance stamps.\n'
    + chunk(prov, 400).map((c) => `INSERT INTO provenance (id, entity_type, entity_id, entity_version, model, prompt_hash, template_hash, params, sha256_content) VALUES\n${c.join(',\n')}\nON CONFLICT (entity_type, entity_id, entity_version) DO NOTHING;`).join('\n\n') + '\n';
}
files['APPLY_ALL.sql'] = `-- doppler-a2a supplemental batch. Run in order (or each file in the SQL editor).
\\set ON_ERROR_STOP on
\\i 00_generation_run.sql
\\i 01_scenarios.sql
\\i 02_profiles.sql
\\i 03_responses.sql
\\i 04_provenance.sql
`;

let total = 0;
for (const [name, body] of Object.entries(files)) { const fp = path.join(OUT, name); fs.writeFileSync(fp, body); total += Buffer.byteLength(body); console.log(`  wrote ${fp} (${(Buffer.byteLength(body) / 1024).toFixed(1)} KB)`); }
fs.writeFileSync(path.join(OUT, 'REPORT.json'), JSON.stringify(QA, null, 2));
console.log(`\n[done] ${(total / 1024 / 1024).toFixed(2)} MB -> ${OUT}`);
