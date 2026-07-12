import { NextResponse } from 'next/server';
import { executeRun } from '@/modules/generation/executor';
import { requireAdmin } from '@/modules/core/auth';
import { toResponse } from '@/modules/core/errors';
import { dbAdmin } from '@/modules/core/db';

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const { data, error } = await dbAdmin
      .from('generation_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    return NextResponse.json({ items: data || [] });
  } catch (e) {
    return toResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(req);
    const body = await req.json();
    const { runId } = await executeRun({
      generatorSlug: body.generator_slug,
      params: body.params,
      count: body.count || 10,
      actorId: admin.email
    });
    return NextResponse.json({ run_id: runId });
  } catch (e) {
    return toResponse(e);
  }
}
