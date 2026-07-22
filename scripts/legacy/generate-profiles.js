'use strict';
/*
 * Generate synthetic Big Five profiles and load them into the curation queue.
 *
 *   node scripts/generate-profiles.js --count 120 --seed batch-2026-07
 *   node scripts/generate-profiles.js --count 20 --dry     # offline, no DB writes
 *
 * Content is authored by the offline synthesis engine (scripts/lib/synth.js) —
 * no LLM is called. Profiles are inserted as status='pending' so they flow into
 * the Lab curation queue (A/R/E/J/K), exactly like a normal generator run. Each
 * item gets a provenance row and trait-justified profile_bias_links.
 */

const path = require('path');
const fs = require('fs');
const S = require(path.join(__dirname, 'lib', 'synth.js'));

// ---- args ----
const args = process.argv.slice(2);
function arg(name, def) {
  const i = args.indexOf('--' + name);
  return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : def;
}
const COUNT = parseInt(arg('count', '120'), 10);
const SEED = String(arg('seed', 'profiles-' + new Date().toISOString().slice(0, 10)));
const DRY = !!arg('dry', false);
const STATUS = String(arg('status', 'pending')); // 'pending' -> curation queue; 'approved' -> live

// ---- env (.env manual parse; no dotenv dependency) ----
function loadEnv() {
  const p = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

// ---- trigram dedup guard (proxy for pg_trgm; keeps the batch internally diverse) ----
function trg(s) {
  s = '  ' + s.toLowerCase().replace(/[^a-z0-9 ]/g, '') + ' ';
  const set = new Set();
  for (let i = 0; i < s.length - 2; i++) set.add(s.slice(i, i + 3));
  return set;
}
function sim(aSet, b) {
  const B = trg(b); let inter = 0;
  for (const x of aSet) if (B.has(x)) inter++;
  return inter / (aSet.size + B.size - inter);
}
const SIM_MAX = 0.45;

const SKEWS = [
  null, null, null,
  { trait: 'neuroticism', delta: 0.2 },
  { trait: 'openness', delta: 0.2 },
  { trait: 'agreeableness', delta: -0.2 },
  { trait: 'conscientiousness', delta: 0.2 },
];

function synthesizeBatch(count, seed) {
  const rng = S.makeRng(seed);
  const items = [];
  const accepted = []; // {sum, trgSet}
  let attempts = 0;
  const maxAttempts = count * 40;
  while (items.length < count && attempts < maxAttempts) {
    attempts++;
    const domain = S.DOMAIN_KEYS[items.length % S.DOMAIN_KEYS.length];
    const skew = S.R.pick(rng, SKEWS);
    const { item } = S.buildProfile(rng, { domain, skew });
    const set = trg(item.summary);
    let dup = false;
    for (const a of accepted) { if (sim(set, a.sum) > SIM_MAX) { dup = true; break; } }
    if (dup) continue;
    accepted.push({ sum: item.summary, set });
    items.push({ item, domain });
  }
  return { items, attempts };
}

async function main() {
  console.log(`Synthesizing ${COUNT} profiles (seed="${SEED}", status=${STATUS}${DRY ? ', DRY' : ''})...`);
  const { items, attempts } = synthesizeBatch(COUNT, SEED);
  console.log(`Produced ${items.length}/${COUNT} unique profiles in ${attempts} attempts.`);

  if (DRY) {
    const dist = {};
    for (const { item } of items) dist[item.decision_style] = (dist[item.decision_style] || 0) + 1;
    console.log('decision_style dist:', dist);
    console.log('\nSample:\n' + items.slice(0, 2).map(x =>
      `[${x.item.mbti_label}/${x.item.decision_style}] ${x.item.summary}`).join('\n\n'));
    console.log('\nDRY run — no database writes.');
    return;
  }

  loadEnv();
  const { createClient } = require('@supabase/supabase-js');
  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: gen, error: genErr } = await supa.from('generators')
    .select('id, slug, version, prompt_template')
    .eq('slug', 'big-five-profile-gen').eq('status', 'active')
    .order('version', { ascending: false }).limit(1).single();
  if (genErr || !gen) throw new Error('active big-five-profile-gen not found: ' + (genErr && genErr.message));

  const { data: biasRows, error: bErr } = await supa.from('biases').select('id, slug');
  if (bErr) throw bErr;
  const biasMap = new Map(biasRows.map(b => [b.slug, b.id]));
  const templateHash = S.sha256(gen.prompt_template);

  const { data: run, error: rErr } = await supa.from('generation_runs').insert({
    generator_id: gen.id, generator_slug: gen.slug, generator_ver: gen.version,
    params: { count: items.length, source: 'authored-synthesis', seed: SEED },
    model_used: 'authored/psychosynth-synth-v1',
    items_requested: items.length, status: 'running',
  }).select().single();
  if (rErr) throw rErr;

  let created = 0, autoApproved = 0, links = 0;
  for (const { item, domain } of items) {
    const { data: prow, error: pErr } = await supa.from('profiles').insert({
      content: item, big_five: item.big_five, mbti_label: item.mbti_label,
      decision_style: item.decision_style, summary: item.summary, tags: item.tags,
      status: STATUS, generation_run_id: run.id,
    }).select('id').single();
    if (pErr) { console.error('profile insert failed:', pErr.message); continue; }
    created++;
    if (STATUS === 'approved') autoApproved++;

    await supa.from('provenance').insert({
      entity_type: 'profile', entity_id: prow.id, entity_version: 1,
      model: 'authored/psychosynth-synth-v1',
      prompt_hash: S.sha256(`authored-synthesis domain=${domain} seed=${SEED} ${item.summary}`),
      template_hash: templateHash,
      params: { source: 'authored-synthesis', domain, seed: SEED, temperature: 0 },
      sha256_content: S.sha256(S.canonical(item)),
    });

    const linkRows = (item.suggested_biases || [])
      .filter(b => biasMap.has(b.slug))
      .map(b => ({ profile_id: prow.id, bias_id: biasMap.get(b.slug), strength: b.strength, generation_run_id: run.id }));
    if (linkRows.length) {
      const { error: lErr } = await supa.from('profile_bias_links').insert(linkRows);
      if (!lErr) links += linkRows.length;
    }
  }

  await supa.from('generation_runs').update({
    items_created: created, items_auto_approved: autoApproved, status: 'done',
    finished_at: new Date().toISOString(),
  }).eq('id', run.id);

  console.log(`Inserted ${created} profiles (${STATUS}), ${links} bias links. Run ${run.id}.`);
}

main().catch(e => { console.error('FATAL', e.message || e); process.exit(1); });
