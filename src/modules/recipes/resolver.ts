import { dbAdmin } from '@/modules/core/db';
import { err } from '@/modules/core/errors';

export async function resolveQuery(rules: any, req: URLSearchParams) {
  if (rules.entity !== 'profile') throw err('internal', 500, 'unsupported entity');
  
  let q = dbAdmin.from('profiles')
    .select('id, version, big_five, mbti_label, decision_style, summary, tags')
    .eq('status', rules.filters.status ?? 'approved');

  const allowed = new Set(rules.allow_request_filters ?? []);
  
  if (allowed.has('tags') && req.get('tags')) {
    q = q.overlaps('tags', req.get('tags')!.split(',').map(s => s.trim()));
  }
  if (allowed.has('decision_style') && req.get('decision_style')) {
    q = q.eq('decision_style', req.get('decision_style'));
  }
  if (allowed.has('mbti_label') && req.get('mbti_label')) {
    q = q.eq('mbti_label', req.get('mbti_label')!.toUpperCase());
  }
  
  for (const dir of ['min', 'max'] as const) {
    const raw = req.get(`big_five_${dir}`);
    if (!allowed.has(`big_five_${dir}`) || !raw) continue;
    
    for (const pair of raw.split(',')) {
      const [trait, v] = pair.split(':');
      if (!['openness','conscientiousness','extraversion','agreeableness','neuroticism']
           .includes(trait)) continue;
      
      const num = Number(v);
      if (Number.isNaN(num)) continue;
      q = dir === 'min' ? q.gte(trait, num) : q.lte(trait, num);
    }
  }
  
  const limit = Math.min(Number(req.get('limit')) || rules.default_limit, rules.max_limit);
  const { data, error } = await q.limit(limit);
  
  if (error) throw err('internal', 500, error.message);
  return data ?? [];
}
