import { NextResponse } from 'next/server';
import { dbAdmin } from '@/modules/core/db';
import { err, toResponse } from '@/modules/core/errors';
import { emit } from '@/modules/learning/events';
import { rateLimit } from '@/modules/core/rate_limiter';

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    if (!rateLimit(ip)) {
      throw err('too_many_requests', 429, 'Rate limit exceeded. Max 60 requests per minute.');
    }
    const { slug } = await params;
    const { data: product } = await dbAdmin.from('products')
      .select('id, preview_pct, status')
      .eq('slug', slug)
      .single();

    if (!product || product.status !== 'live') {
      throw err('not_found', 404, 'Product not found or inactive');
    }

    // Fetch approved profiles and join with provenance
    const { data: profiles, error } = await dbAdmin.from('profiles')
      .select('id, version, big_five, mbti_label, decision_style, summary, tags, provenance(sha256_content)')
      .eq('status', 'approved');

    if (error) throw err('internal', 500, error.message);

    // Sort deterministically by sha256_content
    const sorted = (profiles ?? []).map(p => {
      const provs = p.provenance as any;
      const sha = Array.isArray(provs) ? provs[0]?.sha256_content : provs?.sha256_content;
      return { ...p, sha256_content: sha || '' };
    }).sort((a, b) => a.sha256_content.localeCompare(b.sha256_content));

    const totalCount = sorted.length;
    const pct = Number(product.preview_pct) || 0.05;
    const limit = Math.min(25, Math.ceil(pct * totalCount));
    
    const sliced = sorted.slice(0, limit).map(({ sha256_content, provenance, ...rest }) => rest);

    emit({
      event_type: 'preview.served',
      actor_type: 'system',
      payload: { product_slug: slug, count: sliced.length }
    });

    return NextResponse.json({
      product: slug,
      preview: true,
      count: sliced.length,
      records: sliced
    });

  } catch (e) { return toResponse(e); }
}
