import * as path from 'path';
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  const p = path.join(process.cwd(), '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}
loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supa = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Supabase Connection Status:");
  console.log(`URL: ${supabaseUrl}`);

  const { count: profileCount } = await supa.from('profiles').select('*', { count: 'exact', head: true });
  const { count: scenarioCount } = await supa.from('scenarios').select('*', { count: 'exact', head: true });
  const { count: responseCount } = await supa.from('profile_scenario_responses').select('*', { count: 'exact', head: true });
  const { count: reviewCount } = await supa.from('reviews').select('*', { count: 'exact', head: true });

  console.log(`- Profiles: ${profileCount}`);
  console.log(`- Scenarios: ${scenarioCount}`);
  console.log(`- Responses: ${responseCount}`);
  console.log(`- Reviews: ${reviewCount}`);
}

main().catch(console.error);
