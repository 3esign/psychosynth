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
  console.log("Fixing recipe_id for cognitive-bias-simulator...");

  // Find the recipe with entity: bias
  const { data: recipes, error: recipeErr } = await supa.from('recipes').select('*');
  if (recipeErr) {
    console.error("Error fetching recipes:", recipeErr);
    return;
  }

  const biasRecipe = recipes.find(r => r.query_rules && r.query_rules.entity === 'bias');
  if (!biasRecipe) {
    console.error("Could not find recipe with entity = 'bias'!");
    return;
  }

  console.log(`Found bias recipe: ID = ${biasRecipe.id}`);

  // Update product cognitive-bias-simulator
  const { data: updatedProduct, error: updateErr } = await supa.from('products')
    .update({ recipe_id: biasRecipe.id })
    .eq('slug', 'cognitive-bias-simulator')
    .select();

  if (updateErr) {
    console.error("Error updating product:", updateErr);
  } else {
    console.log("Product updated successfully:", updatedProduct);
  }
}

main().catch(console.error);
