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

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

const SOLANA_ARCHETYPES = [
  { name: 'Pump.fun Momentum Sniper', tags: ['chain:solana', 'solana-defi', 'pump-fun', 'meme-coin', 'solana-alpha', 'degen'], mbti: 'ESTP', style: 'intuitive', lambda: 0.75, sys: 'system1', crt: 0, o: .92, c: .28, e: .88, a: .32, n: .65, m: .50, nar: .78, p: .62 },
  { name: 'Solana Raydium LP Arbitrageur', tags: ['chain:solana', 'solana-defi', 'raydium-trader', 'quant-trader', 'solana-alpha'], mbti: 'INTJ', style: 'analytical', lambda: 2.40, sys: 'system2', crt: 3, o: .82, c: .94, e: .35, a: .45, n: .22, m: .82, nar: .35, p: .18 },
  { name: 'Jupiter Aggregator Rotator', tags: ['chain:solana', 'solana-defi', 'jupiter-trader', 'solana-alpha', 'spontaneous'], mbti: 'ENTP', style: 'spontaneous', lambda: 1.10, sys: 'system1', crt: 1, o: .88, c: .42, e: .75, a: .38, n: .52, m: .65, nar: .68, p: .42 }
];

async function main() {
  console.log("=== Retrying 600 Solana & Retail Trader Profiles ===");

  const profiles = [];
  for (let i = 0; i < 600; i++) {
    const t = SOLANA_ARCHETYPES[i % SOLANA_ARCHETYPES.length];
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
      tags: [...t.tags, `batch-solana-retry-${i}`]
    };

    profiles.push({
      content,
      big_five,
      mbti_label: t.mbti,
      decision_style: t.style,
      summary: summaryText,
      tags: content.tags,
      status: 'approved'
    });
  }

  const chunkSize = 150;
  let inserted = 0;
  for (let i = 0; i < profiles.length; i += chunkSize) {
    const chunk = profiles.slice(i, i + chunkSize);
    const { data: res, error } = await supa.from('profiles').insert(chunk).select('id');
    if (error) {
      console.error(`Chunk error:`, error.message);
    } else if (res) {
      inserted += res.length;
      console.log(`Inserted ${res.length} retry profiles.`);
    }
  }

  console.log(`Total Retry Profiles Inserted: ${inserted}`);
}

main().catch(console.error);
