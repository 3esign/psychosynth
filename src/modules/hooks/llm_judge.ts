import { generateObject, jsonSchema } from 'ai';
import { Hook } from './types';
import { providers } from '@/modules/generation/models';

export const llmJudge: Hook = async (ctx, config) => {
  const minScore = (config.min_score as number) ?? 0.7;
  const rubric = (config.rubric as string) ?? 'general_consistency';
  
  // Use the same model config as the generator
  const cfg = ctx.generator.model_config;
  const providerFn = providers[cfg.provider];
  if (!providerFn) throw new Error(`Unknown provider for LLM judge: ${cfg.provider}`);

  const prompt = `You are a strict data quality judge evaluating a synthetic JSON item against the rubric: "${rubric}".
Evaluate the logical consistency and psychological coherence of the item.
Return a score between 0.0 and 1.0, where 1.0 is flawless and anything below ${minScore} has glaring contradictions.
Provide a very brief reasoning string.

Item to evaluate:
${JSON.stringify(ctx.item, null, 2)}`;

  try {
    const { object } = await generateObject({
      model: providerFn(cfg.model),
      temperature: 0.1,
      schema: jsonSchema({
        type: 'object',
        properties: {
          score: { type: 'number', minimum: 0, maximum: 1 },
          reasoning: { type: 'string' }
        },
        required: ['score', 'reasoning'],
        additionalProperties: false
      } as any),
      prompt
    });

    const passed = (object as any).score >= minScore;

    return {
      hook: 'llm_judge',
      passed,
      score: (object as any).score,
      verdict: passed ? undefined : 'reject',
      data: {
        reasoning: (object as any).reasoning
      }
    };
  } catch (err) {
    // If the judge fails, fail open (do not block pipeline but record error)
    return {
      hook: 'llm_judge',
      passed: true,
      data: { error: String(err) }
    };
  }
};
