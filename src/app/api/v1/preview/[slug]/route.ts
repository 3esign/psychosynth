import { NextResponse } from 'next/server';
import { dbAdmin } from '@/modules/core/db';
import { err, toResponse } from '@/modules/core/errors';
import { emit } from '@/modules/learning/events';
import { rateLimit, clientIp } from '@/modules/core/rate_limiter';

// Free, deterministic preview: a fixed, reproducible slice of a product's
// records so a buyer can verify shape and quality before paying. Determinism
// matters — the same product must always return the same preview rows.
// Dispatches on recipe.entity, mirroring resolveQuery's entity switch (this
// was previously hardcoded to profiles, so any non-profile product's preview
// returned the wrong data entirely).

function previewLimit(pct: number, total: number) {
  return Math.min(25, Math.ceil((Number(pct) || 0.05) * total));
}

async function previewProfiles(pct: number, rules?: any) {
  // Deterministic, stable slice: order by id (immutable, always present) so the
  // same product always returns the same preview rows.
  //
  // Previously this ordered by an embedded provenance(sha256_content) join. That
  // embed is unnecessary for a stable preview and is fragile: if the provenance
  // relationship is missing/ambiguous in a given environment, PostgREST 500s the
  // whole preview. The paid profile query never joins provenance, so dropping it
  // here also makes preview and paid output shapes match more closely.
  let q = dbAdmin.from('profiles')
    .select('id, version, big_five, mbti_label, decision_style, summary, tags')
    .eq('status', 'approved');

  // Honor the recipe's server-enforced themed filter so a pack's preview shows
  // the same slice the paid query serves (keeps preview honest — see resolver).
  const hardTags = Array.isArray(rules?.filters?.tags_include)
    ? rules.filters.tags_include.map((s: unknown) => String(s))
    : null;
  if (hardTags && hardTags.length) q = q.overlaps('tags', hardTags);

  const { data, error } = await q.order('id');
  if (error) throw err('internal', 500, error.message);

  const rows = data ?? [];
  return rows.slice(0, previewLimit(pct, rows.length));
}

async function previewBiases(pct: number) {
  // Biases are a small fixed taxonomy; slug order is deterministic.
  const { data, error } = await dbAdmin.from('biases')
    .select('id, slug, name, description, source, examples, mitigations')
    .order('slug');
  if (error) throw err('internal', 500, error.message);

  const rows = data ?? [];
  return rows.slice(0, previewLimit(pct, rows.length));
}

async function previewScenarioResponses(pct: number) {
  // Same record shape the paid query returns, so a buyer can verify exactly
  // what they'd receive. Ordered by id for a stable, reproducible slice.
  const { data, error } = await dbAdmin.from('profile_scenario_responses')
    .select(`
      id, response, reasoning_chain, emotional_arc, confidence,
      scenarios!inner(slug, category, title, description),
      profiles(id, mbti_label, decision_style, big_five)
    `)
    .order('id');
  if (error) throw err('internal', 500, error.message);

  const rows = data ?? [];
  return rows.slice(0, previewLimit(pct, rows.length));
}

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    if (!(await rateLimit(clientIp(req)))) {
      throw err('too_many_requests', 429, 'Rate limit exceeded. Max 60 requests per minute.');
    }
    const { slug } = await params;
    const { data: product } = await dbAdmin.from('products')
      .select('id, preview_pct, status, recipes(query_rules)')
      .eq('slug', slug)
      .single();

    if (!product || product.status !== 'live') {
      throw err('not_found', 404, 'Product not found or inactive');
    }

    const rules = (product.recipes as any)?.query_rules;
    const entity = rules?.entity ?? 'profile';
    const pct = Number(product.preview_pct) || 0.05;

    let records: any[];
    switch (entity) {
      case 'profile':
        records = await previewProfiles(pct, rules);
        break;
      case 'bias':
        records = await previewBiases(pct);
        break;
      case 'scenario_response':
        records = await previewScenarioResponses(pct);
        break;
      default:
        throw err('internal', 500, `unsupported entity: ${entity}`);
    }

    emit({
      event_type: 'preview.served',
      actor_type: 'system',
      payload: { product_slug: slug, count: records.length }
    });

    return NextResponse.json({
      product: slug,
      preview: true,
      count: records.length,
      records
    });

  } catch (e) { return toResponse(e); }
}
