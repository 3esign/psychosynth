import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

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

function sha256(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex');
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// Archetype Templates
const SOLANA_ARCHETYPES = [
  { name: 'Pump.fun Momentum Sniper', tags: ['chain:solana', 'solana-defi', 'pump-fun', 'meme-coin', 'solana-alpha', 'degen'], mbti: 'ESTP', style: 'intuitive', lambda: 0.75, sys: 'system1', crt: 0, o: .92, c: .28, e: .88, a: .32, n: .65, m: .50, nar: .78, p: .62 },
  { name: 'Solana Raydium LP Arbitrageur', tags: ['chain:solana', 'solana-defi', 'raydium-trader', 'quant-trader', 'solana-alpha'], mbti: 'INTJ', style: 'analytical', lambda: 2.40, sys: 'system2', crt: 3, o: .82, c: .94, e: .35, a: .45, n: .22, m: .82, nar: .35, p: .18 },
  { name: 'Jupiter Aggregator Rotator', tags: ['chain:solana', 'solana-defi', 'jupiter-trader', 'solana-alpha', 'spontaneous'], mbti: 'ENTP', style: 'spontaneous', lambda: 1.10, sys: 'system1', crt: 1, o: .88, c: .42, e: .75, a: .38, n: .52, m: .65, nar: .68, p: .42 },
  { name: 'Solana Perps Degen (100x)', tags: ['chain:solana', 'solana-perps', 'high-leverage', 'solana-degen', 'risk-seeking'], mbti: 'ESTP', style: 'intuitive', lambda: 0.60, sys: 'system1', crt: 0, o: .95, c: .20, e: .90, a: .25, n: .75, m: .60, nar: .85, p: .70 },
  { name: 'Solana NFT & Token Flip Bot', tags: ['chain:solana', 'solana-nft', 'token-flipper', 'automated-agent', 'solana-alpha'], mbti: 'ISTJ', style: 'deliberative', lambda: 1.80, sys: 'system2', crt: 2, o: .65, c: .88, e: .25, a: .50, n: .30, m: .70, nar: .30, p: .20 }
];

const RETAIL_ARCHETYPES = [
  { name: '0DTE Options Gambler', tags: ['robinhood', 'retail-trading', 'options-trader', 'zero-dte', 'wsb-degen', 'fomo'], mbti: 'ESTP', style: 'intuitive', lambda: 0.90, sys: 'system1', crt: 0, o: .85, c: .30, e: .82, a: .36, n: .70, m: .52, nar: .75, p: .55 },
  { name: 'Robinhood Meme Stock HODLer', tags: ['robinhood', 'retail-trading', 'meme-stock', 'wsb-degen', 'endowment-effect'], mbti: 'ENFP', style: 'intuitive', lambda: 2.90, sys: 'system1', crt: 0, o: .78, c: .35, e: .70, a: .65, n: .62, m: .30, nar: .55, p: .25 },
  { name: 'Retail Panic Seller', tags: ['robinhood', 'retail-trading', 'loss-averse', 'fomo', 'avoidant'], mbti: 'ISFP', style: 'avoidant', lambda: 3.80, sys: 'system1', crt: 0, o: .45, c: .35, e: .45, a: .60, n: .88, m: .25, nar: .25, p: .15 },
  { name: 'Disciplined Retail Swing Trader', tags: ['robinhood', 'retail-trading', 'swing-trader', 'deliberative', 'risk-managed'], mbti: 'ISTJ', style: 'deliberative', lambda: 2.10, sys: 'system2', crt: 2, o: .55, c: .85, e: .40, a: .55, n: .35, m: .35, nar: .28, p: .18 },
  { name: 'Social Sentiment Follower', tags: ['robinhood', 'retail-trading', 'social-trader', 'dependent', 'fomo'], mbti: 'ESFP', style: 'dependent', lambda: 1.40, sys: 'system1', crt: 1, o: .75, c: .40, e: .85, a: .70, n: .58, m: .32, nar: .48, p: .22 }
];

const WHALE_ARCHETYPES = [
  { name: 'Crypto Whale Market Maker', tags: ['crypto-whale', 'market-maker', 'institutional', 'delta-neutral', 'high-net-worth'], mbti: 'INTJ', style: 'analytical', lambda: 2.60, sys: 'system2', crt: 3, o: .75, c: .96, e: .30, a: .40, n: .18, m: .88, nar: .45, p: .22 },
  { name: 'MEV Sandwich Searcher', tags: ['crypto-whale', 'mev-searcher', 'mempool-extractor', 'institutional', 'quant-trader'], mbti: 'ENTP', style: 'opportunistic', lambda: 1.50, sys: 'system2', crt: 3, o: .92, c: .75, e: .58, a: .22, n: .25, m: .95, nar: .75, p: .50 },
  { name: 'Institutional Macro Hedger', tags: ['crypto-whale', 'institutional', 'macro-hedger', 'risk-averse', 'systemic-risk'], mbti: 'ISTJ', style: 'analytical', lambda: 3.20, sys: 'system2', crt: 3, o: .60, c: .92, e: .35, a: .50, n: .20, m: .65, nar: .25, p: .12 },
  { name: 'DeFi Protocol Yield Whale', tags: ['crypto-whale', 'defi-whale', 'yield-optimizer', 'institutional', 'capital-preservation'], mbti: 'INTP', style: 'deliberative', lambda: 2.20, sys: 'system2', crt: 3, o: .85, c: .88, e: .28, a: .45, n: .28, m: .72, nar: .38, p: .15 },
  { name: 'Autonomous HFT Liquidation Bot', tags: ['crypto-whale', 'ai-agent', 'hft-bot', 'liquidation-engine', 'autonomous-executor'], mbti: 'INTJ', style: 'analytical', lambda: 2.50, sys: 'system2', crt: 3, o: .70, c: .98, e: .10, a: .10, n: .05, m: .90, nar: .10, p: .10 }
];

async function main() {
  console.log("=== Psychosynth v3 Bulk Data Synthesis & Live Population ===");

  // 1. Fetch generator
  const { data: gen } = await supa.from('generators')
    .select('id, slug, version, prompt_template')
    .eq('slug', 'psychosynth-v3-trader-behavior')
    .eq('status', 'active')
    .order('version', { ascending: false })
    .limit(1)
    .single();

  if (!gen) throw new Error("Generator psychosynth-v3-trader-behavior not found.");

  // 2. Fetch existing scenarios for pairing responses
  const { data: scenarios } = await supa.from('scenarios').select('id, slug, category, title').limit(200);
  if (!scenarios || scenarios.length === 0) throw new Error("No scenarios found in database.");

  // Create generation run record
  const { data: run } = await supa.from('generation_runs').insert({
    generator_id: gen.id,
    generator_slug: gen.slug,
    generator_ver: gen.version,
    params: { total_profiles_target: 1500, total_responses_target: 3000, engine: 'psychosynth-v3-procedural' },
    model_used: 'psychosynth/synth-v3-trader-core',
    items_requested: 1500,
    status: 'running'
  }).select().single();

  if (!run) throw new Error("Could not initialize generation run.");

  console.log(`Generation Run ID: ${run.id}`);

  // Helper function to synthesize profiles
  const createProfilesBatch = (templates: typeof SOLANA_ARCHETYPES, count: number, batchName: string) => {
    const profiles = [];
    const provenances = [];
    
    for (let i = 0; i < count; i++) {
      const t = templates[i % templates.length];
      const noise = () => (Math.random() - 0.5) * 0.08;
      
      const big_five = {
        openness: clamp(t.o + noise(), 0.02, 0.98),
        conscientiousness: clamp(t.c + noise(), 0.02, 0.98),
        extraversion: clamp(t.e + noise(), 0.02, 0.98),
        agreeableness: clamp(t.a + noise(), 0.02, 0.98),
        neuroticism: clamp(t.n + noise(), 0.02, 0.98)
      };

      const dark_triad = {
        machiavellianism: clamp(t.m + noise(), 0.02, 0.98),
        narcissism: clamp(t.nar + noise(), 0.02, 0.98),
        psychopathy: clamp(t.p + noise(), 0.02, 0.98)
      };

      const prospect_theory = {
        lambda: clamp(t.lambda + noise() * 3, 0.5, 5.0),
        alpha: clamp(0.85 + noise(), 0.1, 1.0),
        beta: clamp(0.80 + noise(), 0.1, 1.0)
      };

      const summaryText = `${t.name} persona conditioned with $\\lambda = ${prospect_theory.lambda.toFixed(2)}$ loss aversion, Neuroticism ${big_five.neuroticism.toFixed(2)}, and ${dark_triad.machiavellianism > 0.6 ? 'high' : 'moderate'} Machiavellianism. Optimized for ${t.tags.join(', ')} context.`;

      const content = {
        name: `${t.name} #${i + 1}`,
        big_five,
        dark_triad,
        prospect_theory,
        cognitive_reflection: { system_preference: t.sys, crt_score: t.crt },
        summary: summaryText,
        decision_style: t.style,
        mbti_label: t.mbti,
        tags: [...t.tags, `batch-${batchName}-${i}`]
      };

      profiles.push({
        content,
        big_five,
        mbti_label: t.mbti,
        decision_style: t.style,
        summary: summaryText,
        tags: content.tags,
        status: 'approved',
        generation_run_id: run.id
      });
    }
    return profiles;
  };

  // Generate 500 Solana, 500 Robinhood, 500 Whale profiles
  console.log("\nSynthesizing 500 Solana Trader Profiles...");
  const solanaProfiles = createProfilesBatch(SOLANA_ARCHETYPES, 500, 'solana');
  
  console.log("Synthesizing 500 Robinhood Retail Profiles...");
  const retailProfiles = createProfilesBatch(RETAIL_ARCHETYPES, 500, 'robinhood');
  
  console.log("Synthesizing 500 Crypto Whale & Quant Profiles...");
  const whaleProfiles = createProfilesBatch(WHALE_ARCHETYPES, 500, 'whale');

  const allProfilesToInsert = [...solanaProfiles, ...retailProfiles, ...whaleProfiles];
  
  // Insert profiles in chunks of 200
  console.log(`\nInserting ${allProfilesToInsert.length} profiles to Supabase in chunks...`);
  const insertedProfileIds: string[] = [];
  const chunkSize = 200;

  for (let i = 0; i < allProfilesToInsert.length; i += chunkSize) {
    const chunk = allProfilesToInsert.slice(i, i + chunkSize);
    const { data: inserted, error } = await supa.from('profiles').insert(chunk).select('id');
    if (error) {
      console.error(`Chunk ${i / chunkSize} insert failed:`, error.message);
    } else if (inserted) {
      insertedProfileIds.push(...inserted.map(p => p.id));
      console.log(`Inserted chunk ${i / chunkSize + 1} (${inserted.length} profiles).`);
    }
  }

  console.log(`Total Profiles Inserted: ${insertedProfileIds.length}`);

  // Generate 3,000 Scenario Responses linking these inserted profiles to scenarios
  console.log("\nSynthesizing 3,000 High-Stress Behavioral Scenario Responses...");
  const actions = ['BUY', 'ADD', 'HOLD', 'TRIM', 'SELL', 'CUT'];
  const emotions = ['panic', 'euphoria', 'anxious', 'stoic', 'disciplined', 'terrified', 'resilient', 'eager'];

  const responsesToInsert = [];
  const targetResponseCount = 3000;
  
  for (let i = 0; i < targetResponseCount; i++) {
    const profileId = insertedProfileIds[i % insertedProfileIds.length];
    const scenario = scenarios[i % scenarios.length];
    const action = actions[i % actions.length];
    const emotion = emotions[i % emotions.length];
    const confidence = clamp(0.55 + Math.random() * 0.4, 0.5, 0.99);

    const reasoning = `Under scenario '${scenario.title}', profile evaluates risk using loss aversion coefficient $\\lambda$. Decides to ${action} with ${emotion} state. Confidence: ${(confidence * 100).toFixed(0)}%.`;

    responsesToInsert.push({
      scenario_id: scenario.id,
      profile_id: profileId,
      response: `${action} — ${reasoning}`,
      reasoning_chain: reasoning,
      confidence,
      generation_run_id: run.id
    });
  }

  console.log(`Inserting ${responsesToInsert.length} Scenario Responses in chunks of 300...`);
  let insertedResponseCount = 0;
  const respChunkSize = 300;

  for (let i = 0; i < responsesToInsert.length; i += respChunkSize) {
    const chunk = responsesToInsert.slice(i, i + respChunkSize);
    const { data: inserted, error } = await supa.from('profile_scenario_responses').insert(chunk).select('id');
    if (error) {
      console.error(`Response chunk ${i / respChunkSize} failed:`, error.message);
    } else if (inserted) {
      insertedResponseCount += inserted.length;
      console.log(`Inserted response chunk ${i / respChunkSize + 1} (${inserted.length} responses).`);
    }
  }

  // Update generation run status
  await supa.from('generation_runs').update({
    items_created: insertedProfileIds.length + insertedResponseCount,
    items_auto_approved: insertedProfileIds.length + insertedResponseCount,
    status: 'done',
    finished_at: new Date().toISOString()
  }).eq('id', run.id);

  console.log("\n=======================================================");
  console.log(`SUCCESS! Inserted ${insertedProfileIds.length} Profiles & ${insertedResponseCount} Behavioral Responses.`);
  console.log("=======================================================\n");
}

main().catch(console.error);
