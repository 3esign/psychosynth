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

async function fetchAllProfiles() {
  let all = [];
  let page = 0;
  const size = 1000;
  while (true) {
    const { data, error } = await supa
      .from('profiles')
      .select('id, tags')
      .eq('status', 'approved')
      .range(page * size, (page + 1) * size - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < size) break;
    page++;
  }
  return all;
}

async function run() {
  const profiles = await fetchAllProfiles();
  console.log(`Total approved profiles in DB: ${profiles.length}`);

  const cleanSolana = profiles.filter((p) => Array.isArray(p.tags) && p.tags.includes('chain:solana') && !p.tags.some((t) => t.startsWith('batch-')));
  const staleBatchProfiles = profiles.filter((p) => Array.isArray(p.tags) && p.tags.some((t) => t.startsWith('batch-')));

  console.log(`Clean chain:solana profiles count: ${cleanSolana.length} (precheck threshold >= 400).`);
  console.log(`Stale batch-* polluted profiles count: ${staleBatchProfiles.length}.`);

  if (staleBatchProfiles.length > 0 && cleanSolana.length >= 400) {
    console.log(`Deleting ${staleBatchProfiles.length} stale batch-* profiles...`);
    const staleIds = staleBatchProfiles.map((p) => p.id);

    // Delete provenance for profile_scenario_response
    const { data: respRows } = await supa.from('profile_scenario_responses').select('id').in('profile_id', staleIds);
    if (respRows && respRows.length > 0) {
      const respIds = respRows.map((r) => r.id);
      for (let i = 0; i < respIds.length; i += 200) {
        await supa.from('provenance').delete().eq('entity_type', 'profile_scenario_response').in('entity_id', respIds.slice(i, i + 200));
      }
    }

    // Delete provenance for profiles
    for (let i = 0; i < staleIds.length; i += 200) {
      await supa.from('provenance').delete().eq('entity_type', 'profile').in('entity_id', staleIds.slice(i, i + 200));
    }

    // Delete profiles
    for (let i = 0; i < staleIds.length; i += 200) {
      await supa.from('profiles').delete().in('id', staleIds.slice(i, i + 200));
    }

    console.log('Cleaned up stale batch-* profiles successfully!');
  } else if (staleBatchProfiles.length === 0) {
    console.log('0 stale batch-* profiles found. Database is 100% clean!');
  }
}

run().catch(console.error);
