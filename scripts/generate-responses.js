'use strict';
/*
 * Simulate how existing profiles respond to existing scenarios (L2 behavior).
 * Fetches profiles + scenarios from the DB, composes a coherent response,
 * reasoning chain, emotional arc, and confidence per pairing. No LLM.
 *
 *   node scripts/generate-responses.js --status approved --per 3 --max 400
 *   node scripts/generate-responses.js --dry
 *
 * --status  which profiles to use: approved (default) | pending | all
 * --per     scenarios paired per profile (default 3)
 * --max     hard cap on total responses (default 400)
 */
const path = require('path');
const fs = require('fs');
const S = require(path.join(__dirname, 'lib', 'synth.js'));
const B = require(path.join(__dirname, 'lib', 'behavior.js'));

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const STATUS = String(arg('status', 'approved'));
const PER = parseInt(arg('per', '3'), 10);
const MAX = parseInt(arg('max', '400'), 10);
const SEED = String(arg('seed', 'responses-' + new Date().toISOString().slice(0, 10)));
const DRY = !!arg('dry', false);

function loadEnv() {
  const p = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

// map a profile's domain tag to a preferred scenario category (soft preference)
function preferredCategory(profile) {
  const tags = (profile.tags || profile.content && profile.content.tags || []);
  if (tags.includes('trading')) return 'trading';
  if (tags.includes('negotiation')) return 'negotiation';
  if (tags.includes('social')) return 'social';
  if (tags.includes('workplace')) return 'crisis';
  return null;
}

function pairScenarios(rng, profile, scenarios, per) {
  const pref = preferredCategory(profile);
  const inCat = pref ? scenarios.filter(s => s.category === pref) : [];
  const rest = scenarios.filter(s => !inCat.includes(s));
  const chosen = [];
  // ~half from preferred category, rest random
  const wantPref = Math.min(inCat.length, Math.ceil(per / 2));
  chosen.push(...S.R.sample(rng, inCat, wantPref));
  chosen.push(...S.R.sample(rng, rest, per - chosen.length));
  return chosen.slice(0, per);
}

function dryRun() {
  const rng = S.makeRng(SEED);
  const profiles = [];
  for (let i = 0; i < 6; i++) { const { item } = S.buildProfile(rng); profiles.push({ id: 'p' + i, big_five: item.big_five, decision_style: item.decision_style, tags: item.tags, content: item, suggested_biases: item.suggested_biases }); }
  const scenarios = [];
  let n = 0;
  for (const c of B.CATEGORIES) for (let k = 0; k < 3; k++) { const sc = B.buildScenario(rng, c); scenarios.push({ id: 's' + (n++), category: c, title: sc.title, description: sc.description }); }
  let total = 0, badConf = 0, empty = 0;
  const samples = [];
  for (const p of profiles) {
    for (const sc of pairScenarios(rng, p, scenarios, PER)) {
      const r = B.buildResponse(rng, p, sc);
      total++;
      if (!(r.confidence >= 0 && r.confidence <= 1)) badConf++;
      if (!r.response || !r.reasoning_chain || !r.emotional_arc) empty++;
      if (samples.length < 3) samples.push({ p, sc, r });
    }
  }
  console.log(`DRY: ${profiles.length} profiles x ${PER} = ${total} responses. bad_confidence=${badConf}, empty_fields=${empty}`);
  for (const { p, sc, r } of samples) {
    console.log(`\n[${p.content.mbti_label}/${p.decision_style}] -> [${sc.category}] ${sc.title}`);
    console.log(`  response: ${r.response}`);
    console.log(`  reasoning: ${r.reasoning_chain}`);
    console.log(`  arc: ${r.emotional_arc} (conf ${r.confidence})`);
  }
  console.log('\nDRY run — no database writes.');
}

async function main() {
  if (DRY) return dryRun();
  loadEnv();
  const { createClient } = require('@supabase/supabase-js');
  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const rng = S.makeRng(SEED);

  let pq = supa.from('profiles').select('id, big_five, decision_style, tags, content');
  if (STATUS !== 'all') pq = pq.eq('status', STATUS);
  const { data: profiles, error: pErr } = await pq.limit(2000);
  if (pErr) throw pErr;
  const { data: scenarios, error: sErr } = await supa.from('scenarios').select('id, category, title, description').limit(2000);
  if (sErr) throw sErr;
  if (!profiles.length || !scenarios.length) { console.log(`Nothing to do: ${profiles.length} profiles (status=${STATUS}), ${scenarios.length} scenarios.`); return; }

  const { data: gen } = await supa.from('generators').select('id, slug, version').eq('slug', 'response-gen').eq('status', 'active').order('version', { ascending: false }).limit(1).single();
  const { data: run, error: rErr } = await supa.from('generation_runs').insert({
    generator_id: gen ? gen.id : null, generator_slug: 'response-gen', generator_ver: gen ? gen.version : 1,
    params: { source: 'authored-synthesis', per: PER, status: STATUS, seed: SEED },
    model_used: 'authored/psychosynth-synth-v1', items_requested: Math.min(MAX, profiles.length * PER), status: 'running',
  }).select().single();
  if (rErr) throw rErr;

  let created = 0;
  outer: for (const p of profiles) {
    for (const sc of pairScenarios(rng, p, scenarios, PER)) {
      if (created >= MAX) break outer;
      const r = B.buildResponse(rng, p, sc);
      const { data: row, error: iErr } = await supa.from('profile_scenario_responses').insert({
        profile_id: p.id, scenario_id: sc.id, response: r.response,
        reasoning_chain: r.reasoning_chain, emotional_arc: r.emotional_arc,
        confidence: r.confidence, generation_run_id: run.id,
      }).select('id').single();
      if (iErr) { console.error('response insert failed:', iErr.message); continue; }
      created++;
      await supa.from('provenance').insert({
        entity_type: 'profile_scenario_response', entity_id: row.id, entity_version: 1,
        model: 'authored/psychosynth-synth-v1',
        prompt_hash: S.sha256(`response profile=${p.id} scenario=${sc.id} seed=${SEED}`),
        template_hash: S.sha256('authored-response-synth-v1'),
        params: { source: 'authored-synthesis', pattern: r.emotional_pattern, seed: SEED },
        sha256_content: S.sha256(S.canonical(r)),
      });
    }
  }
  await supa.from('generation_runs').update({ items_created: created, status: 'done', finished_at: new Date().toISOString() }).eq('id', run.id);
  console.log(`Inserted ${created} scenario responses. Run ${run.id}.`);
}
main().catch(e => { console.error('FATAL', e.message || e); process.exit(1); });
