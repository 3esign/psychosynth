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
  const { data: products, error } = await supa.from('products')
    .select('id, slug, status, price_model, recipes(id, query_rules)');

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("Products and Recipes:");
  console.log(JSON.stringify(products, null, 2));
}

main().catch(console.error);
