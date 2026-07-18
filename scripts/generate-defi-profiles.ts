import * as path from 'path';
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

// Setup env
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

function sha256(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex');
}

const PERSONAS = [
  {
    name: 'Degen Yield Farmer',
    tags: ['defi', 'degen', 'yield-farming', 'risk-seeking'],
    mbti: 'ESTP',
    decision_style: 'intuitive',
    lambda: 0.85, // Risk-seeking (low loss aversion)
    alpha: 0.95,  // Near-linear utility for gains
    beta: 0.90,
    system: 'system1',
    crt: 1,
    narcissism: 0.85,
    machiavellianism: 0.70,
    psychopathy: 0.60,
    big_five: { openness: 0.85, conscientiousness: 0.35, extraversion: 0.80, agreeableness: 0.30, neuroticism: 0.60 }
  },
  {
    name: 'Quant Arbitrageur',
    tags: ['defi', 'quant', 'arbitrage', 'risk-neutral'],
    mbti: 'INTJ',
    decision_style: 'analytical',
    lambda: 2.85, // Highly loss-averse (hedged)
    alpha: 0.65,  // Diminishing sensitivity to gains
    beta: 0.70,
    system: 'system2',
    crt: 3,
    narcissism: 0.40,
    machiavellianism: 0.85,
    psychopathy: 0.15,
    big_five: { openness: 0.90, conscientiousness: 0.95, extraversion: 0.30, agreeableness: 0.45, neuroticism: 0.20 }
  },
  {
    name: 'Panic Seller / retail',
    tags: ['defi', 'retail', 'fomo', 'risk-averse'],
    mbti: 'ISFP',
    decision_style: 'reactive',
    lambda: 3.50, // Extreme loss aversion (panics easily)
    alpha: 0.75,
    beta: 0.80,
    system: 'system1',
    crt: 0,
    narcissism: 0.30,
    machiavellianism: 0.25,
    psychopathy: 0.10,
    big_five: { openness: 0.50, conscientiousness: 0.40, extraversion: 0.55, agreeableness: 0.60, neuroticism: 0.80 }
  },
  {
    name: 'MEV Searcher',
    tags: ['defi', 'mev', 'searcher', 'opportunistic'],
    mbti: 'ENTP',
    decision_style: 'opportunistic',
    lambda: 1.50,
    alpha: 0.85,
    beta: 0.85,
    system: 'system2',
    crt: 2,
    narcissism: 0.70,
    machiavellianism: 0.90,
    psychopathy: 0.45,
    big_five: { openness: 0.95, conscientiousness: 0.70, extraversion: 0.60, agreeableness: 0.25, neuroticism: 0.30 }
  }
];

const SUMMARIES = [
  "Aggressive yield optimizer focusing on high-APR liquidity pool positions. Primarily heuristic-driven, capitalizing on market hype and momentum while ignoring long-term structural risks.",
  "Highly disciplined quantitative strategist executing delta-neutral arbitrage. Heavily utilizes analytical modeling, risk boundaries, and mathematical hedging to capture micro-inefficiencies.",
  "Reactive retail participant susceptible to FOMO and market panic. Decisions are dominated by loss aversion and emotional volatility under sudden drawdown events.",
  "Opportunistic MEV searcher scanning the mempool to frontrun transactions. Highly machiavellian and calculating, optimization is focused purely on extraction efficiency."
];

async function main() {
  console.log("Generating 50 Specialized DeFi Trader Profiles...");

  const { data: gen } = await supa.from('generators')
    .select('id, slug, version, prompt_template')
    .eq('slug', 'big-five-profile-gen').eq('status', 'active')
    .order('version', { ascending: false }).limit(1).single();

  if (!gen) throw new Error("Active big-five-profile-gen not found.");

  const { data: run } = await supa.from('generation_runs').insert({
    generator_id: gen.id, generator_slug: gen.slug, generator_ver: gen.version,
    params: { count: 50, source: 'defi-trader-synthesis', seed: 'defi-seed' },
    model_used: 'authored/psychosynth-synth-v2-defi',
    items_requested: 50, status: 'running',
  }).select().single();

  if (!run) throw new Error("Could not create generation run.");

  let insertedCount = 0;
  for (let i = 0; i < 50; i++) {
    const pTemplate = PERSONAS[i % PERSONAS.length];
    const summaryText = SUMMARIES[i % SUMMARIES.length];
    
    // Add small random noise to traits to keep them unique
    const rand = () => (Math.random() - 0.5) * 0.08;
    const big_five = {
      openness: Math.max(0.01, Math.min(0.99, pTemplate.big_five.openness + rand())),
      conscientiousness: Math.max(0.01, Math.min(0.99, pTemplate.big_five.conscientiousness + rand())),
      extraversion: Math.max(0.01, Math.min(0.99, pTemplate.big_five.extraversion + rand())),
      agreeableness: Math.max(0.01, Math.min(0.99, pTemplate.big_five.agreeableness + rand())),
      neuroticism: Math.max(0.01, Math.min(0.99, pTemplate.big_five.neuroticism + rand()))
    };

    const dark_triad = {
      machiavellianism: Math.max(0.01, Math.min(0.99, pTemplate.machiavellianism + rand())),
      narcissism: Math.max(0.01, Math.min(0.99, pTemplate.narcissism + rand())),
      psychopathy: Math.max(0.01, Math.min(0.99, pTemplate.psychopathy + rand()))
    };

    const prospect_theory = {
      lambda: Math.max(0.5, Math.min(5.0, pTemplate.lambda + rand() * 5)),
      alpha: Math.max(0.1, Math.min(1.0, pTemplate.alpha + rand())),
      beta: Math.max(0.1, Math.min(1.0, pTemplate.beta + rand()))
    };

    const content = {
      name: `${pTemplate.name} #${i + 1}`,
      big_five,
      dark_triad,
      prospect_theory,
      cognitive_reflection: {
        system_preference: pTemplate.system,
        crt_score: pTemplate.crt
      },
      summary: summaryText,
      decision_style: pTemplate.decision_style,
      mbti_label: pTemplate.mbti,
      tags: [...pTemplate.tags, `batch-defi-${i}`]
    };

    const { data: prow, error } = await supa.from('profiles').insert({
      content,
      big_five,
      mbti_label: pTemplate.mbti,
      decision_style: pTemplate.decision_style,
      summary: summaryText,
      tags: content.tags,
      status: 'approved',
      generation_run_id: run.id
    }).select('id').single();

    if (error) {
      console.error(`Insert failed for profile #${i}:`, error.message);
      continue;
    }

    await supa.from('provenance').insert({
      entity_type: 'profile',
      entity_id: prow.id,
      entity_version: 2,
      model: 'authored/psychosynth-synth-v2-defi',
      prompt_hash: sha256(`defi-synthesis i=${i} name=${content.name}`),
      template_hash: sha256(gen.prompt_template),
      params: { source: 'defi-synthesis', index: i },
      sha256_content: sha256(JSON.stringify(content))
    });

    insertedCount++;
  }

  await supa.from('generation_runs').update({
    items_created: insertedCount,
    items_auto_approved: insertedCount,
    status: 'done',
    finished_at: new Date().toISOString()
  }).eq('id', run.id);

  console.log(`Successfully generated and inserted ${insertedCount} DeFi profiles.`);
}

main().catch(console.error);
