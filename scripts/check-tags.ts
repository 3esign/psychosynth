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

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: profs } = await supa.from('profiles').select('id, tags, mbti_label, decision_style').limit(5000);
  console.log('Total profiles in DB:', profs?.length);
  
  const tagCounts: Record<string, number> = {};
  profs?.forEach(p => {
    (p.tags || []).forEach((t: string) => {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    });
  });
  console.log('Top Tag Breakdown:', Object.entries(tagCounts).sort((a,b) => b[1] - a[1]).slice(0, 35));

  const { data: scens } = await supa.from('scenarios').select('id, slug, title, category').limit(500);
  console.log('\nTotal Scenarios count:', scens?.length);
  console.log('Sample Scenarios (first 10):');
  scens?.slice(0, 10).forEach(s => console.log(` - [${s.category}] ${s.slug}: ${s.title}`));

  const { count: respCount } = await supa.from('profile_scenario_responses').select('*', { count: 'exact', head: true });
  console.log('\nTotal Profile Scenario Responses:', respCount);
}

main().catch(console.error);
