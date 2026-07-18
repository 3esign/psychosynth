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
  console.log("Checking DB status...");

  // Products
  const { data: products, error: productsErr } = await supa.from('products').select('*');
  if (productsErr) {
    console.error("Error fetching products:", productsErr);
  } else {
    console.log("Products:");
    products.forEach(p => {
      console.log(`- ${p.slug} (${p.status}): price_model = ${JSON.stringify(p.price_model)}, preview_pct = ${p.preview_pct}`);
    });
  }

  // Biases count and samples
  const { count: biasCount, error: biasErr } = await supa.from('biases').select('*', { count: 'exact', head: true });
  if (biasErr) {
    console.error("Error fetching biases count:", biasErr);
  } else {
    console.log(`Biases count: ${biasCount}`);
    if (biasCount && biasCount > 0) {
      const { data: biasSamples } = await supa.from('biases').select('*').limit(3);
      console.log("Biases sample:", biasSamples);
    }
  }

  // Profiles count and samples
  const { count: profileCount, error: profileErr } = await supa.from('profiles').select('*', { count: 'exact', head: true });
  if (profileErr) {
    console.error("Error fetching profiles count:", profileErr);
  } else {
    console.log(`Profiles count: ${profileCount}`);
  }
}

main().catch(console.error);
