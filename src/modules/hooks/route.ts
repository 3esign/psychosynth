import { Hook } from './types';

export const route: Hook = async (ctx, config) => {
  const above = config.auto_approve_above as number | null;
  const below = config.auto_reject_below as number | null;
  const scores = ctx.prior.filter((r) => r.score !== undefined).map((r) => r.score!);
  const mean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  let verdict: 'reject' | 'pending' | 'approve' = 'pending';
  
  if (mean !== null && below !== null && mean < below) verdict = 'reject';
  if (mean !== null && above !== null && mean >= above) verdict = 'approve';
  
  return {
    hook: 'route',
    passed: true,
    score: mean ?? undefined,
    verdict
  };
};
