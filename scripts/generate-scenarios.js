'use strict';
/*
 * Load synthetic scenarios (L2), scenario<->bias applications, and the expanded
 * emotional_patterns reference set. No LLM.
 *
 *   node scripts/generate-scenarios.js --count 120 --seed sc-2026-07
 *   node scripts/generate-scenarios.js --count 20 --dry
 *
 * Scenarios are reference data (no curation status column), inserted idempotently
 * by slug. Emotional patterns are upserted by slug.
 */
const path = require('path');
const fs = require('fs');
const S = require(path.join(__dirname, 'lib', 'synth.js'));
const B = require(path.join(__dirname, 'lib', 'behavior.js'));

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const COUNT = parseInt(arg('count', '120'), 10);
const SEED = String(arg('seed', 'scenarios-' + new Date().toISOString().slice(0, 10)));
const DRY = !!arg('dry', false);

function loadEnv() {
  const p = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

function synth(count, seed) {
  const rng = S.makeRng(seed);
  const out = [];
  const seen = new Set();
  let n = 0, attempts = 0;
  while (out.length < count && attempts < count * 30) {
    attempts++;
    const cat = B.CATEGORIES[out.length % B.CATEGORIES.length];
    const sc = B.buildScenario(rng, cat);
    if (seen.has(sc.description)) continue; // avoid identical fills
    seen.add(sc.description);
    n++;
    const slug = B.slugify(sc.stem) + '-' + cat + '-' + String(n).padStart(3, '0');
    const title = `${sc.stem} (${cat}) #${n}`;
    out.push({ slug, category: cat, title, description: sc.description, biasLinks: B.scenarioBiasLinks(rng, cat) });
  }
  return out;
}

async function main() {
  const scenarios = synth(COUNT, SEED);
  console.log(`Synthesized ${scenarios.length} scenarios across ${B.CATEGORIES.length} categories.`);
  const byCat = {}; scenarios.forEach(s => byCat[s.category] = (byCat[s.category] || 0) + 1);
  console.log('by category:', byCat, '| emotional_patterns:', B.EMOTIONAL_PATTERNS.length);

  if (DRY) {
    console.log('\nSamples:');
    for (const c of B.CATEGORIES) {
      const ex = scenarios.find(s => s.category === c);
      console.log(`- [${c}] ${ex.title}: ${ex.description}\n    biases: ${ex.biasLinks.map(b => b.slug + ':' + b.weight).join(', ')}`);
    }
    console.log('\nDRY run — no database writes.');
    return;
  }

  loadEnv();
  const { createClient } = require('@supabase/supabase-js');
  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // emotional patterns (upsert by slug)
  const ep = B.EMOTIONAL_PATTERNS.map(([slug, name, description]) => ({ slug, name, description }));
  const { error: epErr } = await supa.from('emotional_patterns').upsert(ep, { onConflict: 'slug', ignoreDuplicates: true });
  if (epErr) console.error('emotional_patterns upsert warning:', epErr.message);
  else console.log(`Upserted ${ep.length} emotional patterns.`);

  const { data: biasRows, error: bErr } = await supa.from('biases').select('id, slug');
  if (bErr) throw bErr;
  const biasMap = new Map(biasRows.map(b => [b.slug, b.id]));

  let inserted = 0, links = 0;
  for (const sc of scenarios) {
    const { data: row, error: sErr } = await supa.from('scenarios')
      .upsert({ slug: sc.slug, category: sc.category, title: sc.title, description: sc.description }, { onConflict: 'slug' })
      .select('id').single();
    if (sErr) { console.error('scenario insert failed:', sErr.message); continue; }
    inserted++;
    const linkRows = sc.biasLinks.filter(b => biasMap.has(b.slug))
      .map(b => ({ scenario_id: row.id, bias_id: biasMap.get(b.slug), weight: b.weight }));
    if (linkRows.length) {
      const { error: lErr } = await supa.from('scenario_bias_applications').upsert(linkRows, { onConflict: 'scenario_id,bias_id', ignoreDuplicates: true });
      if (!lErr) links += linkRows.length;
    }
  }
  console.log(`Inserted/updated ${inserted} scenarios, ${links} bias applications.`);
}
main().catch(e => { console.error('FATAL', e.message || e); process.exit(1); });
