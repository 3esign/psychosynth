import { NextResponse } from 'next/server';
import { dbAdmin } from '@/modules/core/db';
import { requireAdmin } from '@/modules/core/auth';
import { toResponse } from '@/modules/core/errors';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    const { data, error } = await dbAdmin
      .from('generation_runs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    return toResponse(e);
  }
}
