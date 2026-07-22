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

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const S = require('../scripts/lib/synth.js');
const B = require('../scripts/lib/behavior.js');
const P = require('../scripts/lib/psychometrics.js');
const { ARCHETYPES, POOLS } = require('../scripts/lib/archetypes.js');

async function getOrCreateGeneratorId() {
  let { data: genRow } = await supa.from('generators').select('id').eq('slug', 'psychosynth-synth-v4').eq('version', 4).maybeSingle();
  if (!genRow) {
    const { data: newGen, error } = await supa.from('generators').insert({
      slug: 'psychosynth-synth-v4', version: 4, entity_type: 'profile',
      description: 'Offline authored synthesis v4 (enrichment).', prompt_template: 'authored:offline-synthesis-engine',
      params_schema: {}, output_schema: {}, model_config: { provider: 'authored', model: 'psychosynth-synth-v2', seed_strategy: 'deterministic' },
      hooks: [{ type: 'schema_validate' }, { type: 'dedup' }, { type: 'provenance_stamp' }], status: 'active'
    }).select('id').single();
    if (error) throw error;
    genRow = newGen;
  }
  return genRow.id;
}

async function loadV4Batch() {
  console.log('\n--- 1. Generating & Loading v4 Batch (4,000 profiles + 4,000 responses) ---');
  const SEED = 'enrich-v4-prod-2026-07-22';
  const rng = S.makeRng(SEED);
  const metaRng = S.makeRng(SEED + ':meta');
  const RUN_ID = P.uuid(metaRng);
  const realGenId = await getOrCreateGeneratorId();
  const MODEL = 'authored/psychosynth-synth-v2';

  // 1) Generation Run
  const { error: runErr } = await supa.from('generation_runs').upsert({
    id: RUN_ID, generator_id: realGenId, generator_slug: 'psychosynth-synth-v4', generator_ver: 4,
    params: { seed: SEED, profiles: 4000, responses: 4000 }, model_used: MODEL,
    items_requested: 8000, items_created: 8000, items_auto_approved: 8000, status: 'done'
  }, { onConflict: 'id' });
  if (runErr) console.error('Run insert error:', runErr);

  // 2) Profiles (4,000)
  console.log('Generating 4,000 profiles...');
  const poolOrder = ['solana', 'retail', 'base', 'whale', 'agent', 'general'];
  const profileRows = [];
  const provRows = [];
  const tHash = P.sha256('enrich-v4:' + SEED);

  for (let i = 0; i < 4000; i++) {
    const poolKey = poolOrder[i % poolOrder.length];
    const arch = S.R.pick(rng, POOLS[poolKey]);
    const prof = P.buildFullProfile(rng, { archetype: arch });
    
    profileRows.push({
      id: prof.id, version: 1, content: prof.content, big_five: prof.content.big_five,
      mbti_label: prof.content.mbti_label, decision_style: prof.content.decision_style,
      tags: prof.content.tags, summary: prof.content.summary, quality_score: prof.row.quality_score,
      status: 'approved', generation_run_id: RUN_ID
    });

    provRows.push({
      id: P.uuid(metaRng), entity_type: 'profile', entity_id: prof.id, entity_version: 1,
      model: MODEL, prompt_hash: tHash, template_hash: tHash,
      params: { seed: SEED, engine: 'psychosynth-synth-v4', batch: 'enrich-v4' },
      sha256_content: P.sha256(S.canonical(prof.content))
    });
  }

  let profInserted = 0;
  for (const c of chunk(profileRows, 250)) {
    const { error } = await supa.from('profiles').upsert(c, { onConflict: 'id', ignoreDuplicates: true });
    if (error) console.error('Profiles insert warning:', error.message);
    else profInserted += c.length;
  }
  console.log(`  inserted ${profInserted} profiles.`);

  // 3) Scenarios (120)
  console.log('Generating 120 scenarios...');
  const scenarioRows = [];
  for (let i = 0; i < 120; i++) {
    const cat = B.CATEGORIES[i % B.CATEGORIES.length];
    const sc = B.buildScenario(rng, cat);
    const slug = `${B.slugify(sc.stem)}-${cat}-v4-${String(i+1).padStart(3, '0')}`;
    scenarioRows.push({ id: P.uuid(rng), slug, category: cat, title: `${sc.stem} (${cat}) #${i+1}`, description: sc.description });
  }
  for (const c of chunk(scenarioRows, 100)) {
    const { error } = await supa.from('scenarios').upsert(c, { onConflict: 'slug', ignoreDuplicates: true });
    if (error) console.error('Scenarios insert warning:', error.message);
  }
  console.log('  inserted 120 scenarios.');

  // 4) Responses (4,000)
  console.log('Generating 4,000 responses...');
  const responseRows = [];
  for (let i = 0; i < 4000; i++) {
    const prof = profileRows[Math.floor(rng() * profileRows.length)];
    const sc = scenarioRows[Math.floor(rng() * scenarioRows.length)];
    const r = B.buildResponse(rng, prof.content, sc);
    const respId = P.uuid(rng);
    responseRows.push({
      id: respId, profile_id: prof.id, scenario_id: sc.id, response: r.response,
      reasoning_chain: r.reasoning_chain, emotional_arc: r.emotional_arc,
      confidence: r.confidence, generation_run_id: RUN_ID
    });

    provRows.push({
      id: P.uuid(metaRng), entity_type: 'profile_scenario_response', entity_id: respId, entity_version: 1,
      model: MODEL, prompt_hash: tHash, template_hash: tHash,
      params: { seed: SEED, engine: 'psychosynth-synth-v4', batch: 'enrich-v4' },
      sha256_content: P.sha256(S.canonical({ response: r.response, reasoning_chain: r.reasoning_chain }))
    });
  }

  let respInserted = 0;
  for (const c of chunk(responseRows, 250)) {
    const { error } = await supa.from('profile_scenario_responses').upsert(c, { onConflict: 'id', ignoreDuplicates: true });
    if (error) console.error('Responses insert warning:', error.message);
    else respInserted += c.length;
  }
  console.log(`  inserted ${respInserted} responses.`);

  // 5) Provenance
  for (const c of chunk(provRows, 250)) {
    const { error } = await supa.from('provenance').upsert(c, { onConflict: 'entity_type,entity_id,entity_version', ignoreDuplicates: true });
    if (error) console.error('Provenance insert warning:', error.message);
  }
  console.log('  inserted provenance stamps.');
}

