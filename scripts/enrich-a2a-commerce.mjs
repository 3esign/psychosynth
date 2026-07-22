#!/usr/bin/env node
/*
 * enrich-a2a-commerce.mjs — Bankr a2a service-commerce pack generator.
 *
 * Generates x402 skill-pricing, retry-etiquette, and SLA-dispute agent counterparties,
 * scenarios, and conditioned responses.
 *
 * Usage:
 *   node scripts/enrich-a2a-commerce.mjs --dry
 *   node scripts/enrich-a2a-commerce.mjs --seed a2a-commerce-v1
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
const SEED = String(arg('seed', 'a2a-commerce-v1'));
const N_PROFILES = parseInt(arg('profiles', '1000'), 10);
const N_SCENARIOS = parseInt(arg('scenarios', '48'), 10);
const OUT = String(arg('out', 'outputs/enrich-a2a-commerce'));

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

const agentPool = ARCHETYPES.filter((a) => a.tags.includes('x402') || a.tags.includes('negotiation'));
if (!agentPool.length) throw new Error('empty archetype pool');

console.log(`[a2a-commerce] seed=${SEED} profiles=${N_PROFILES} scenarios=${N_SCENARIOS} dry=${DRY}`);

// profiles
const profiles = [];
for (let i = 0; i < N_PROFILES; i++) {
  const arch = S.R.pick(rng, agentPool);
  const p = P.buildFullProfile(rng, { archetype: arch });
  // Add a2a-commerce pack tags
  p.content.tags = Array.from(new Set([...p.content.tags, 'a2a-commerce', 'skill-pricing', 'retry-etiquette', 'sla-dispute']));
  profiles.push(p);
}

// scenarios: a2a negotiation
const BATCH_TAG = SEED.replace(/[^a-z0-9]+/gi, '').slice(0, 10).toLowerCase();
const scenarios = [];
for (let i = 0; i < N_SCENARIOS; i++) {
  const tpl = B.A2A_SCENARIOS[i % B.A2A_SCENARIOS.length];
  const sc = B.fillScenario(rng, 'negotiation', tpl);
  scenarios.push({
    id: P.uuid(rng),
    slug: `${B.slugify(sc.title)}-a2a-biz-${BATCH_TAG}-${i}`.slice(0, 64),
    category: sc.category,
    title: sc.title,
    description: sc.description,
  });
}

// responses: 3 per profile
const responses = [];
for (let i = 0; i < N_PROFILES * 3; i++) {
  const prof = profiles[Math.floor(rng() * profiles.length)];
  const sc = scenarios[Math.floor(rng() * scenarios.length)];
  const r = B.buildResponse(rng, prof.content, sc);
  responses.push({
    id: P.uuid(rng),
    profile_id: prof.id,
    scenario_id: sc.id,
    response: r.response,
    reasoning_chain: r.reasoning_chain,
    emotional_arc: r.emotional_arc,
    confidence: r.confidence,
    _bucket: B.posture(prof.content.big_five).bucket,
    _n: prof.content.big_five.neuroticism,
  });
}

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

const QA = {
  profiles: profiles.length, scenarios: scenarios.length, responses: responses.length,
  distinctSummaryRatio: +distinctRatio.toFixed(4), batchTagged, badTag, schemaViolations: schemaBad,
  meanNeuroticismByPostureBucket: meanN,
  tagsPinned: ['a2a-commerce', 'skill-pricing', 'retry-etiquette', 'sla-dispute'],
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
const provParams = { seed: SEED, engine: 'psychosynth-synth-v4', batch: 'enrich-a2a-commerce', authored: true };
const tHash = P.sha256('enrich-a2a-commerce:' + SEED);
const files = {};

files['00_generation_run.sql'] = `-- enrich-a2a-commerce batch — engine + run (idempotent).
INSERT INTO generators (id, slug, version, entity_type, description, prompt_template, params_schema, output_schema, model_config, hooks, status)
VALUES (${sqlStr(GEN_ID)}, ${sqlStr(GEN_SLUG)}, ${GEN_VER}, 'profile', 'Offline authored synthesis v4 (enrichment).', 'authored:offline-synthesis-engine', '{}'::jsonb, '{}'::jsonb, '{"provider":"authored","model":"psychosynth-synth-v2","seed_strategy":"deterministic"}'::jsonb, '[{"type":"schema_validate"},{"type":"dedup"},{"type":"provenance_stamp"}]'::jsonb, 'active')
ON CONFLICT (slug, version) DO NOTHING;
INSERT INTO generation_runs (id, generator_id, generator_slug, generator_ver, params, model_used, items_requested, items_created, items_auto_approved, status, finished_at)
VALUES (${sqlStr(RUN_ID)}, (SELECT id FROM generators WHERE slug=${sqlStr(GEN_SLUG)} AND version=${GEN_VER}), ${sqlStr(GEN_SLUG)}, ${GEN_VER}, ${sqlJson({ seed: SEED, batch: 'enrich-a2a-commerce', profiles: N_PROFILES })}, ${sqlStr(MODEL)}, ${profiles.length + responses.length}, ${profiles.length + responses.length}, ${profiles.length + responses.length}, 'done', now())
ON CONFLICT (id) DO NOTHING;
`;
{
  const vals = scenarios.map((s) => `(${sqlStr(s.id)}, ${sqlStr(s.slug)}, ${sqlStr(s.category)}, ${sqlStr(s.title)}, ${sqlStr(s.description)})`);
  files['01_scenarios.sql'] = '-- a2a commerce scenarios (unique slugs).\n'
    + chunk(vals, 200).map((c) => `INSERT INTO scenarios (id, slug, category, title, description) VALUES\n${c.join(',\n')}\nON CONFLICT (slug) DO NOTHING;`).join('\n\n') + '\n';
}
{
  const vals = profiles.map((p) => `(${sqlStr(p.id)}, 1, ${sqlJson(p.content)}, ${sqlJson(p.content.big_five)}, ${sqlStr(p.content.mbti_label)}, ${sqlStr(p.content.decision_style)}, ${sqlArr(p.content.tags)}, ${sqlStr(p.content.summary)}, ${sqlNum(p.row.quality_score)}, 'approved', ${sqlStr(RUN_ID)})`);
  files['02_profiles.sql'] = '-- a2a commerce personas (approved).\n'
    + chunk(vals, 400).map((c) => `INSERT INTO profiles (id, version, content, big_five, mbti_label, decision_style, tags, summary, quality_score, status, generation_run_id) VALUES\n${c.join(',\n')}\nON CONFLICT (id) DO NOTHING;`).join('\n\n') + '\n';
}
{
  const vals = responses.map((r) => `(${sqlStr(r.id)}, ${sqlStr(r.profile_id)}, ${sqlStr(r.scenario_id)}, ${sqlStr(r.response)}, ${sqlStr(r.reasoning_chain)}, ${sqlStr(r.emotional_arc)}, ${sqlNum(r.confidence)}, ${sqlStr(RUN_ID)})`);
  files['03_responses.sql'] = '-- Trait-conditioned responses.\n'
    + chunk(vals, 400).map((c) => `INSERT INTO profile_scenario_responses (id, profile_id, scenario_id, response, reasoning_chain, emotional_arc, confidence, generation_run_id) VALUES\n${c.join(',\n')}\nON CONFLICT (id) DO NOTHING;`).join('\n\n') + '\n';
}
{
  const prov = [];
  for (const p of profiles) prov.push(`(${sqlStr(P.uuid(metaRng))}, 'profile', ${sqlStr(p.id)}, 1, ${sqlStr(MODEL)}, ${sqlStr(tHash)}, ${sqlStr(tHash)}, ${sqlJson(provParams)}, ${sqlStr(P.sha256(S.canonical(p.content)))})`);
  for (const r of responses) prov.push(`(${sqlStr(P.uuid(metaRng))}, 'profile_scenario_response', ${sqlStr(r.id)}, 1, ${sqlStr(MODEL)}, ${sqlStr(tHash)}, ${sqlStr(tHash)}, ${sqlJson(provParams)}, ${sqlStr(P.sha256(S.canonical({ response: r.response, reasoning_chain: r.reasoning_chain })))})`);
  files['04_provenance.sql'] = '-- Provenance stamps.\n'
    + chunk(prov, 400).map((c) => `INSERT INTO provenance (id, entity_type, entity_id, entity_version, model, prompt_hash, template_hash, params, sha256_content) VALUES\n${c.join(',\n')}\nON CONFLICT (entity_type, entity_id, entity_version) DO NOTHING;`).join('\n\n') + '\n';
}
files['APPLY_ALL.sql'] = `-- enrich-a2a-commerce batch. Run in order.
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
