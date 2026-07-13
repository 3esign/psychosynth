import { generateObject, jsonSchema } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import prices from '@/config/prices.json';

// OpenRouter adapter
const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY || 'dummy_key',
  headers: {
    'HTTP-Referer': 'http://localhost:3000',
    'X-Title': 'Psychosynth Lab',
  }
});

// Ollama adapter (local or remote)
const ollama = createOpenAI({
  baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
  apiKey: 'ollama', // requires a dummy key
});

export const providers: Record<string, (m: string) => any> = {
  anthropic: (m) => anthropic(m),
  openai: (m) => openai(m),
  google: (m) => google(m),
  openrouter: (m) => openrouter(m),
  ollama: (m) => ollama(m)
};

export type ModelConfig = { provider: string; model: string; temperature: number; max_items_per_call: number };

export async function generateItems(cfg: ModelConfig, prompt: string, outputSchema: object) {
  if (cfg.provider === 'mock') {
    return mockGenerator(cfg, outputSchema);
  }

  const providerFn = providers[cfg.provider];
  if (!providerFn) throw new Error(`Unknown provider: ${cfg.provider}`);

  const { object, usage } = await generateObject({
    model: providerFn(cfg.model),
    temperature: cfg.temperature,
    schema: jsonSchema(outputSchema as any),
    prompt,
  });

  const p = (prices as any)[cfg.model] ?? { in_per_m: 0, out_per_m: 0 };
  const cost = ((usage.inputTokens ?? 0) / 1e6) * p.in_per_m
             + ((usage.outputTokens ?? 0) / 1e6) * p.out_per_m;
  
  return { items: (object as { items: unknown[] }).items, costUsd: cost };
}

async function mockGenerator(cfg: ModelConfig, outputSchema: any) {
  // Hardcoded mock to return valid items for testing without API costs
  const count = cfg.max_items_per_call || 1;
  const items = [];
  for (let i = 0; i < count; i++) {
    items.push({
      big_five: { openness: 0.8, conscientiousness: 0.7, extraversion: 0.4, agreeableness: 0.6, neuroticism: 0.3 },
      summary: "This is a mock synthetic profile summary generated without hitting a real LLM endpoint. It evaluates options systematically.",
      decision_style: "analytical",
      mbti_label: "INTJ",
      suggested_biases: [{ slug: "loss-aversion", strength: 0.6 }, { slug: "anchoring", strength: 0.5 }],
      tags: ["mock", "testing"]
    });
  }
  return { items, costUsd: 0.0 };
}