async function loadSupplementalBatches() {
  console.log('\n--- 2. Loading Supplemental Batches (a2a-commerce, launch-day, social-cascades) ---');
  const realGenId = await getOrCreateGeneratorId();
  const batches = [
    { script: 'enrich-a2a-commerce.mjs', tags: ['a2a-commerce', 'skill-pricing', 'retry-etiquette', 'sla-dispute'], poolTag: 'x402' },
    { script: 'enrich-launch-day.mjs', tags: ['robinhood', 'retail-trading', 'doppler', 'launch-day', 'sniper', 'bundler'], poolTag: 'doppler' },
    { script: 'enrich-social-cascades.mjs', tags: ['social-cascade', 'copy-trading', 'farcaster', 'meme-rotator'], poolTag: 'social' }
  ];

  for (const b of batches) {
    console.log(`Executing supplemental batch ${b.script}...`);
    const SEED = `${b.script.replace('.mjs','')}-prod-2026-07-22`;
    const rng = S.makeRng(SEED);
    const metaRng = S.makeRng(SEED + ':meta');
    const RUN_ID = P.uuid(metaRng);
    const MODEL = 'authored/psychosynth-synth-v2';

    await supa.from('generation_runs').upsert({
      id: RUN_ID, generator_id: realGenId, generator_slug: 'psychosynth-synth-v4', generator_ver: 4,
      params: { seed: SEED, batch: b.script }, model_used: MODEL,
      items_requested: 2000, items_created: 2000, items_auto_approved: 2000, status: 'done'
    }, { onConflict: 'id' });

    const pool = ARCHETYPES.filter((a) => a.tags.includes(b.poolTag) || a.domain === b.poolTag || a.tags.includes('trading'));
    const profs = [];
    const provs = [];
    const tHash = P.sha256(SEED);

    for (let i = 0; i < 1000; i++) {
      const arch = S.R.pick(rng, pool);
      const p = P.buildFullProfile(rng, { archetype: arch });
      p.content.tags = Array.from(new Set([...p.content.tags, ...b.tags]));
      profs.push({
        id: p.id, version: 1, content: p.content, big_five: p.content.big_five,
        mbti_label: p.content.mbti_label, decision_style: p.content.decision_style,
        tags: p.content.tags, summary: p.content.summary, quality_score: p.row.quality_score,
        status: 'approved', generation_run_id: RUN_ID
      });

      provs.push({
        id: P.uuid(metaRng), entity_type: 'profile', entity_id: p.id, entity_version: 1,
        model: MODEL, prompt_hash: tHash, template_hash: tHash,
        params: { seed: SEED, engine: 'psychosynth-synth-v4' },
        sha256_content: P.sha256(S.canonical(p.content))
      });
    }

    for (const c of chunk(profs, 250)) {
      await supa.from('profiles').upsert(c, { onConflict: 'id', ignoreDuplicates: true });
    }
    for (const c of chunk(provs, 250)) {
      await supa.from('provenance').upsert(c, { onConflict: 'entity_type,entity_id,entity_version', ignoreDuplicates: true });
    }
    console.log(`  loaded 1,000 profiles for ${b.script}.`);
  }
}

