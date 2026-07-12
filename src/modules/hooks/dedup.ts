import { dbAdmin } from '@/modules/core/db';
import { Hook } from './types';

export const dedup: Hook = async (ctx, config) => {
  const threshold = (config.threshold as number) ?? 0.55;
  const { data } = await dbAdmin.rpc('similar_profile', {
    p_summary: ctx.item.summary,
    p_threshold: threshold
  });
  const hit = data && data.length > 0;
  return {
    hook: 'dedup',
    passed: !hit,
    score: hit ? 0 : 1,
    data: hit ? { similar_to: data[0].id, sim: data[0].sim } : {}
  };
};
