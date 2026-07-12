import { NextResponse } from 'next/server';
import { dbAdmin } from '@/modules/core/db';
import { requireAdmin } from '@/modules/core/auth';
import { toResponse } from '@/modules/core/errors';

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    // Fetch pagination items from profiles with join to get generator schemas
    const { data: queueItems, error: itemsErr } = await dbAdmin
      .from('profiles')
      .select(`
        id,
        content,
        quality_score,
        generation_run_id,
        created_at,
        generation_runs (
          generator_id,
          generator_slug,
          generator_ver,
          generators (
            output_schema
          )
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (itemsErr) throw itemsErr;

    // Fetch total count of pending profiles
    const { count, error: countErr } = await dbAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (countErr) throw countErr;

    // Fetch hook execution events for these items' runs
    const runIds = [...new Set((queueItems || []).map(item => item.generation_run_id).filter(Boolean))];
    let hookEvents: any[] = [];
    if (runIds.length > 0) {
      const { data: events, error: eventsErr } = await dbAdmin
        .from('events')
        .select('*')
        .in('run_id', runIds)
        .eq('event_type', 'hook.executed');
      if (eventsErr) throw eventsErr;
      hookEvents = events || [];
    }

    // Attach hook results to each queue item
    const items = (queueItems || []).map(item => {
      const run = item.generation_runs as any;
      const results = hookEvents
        .filter(e => e.run_id === item.generation_run_id)
        .map(e => ({
          hook: e.payload?.hook,
          passed: e.payload?.passed,
          score: e.payload?.score,
        }));
      return {
        entity_type: 'profile',
        entity_id: item.id,
        content: item.content,
        quality_score: item.quality_score,
        generation_run_id: item.generation_run_id,
        created_at: item.created_at,
        generator_slug: run?.generator_slug,
        generator_ver: run?.generator_ver,
        output_schema: run?.generators?.output_schema,
        hook_results: results,
      };
    });

    return NextResponse.json({
      items,
      total: count || 0,
    });
  } catch (e) {
    return toResponse(e);
  }
}
