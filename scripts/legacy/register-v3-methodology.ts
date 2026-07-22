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
  console.log("Registering Psychosynth Methodology v3 Generator...");

  const generatorData = {
    slug: 'psychosynth-v3-trader-behavior',
    version: 3,
    entity_type: 'profile_scenario_response',
    description: 'Psychosynth v3 Multi-Factor Trader Cognitive Architecture Engine. Integrates Big Five (OCEAN), Dark Triad (SD3), Prospect Theory parameters (lambda loss aversion, alpha/beta curvature), Cognitive Reflection Test preference (System 1 vs System 2), and high-stress market scenario response chains.',
    prompt_template: `You are the Psychosynth v3 Behavioral Synthesis Model. Given a target trading archetype, generate a calibrated multi-factor psychometric profile and its behavioral reaction chain under specified market stress conditions. Format as structured JSON with full provenance provenance_stamp.`,
    params_schema: {
      type: 'object',
      properties: {
        archetype: { type: 'string' },
        chain_context: { type: 'string' },
        stress_scenario: { type: 'string' },
        loss_aversion_target: { type: 'number' }
      }
    },
    output_schema: {
      type: 'object',
      required: ['name', 'big_five', 'dark_triad', 'prospect_theory', 'action', 'reasoning_chain', 'confidence'],
      properties: {
        name: { type: 'string' },
        big_five: {
          type: 'object',
          properties: {
            openness: { type: 'number', minimum: 0, maximum: 1 },
            conscientiousness: { type: 'number', minimum: 0, maximum: 1 },
            extraversion: { type: 'number', minimum: 0, maximum: 1 },
            agreeableness: { type: 'number', minimum: 0, maximum: 1 },
            neuroticism: { type: 'number', minimum: 0, maximum: 1 }
          }
        },
        dark_triad: {
          type: 'object',
          properties: {
            machiavellianism: { type: 'number', minimum: 0, maximum: 1 },
            narcissism: { type: 'number', minimum: 0, maximum: 1 },
            psychopathy: { type: 'number', minimum: 0, maximum: 1 }
          }
        },
        prospect_theory: {
          type: 'object',
          properties: {
            lambda: { type: 'number', minimum: 0.5, maximum: 5.0 },
            alpha: { type: 'number', minimum: 0.1, maximum: 1.0 },
            beta: { type: 'number', minimum: 0.1, maximum: 1.0 }
          }
        },
        action: { enum: ['BUY', 'ADD', 'HOLD', 'TRIM', 'SELL', 'CUT'], type: 'string' },
        reasoning_chain: { type: 'string' },
        confidence: { type: 'number', minimum: 0, maximum: 1 }
      }
    },
    model_config: {
      model: 'psychosynth/synth-v3-trader-core',
      provider: 'procedural-v3',
      temperature: 0.85
    },
    hooks: [
      { type: 'schema_validate' },
      { type: 'trait_range_check', config: { min: 0.01, max: 0.99 } },
      { type: 'provenance_stamp' },
      { type: 'auto_approve' }
    ],
    status: 'active'
  };

  const { data, error } = await supa.from('generators')
    .upsert(generatorData, { onConflict: 'slug,version' })
    .select()
    .single();

  if (error) {
    console.error("Failed to register generator:", error);
    process.exit(1);
  }

  console.log("Successfully registered generator:", data.slug, "@ v", data.version);
}

main().catch(console.error);
