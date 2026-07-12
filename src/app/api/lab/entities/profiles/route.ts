import { NextResponse } from 'next/server';
import { dbAdmin } from '@/modules/core/db';
import { requireAdmin } from '@/modules/core/auth';
import { toResponse } from '@/modules/core/errors';

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const url = new URL(req.url);
    const searchParams = url.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const status = searchParams.get('status') || undefined;

    let q = dbAdmin.from('profiles').select('*', { count: 'exact' });

    if (status) {
      q = q.eq('status', status);
    }

    if (searchParams.get('tags')) {
      q = q.overlaps('tags', searchParams.get('tags')!.split(',').map(s => s.trim()));
    }
    if (searchParams.get('decision_style')) {
      q = q.eq('decision_style', searchParams.get('decision_style'));
    }
    if (searchParams.get('mbti_label')) {
      q = q.eq('mbti_label', searchParams.get('mbti_label')!.toUpperCase());
    }

    for (const dir of ['min', 'max'] as const) {
      const raw = searchParams.get(`big_five_${dir}`);
      if (!raw) continue;
      for (const pair of raw.split(',')) {
        const [trait, v] = pair.split(':');
        if (!['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'].includes(trait)) continue;
        const num = Number(v);
        if (Number.isNaN(num)) continue;
        q = dir === 'min' ? q.gte(trait, num) : q.lte(trait, num);
      }
    }

    // Apply pagination and fetch items + total count in a single query
    const { data, count, error } = await q
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({
      items: data || [],
      total: count || 0,
    });
  } catch (e) {
    return toResponse(e);
  }
}
