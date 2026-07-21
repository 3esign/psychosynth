import { dbAdmin } from '@/modules/core/db';
import { err } from '@/modules/core/errors';

// Dispatches on recipe.entity. Adding a new sellable entity is a new case
// here plus a products/recipes row — never a new route (design principle:
// "new behavior = new row, not new code path").
export async function resolveQuery(rules: any, req: URLSearchParams) {
  switch (rules.entity) {
    case 'profile':
      return resolveProfileQuery(rules, req);
    case 'bias':
      return resolveBiasQuery(rules, req);
    case 'scenario_response':
      return resolveScenarioResponseQuery(rules, req);
    default:
      throw err('internal', 500, `unsupported entity: ${rules.entity}`);
  }
}

async function resolveProfileQuery(rules: any, req: URLSearchParams) {
  let q = dbAdmin.from('profiles')
    .select('id, version, big_five, mbti_label, decision_style, summary, tags, content')
    .eq('status', rules.filters?.status ?? 'approved');

  // Server-enforced hard filter (NOT buyer-overridable): a themed pack recipe
  // can pin `filters.tags_include` so the product only ever serves that slice
  // (e.g. the Robinhood counterparty pack serves only retail-trading profiles).
  // This is what makes "themed packs" actually themed — without it every pack
  // returns the whole approved library (see DB_AUDIT finding C3). Applied with
  // `overlaps` so a profile matches if it carries ANY of the pinned tags.
  const hardTags = Array.isArray(rules.filters?.tags_include)
    ? rules.filters.tags_include.map((s: unknown) => String(s))
    : null;
  if (hardTags && hardTags.length) q = q.overlaps('tags', hardTags);

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

  // 1. Dark Triad filters
  for (const trait of ['machiavellianism', 'narcissism', 'psychopathy'] as const) {
    for (const dir of ['min', 'max'] as const) {
      const key = `${trait}_${dir}`;
      const val = req.get(key);
      if (allowed.has(key) && val) {
        const num = Number(val);
        if (!Number.isNaN(num)) {
          q = q.filter(`content->dark_triad->>${trait}`, dir === 'min' ? 'gte' : 'lte', num);
        }
      }
    }
  }

  // 2. Prospect Theory filters
  for (const param of ['lambda', 'alpha', 'beta'] as const) {
    for (const dir of ['min', 'max'] as const) {
      const key = `${param}_${dir}`;
      const val = req.get(key);
      if (allowed.has(key) && val) {
        const num = Number(val);
        if (!Number.isNaN(num)) {
          q = q.filter(`content->prospect_theory->>${param}`, dir === 'min' ? 'gte' : 'lte', num);
        }
      }
    }
  }

  // 3. Cognitive Reflection filters
  if (allowed.has('system_preference') && req.get('system_preference')) {
    q = q.filter('content->cognitive_reflection->>system_preference', 'eq', req.get('system_preference'));
  }
  for (const dir of ['min', 'max'] as const) {
    const key = `crt_score_${dir}`;
    const val = req.get(key);
    if (allowed.has(key) && val) {
      const num = Number(val);
      if (!Number.isNaN(num)) {
        q = q.filter('content->cognitive_reflection->>crt_score', dir === 'min' ? 'gte' : 'lte', num);
      }
    }
  }

  const limit = Math.min(Number(req.get('limit')) || rules.default_limit, rules.max_limit);
  const { data, error } = await q.limit(limit);

  if (error) throw err('internal', 500, error.message);
  return data ?? [];
}

// Biases are static, literature-sourced reference data (seed.sql), not
// generator output — no status/lifecycle column, so no approval filter.
async function resolveBiasQuery(rules: any, req: URLSearchParams) {
  let q = dbAdmin.from('biases')
    .select('id, slug, name, description, source, examples, mitigations');

  const allowed = new Set(rules.allow_request_filters ?? []);

  if (allowed.has('slug') && req.get('slug')) {
    q = q.in('slug', req.get('slug')!.split(',').map(s => s.trim()));
  }

  const defaultLimit = rules.default_limit ?? 20;
  const maxLimit = rules.max_limit ?? 20;
  const limit = Math.min(Number(req.get('limit')) || defaultLimit, maxLimit);
  const { data, error } = await q.order('slug').limit(limit);

  if (error) throw err('internal', 500, error.message);
  return data ?? [];
}

// Profile-conditioned behavioral responses to scenarios. Each record is
// self-contained for training use: the response fields plus the scenario
// (joined inner, so scenario filters narrow the result set) and the
// responding profile's trait vector. Responses have no status lifecycle;
// curation happens upstream on profiles (only approved profiles are paired
// by the generator).
async function resolveScenarioResponseQuery(rules: any, req: URLSearchParams) {
  let q = dbAdmin.from('profile_scenario_responses')
    .select(`
      id, response, reasoning_chain, emotional_arc, confidence,
      scenarios!inner(slug, category, title, description),
      profiles(id, mbti_label, decision_style, big_five)
    `);

  const allowed = new Set(rules.allow_request_filters ?? []);

  if (allowed.has('category') && req.get('category')) {
    q = q.eq('scenarios.category', req.get('category'));
  }
  if (allowed.has('scenario_slug') && req.get('scenario_slug')) {
    q = q.in('scenarios.slug', req.get('scenario_slug')!.split(',').map(s => s.trim()));
  }
  if (allowed.has('profile_id') && req.get('profile_id')) {
    q = q.eq('profile_id', req.get('profile_id'));
  }
  if (allowed.has('confidence_min') && req.get('confidence_min')) {
    const n = Number(req.get('confidence_min'));
    if (!Number.isNaN(n)) q = q.gte('confidence', n);
  }

  const defaultLimit = rules.default_limit ?? 20;
  const maxLimit = rules.max_limit ?? 100;
  const limit = Math.min(Number(req.get('limit')) || defaultLimit, maxLimit);
  const { data, error } = await q.order('id').limit(limit);

  if (error) throw err('internal', 500, error.message);
  return data ?? [];
}
