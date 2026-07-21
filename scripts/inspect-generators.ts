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
  const { data: gens } = await supa.from('generators').select('*');
  console.log('Generators in DB:');
  console.log(JSON.stringify(gens, null, 2));

  const { data: prods } = await supa.from('products').select('*');
  console.log('\nProducts in DB:');
  console.log(JSON.stringify(prods, null, 2));
}

main().catch(console.error);