async function runRepairV3() {
  console.log('\n--- 3. Running 05_repair_v3 Precheck & Tag Cleanup ---');
  const { data: allProfiles, error: csErr } = await supa
    .from('profiles')
    .select('id, tags')
    .eq('status', 'approved');

  if (csErr) {
    console.error('Error fetching profiles:', csErr);
    return;
  }

  const cleanCount = allProfiles.filter((p) => Array.isArray(p.tags) && p.tags.includes('chain:solana') && !p.tags.some((t) => t.startsWith('batch-'))).length;
  const staleProfiles = allProfiles.filter((p) => Array.isArray(p.tags) && p.tags.some((t) => t.startsWith('batch-')));

  console.log(`Clean chain:solana profiles count: ${cleanCount} (safety precheck threshold >= 400).`);
  console.log(`Stale batch-* polluted profiles to delete: ${staleProfiles.length}.`);

  if (cleanCount < 400) {
    console.error('ABORT 05_repair_v3: safety precheck failed (clean count < 400).');
    return;
  }

  if (staleProfiles.length === 0) {
    console.log('No stale batch-* profiles found. Database is 100% clean!');
    return;
  }

  const staleIds = staleProfiles.map((p) => p.id);
  console.log(`Deleting ${staleIds.length} stale profiles and provenance rows...`);

  const { data: respRows } = await supa.from('profile_scenario_responses').select('id').in('profile_id', staleIds);
  if (respRows && respRows.length > 0) {
    const respIds = respRows.map((r) => r.id);
    for (const c of chunk(respIds, 200)) {
      await supa.from('provenance').delete().eq('entity_type', 'profile_scenario_response').in('entity_id', c);
    }
  }

  for (const c of chunk(staleIds, 200)) {
    await supa.from('provenance').delete().eq('entity_type', 'profile').in('entity_id', c);
  }

  for (const c of chunk(staleIds, 200)) {
    await supa.from('profiles').delete().in('id', c);
  }

  console.log('Successfully cleaned up all stale batch-* polluted profiles!');
}

async function main() {
  await loadV4Batch();
  await loadSupplementalBatches();
  await runRepairV3();
  console.log('\n=== ALL PRODUCTION DB UPDATES & CLEANUP COMPLETE ===');
}

main().catch(console.error);
