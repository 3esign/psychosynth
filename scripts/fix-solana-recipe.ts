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
  console.log("Updating Solana Trading Pack recipe rules...");

  const { data: solanaProd } = await supa.from('products')
    .select('id, slug, recipe_id, recipes(id, query_rules)')
    .eq('slug', 'solana-trading-pack')
    .single();

  if (!solanaProd || !solanaProd.recipe_id) {
    console.error("Solana product or recipe not found");
    return;
  }

  const newRules = {
    entity: 'profile',
    filters: {
      status: 'approved',
      tags_include: ['chain:solana']
    },
    max_limit: 200,
    default_limit: 50,
    allow_request_filters: [
      'decision_style',
      'mbti_label',
      'big_five_min',
      'big_five_max',
      'lambda_min',
      'lambda_max'
    ]
  };

  const { error } = await supa.from('recipes')
    .update({ query_rules: newRules })
    .eq('id', solanaProd.recipe_id);

  if (error) {
    console.error("Failed to update recipe rules:", error.message);
  } else {
    console.log("Successfully updated Solana Trading Pack recipe rules to use tags_include!");
  }
}

main().catch(console.error);
