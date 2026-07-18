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
    name: 'Hype KOL / Shiller',
    tags: ['kol', 'hype', 'shill', 'influencer'],
    mbti: 'ENFP',
    decision_style: 'reactive',
    lambda: 1.10,
    alpha: 0.90,
    beta: 0.90,
    system: 'system1',
    crt: 1,
    narcissism: 0.95, // Max self-promotion
    machiavellianism: 0.80,
    psychopathy: 0.40,
    big_five: { openness: 0.90, conscientiousness: 0.40, extraversion: 0.95, agreeableness: 0.60, neuroticism: 0.45 }
  },
  {
    name: 'Controversy Farmer',
    tags: ['kol', 'outrage', 'farming', 'engagement'],
    mbti: 'ENTP',
    decision_style: 'opportunistic',
    lambda: 0.70, // Extremely risk-seeking for engagement
    alpha: 0.95,
    beta: 0.95,
    system: 'system1',
    crt: 2,
    narcissism: 0.90,
    machiavellianism: 0.95, // High manipulation
    psychopathy: 0.70,
    big_five: { openness: 0.85, conscientiousness: 0.50, extraversion: 0.90, agreeableness: 0.20, neuroticism: 0.35 }
  },
  {
    name: 'Thought Leader / Tech Lead',
    tags: ['kol', 'builder', 'educational', 'professional'],
    mbti: 'INTJ',
    decision_style: 'analytical',
    lambda: 2.25,
    alpha: 0.75,
    beta: 0.75,
    system: 'system2',
    crt: 3,
    narcissism: 0.75, // Still high narcissism (thinks they are superior)
    machiavellianism: 0.70,
    psychopathy: 0.20,
    big_five: { openness: 0.80, conscientiousness: 0.85, extraversion: 0.50, agreeableness: 0.50, neuroticism: 0.25 }
  },
  {
    name: 'Empathy / Community Builder',
    tags: ['kol', 'community', 'wholesome', 'supportive'],
    mbti: 'ENFJ',
    decision_style: 'collaborative',
    lambda: 2.00,
    alpha: 0.80,
    beta: 0.80,
    system: 'system2',
    crt: 2,
    narcissism: 0.55,
    machiavellianism: 0.60,
    psychopathy: 0.10,
    big_five: { openness: 0.75, conscientiousness: 0.70, extraversion: 0.85, agreeableness: 0.90, neuroticism: 0.30 }
  }
];

const SUMMARIES = [
  "High-energy social influencer capitalizing on trending memes and hype. Seeks maximum visibility and public validation, posting rapidly and reactively.",
  "Calculated outrage farmer utilizing controversial talking points to capture attention. Highly analytical about engagement metrics and platform algorithms.",
  "Authoritative builder publishing technical deep-dives and opinions. Maintains an elite tech-intellectual brand, delivering deliberative, system-2 reflections.",
  "Supportive community organizer focused on building trusted follower networks. Prioritizes consensus, active listening, and social cohesion."
];

async function main() {
  console.log("Generating 50 Specialized Social KOL Profiles...");

  const { data: gen } = await supa.from('generators')
    .select('id, slug, version, prompt_template')
    .eq('slug', 'big-five-profile-gen').eq('status', 'active')
    .order('version', { ascending: false }).limit(1).single();

  if (!gen) throw new Error("Active big-five-profile-gen not found.");

  const { data: run } = await supa.from('generation_runs').insert({
    generator_id: gen.id, generator_slug: gen.slug, generator_ver: gen.version,
    params: { count: 50, source: 'kol-synthesis', seed: 'kol-seed' },
    model_used: 'authored/psychosynth-synth-v2-kol',
    items_requested: 50, status: 'running',
  }).select().single();

  if (!run) throw new Error("Could not create generation run.");

  let insertedCount = 0;
  for (let i = 0; i < 50; i++) {
    const pTemplate = PERSONAS[i % PERSONAS.length];
    const summaryText = SUMMARIES[i % SUMMARIES.length];
    
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
      tags: [...pTemplate.tags, `batch-kol-${i}`]
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
      model: 'authored/psychosynth-synth-v2-kol',
      prompt_hash: sha256(`kol-synthesis i=${i} name=${content.name}`),
      template_hash: sha256(gen.prompt_template),
      params: { source: 'kol-synthesis', index: i },
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

  console.log(`Successfully generated and inserted ${insertedCount} Social KOL profiles.`);
}

main().catch(console.error);
