import { emit } from '@/modules/learning/events';
import { schemaValidate } from './schema_validate';
import { dedup } from './dedup';
import { provenanceStamp } from './provenance';
import { route } from './route';
import type { Hook, HookContext, HookResult } from './types';

const REGISTRY: Record<string, Hook> = {
  schema_validate: schemaValidate,
  dedup,
  provenance_stamp: provenanceStamp,
  route
};

export async function runHookChain(
  chain: Array<{ type: string; config?: Record<string, unknown> }>,
  ctx: Omit<HookContext, 'prior'>
): Promise<HookResult[]> {
  const results: HookResult[] = [];
  for (const step of chain) {
    const hook = REGISTRY[step.type];
    if (!hook) throw new Error(`unknown hook ${step.type}`);
    const r = await hook({ ...ctx, prior: results } as HookContext, step.config ?? {});
    results.push(r);
    emit({
      event_type: 'hook.executed',
      actor_type: 'hook',
      actor_id: step.type,
      run_id: ctx.run.id,
      payload: { hook: step.type, passed: r.passed, score: r.score ?? null }
    });
    if (r.verdict === 'reject') break;
  }
  return results;
}

export function finalVerdict(results: HookResult[]): 'reject' | 'pending' | 'approve' {
  const routed = [...results].reverse().find(r => r.verdict);
  return routed?.verdict ?? 'pending';
}
