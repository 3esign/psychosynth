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
    const category = searchParams.get('category') || undefined;

    let q = dbAdmin.from('scenarios').select('*', { count: 'exact' });

    if (category) {
      q = q.eq('category', category);
    }

    const { data, count, error } = await q
      .order('slug', { ascending: true })
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
