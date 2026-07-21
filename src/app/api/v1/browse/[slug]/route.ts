import { NextResponse } from 'next/server';
import { dbAdmin } from '@/modules/core/db';
import { err, toResponse } from '@/modules/core/errors';
import { rateLimit, clientIp } from '@/modules/core/rate_limiter';

// Free, filterable BROWSE — the public shopfront read behind /explore.
// Supports both 'profile' entity products and 'scenario_response' entity products.

const BF = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'];
const SAMPLE = 24;

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    if (!(await rateLimit(clientIp(req)))) {
      throw err('too_many_requests', 429, 'Rate limit exceeded. Max 60 requests per minute.');
    }
    const { slug } = await params;
    const p = new URL(req.url).searchParams;

    const { data: product } = await dbAdmin.from('products')
      .select('id, status, recipes(query_rules)')
      .eq('slug', slug)
      .single();
    if (!product || product.status !== 'live') throw err('not_found', 404, 'Product not found or inactive');

    const rules = (product.recipes as any)?.query_rules;
    const entity = rules?.entity ?? 'profile';
    const allowed = new Set<string>(rules?.allow_request_filters ?? []);

    if (entity === 'scenario_response') {
      let q = dbAdmin.from('profile_scenario_responses')
        .select('id, response, reasoning_chain, emotional_arc, confidence, created_at', { count: 'exact' });

      if (allowed.has('confidence_min') && p.get('confidence_min')) {
        const cmin = Number(p.get('confidence_min'));
        if (!Number.isNaN(cmin)) q = q.gte('confidence', cmin);
      }

      const { data, count, error } = await q.order('id').limit(SAMPLE);
      if (error) throw err('internal', 500, error.message);

      return NextResponse.json({
        product: slug,
        preview: true,
        total: count ?? 0,
        sample_size: (data ?? []).length,
        records: data ?? [],
        note: 'Free sample of behavioral scenario responses. Full dataset available via paid /api/v1/query endpoint.',
      });
    }

    if (entity !== 'profile') {
      throw err('unsupported', 400, 'Browse is available for profile and scenario_response products');
    }

    // count: 'exact' returns the FULL filtered count regardless of the sample limit.
    let q = dbAdmin.from('profiles')
      .select('id, big_five, mbti_label, decision_style, summary, tags', { count: 'exact' })
      .eq('status', rules?.filters?.status ?? 'approved');

    // Server-pinned themed slice (e.g. a pack that only serves retail-trading).
    const hardTags = Array.isArray(rules?.filters?.tags_include)
      ? rules.filters.tags_include.map((s: unknown) => String(s)) : null;
    if (hardTags && hardTags.length) q = q.overlaps('tags', hardTags);

    if (allowed.has('tags') && p.get('tags')) {
      q = q.overlaps('tags', p.get('tags')!.split(',').map((s) => s.trim()).filter(Boolean));
    }
    if (allowed.has('decision_style') && p.get('decision_style')) {
      q = q.eq('decision_style', p.get('decision_style'));
    }
    if (allowed.has('mbti_label') && p.get('mbti_label')) {
      q = q.eq('mbti_label', p.get('mbti_label')!.toUpperCase());
    }

    // Big Five bounds use the generated NUMERIC columns.
    for (const dir of ['min', 'max'] as const) {
      const raw = p.get(`big_five_${dir}`);
      if (!allowed.has(`big_five_${dir}`) || !raw) continue;
      for (const pair of raw.split(',')) {
        const [trait, v] = pair.split(':');
        if (!BF.includes(trait)) continue;
        const num = Number(v);
        if (Number.isNaN(num)) continue;
        q = dir === 'min' ? q.gte(trait, num) : q.lte(trait, num);
      }
    }

    // Dark Triad / prospect-theory / cognitive-reflection live inside `content`
    for (const trait of ['machiavellianism', 'narcissism', 'psychopathy'] as const) {
      for (const dir of ['min', 'max'] as const) {
        const key = `${trait}_${dir}`; const val = p.get(key);
        if (allowed.has(key) && val && !Number.isNaN(Number(val))) {
          q = q.filter(`content->dark_triad->>${trait}`, dir === 'min' ? 'gte' : 'lte', Number(val));
        }
      }
    }
    for (const param of ['lambda', 'alpha', 'beta'] as const) {
      for (const dir of ['min', 'max'] as const) {
        const key = `${param}_${dir}`; const val = p.get(key);
        if (allowed.has(key) && val && !Number.isNaN(Number(val))) {
          q = q.filter(`content->prospect_theory->>${param}`, dir === 'min' ? 'gte' : 'lte', Number(val));
        }
      }
    }
    if (allowed.has('system_preference') && p.get('system_preference')) {
      q = q.filter('content->cognitive_reflection->>system_preference', 'eq', p.get('system_preference'));
    }
    for (const dir of ['min', 'max'] as const) {
      const key = `crt_score_${dir}`; const val = p.get(key);
      if (allowed.has(key) && val && !Number.isNaN(Number(val))) {
        q = q.filter('content->cognitive_reflection->>crt_score', dir === 'min' ? 'gte' : 'lte', Number(val));
      }
    }

    const { data, count, error } = await q.order('id').limit(SAMPLE);
    if (error) throw err('internal', 500, error.message);

    return NextResponse.json({
      product: slug,
      preview: true,
      total: count ?? 0,
      sample_size: (data ?? []).length,
      records: data ?? [],
      note: 'Free sample. The full filtered set + each profile\'s Dark Triad, prospect-theory and bias content is available via the paid /api/v1/query endpoint.',
    });
  } catch (e) {
    return toResponse(e);
  }
}
