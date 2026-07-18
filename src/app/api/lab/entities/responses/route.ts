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
    
    const category = searchParams.get('category');
    const profileId = searchParams.get('profile_id');
    const confidenceMin = searchParams.get('confidence_min');

    // Inner join scenarios to get scenario details, select profile details
    let q = dbAdmin.from('profile_scenario_responses').select(`
      id, response, reasoning_chain, emotional_arc, confidence, created_at,
      scenarios!inner(slug, category, title, description),
      profiles(id, mbti_label, decision_style, big_five)
    `, { count: 'exact' });

    if (category) {
      q = q.eq('scenarios.category', category);
    }
    if (profileId) {
      q = q.eq('profile_id', profileId);
    }
    if (confidenceMin) {
      const n = Number(confidenceMin);
      if (!Number.isNaN(n)) {
        q = q.gte('confidence', n);
      }
    }

    const { data, count, error } = await q
      .order('id', { ascending: true })
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
