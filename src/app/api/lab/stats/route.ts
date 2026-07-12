import { NextResponse } from 'next/server';
import { dbAdmin } from '@/modules/core/db';
import { requireAdmin } from '@/modules/core/auth';
import { toResponse } from '@/modules/core/errors';

export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    // 1. Fetch all generation runs
    const { data: runs, error: runsErr } = await dbAdmin
      .from('generation_runs')
      .select('generator_slug, generator_ver, items_requested, items_rejected_by_hooks, cost_usd');
    if (runsErr) throw runsErr;

    // 2. Fetch profiles statuses grouped by generator run details
    const { data: profiles, error: profsErr } = await dbAdmin
      .from('profiles')
      .select('status, generation_run_id, generation_runs (generator_slug, generator_ver)');
    if (profsErr) throw profsErr;

    // 3. Fetch curation decisions for throughput stats
    const { data: decisions, error: decErr } = await dbAdmin
      .from('curation_decisions')
      .select('created_at, time_spent_ms, reason_code');
    if (decErr) throw decErr;

    // 4. Fetch query events for demand combo stats
    const { data: queryEvents, error: evErr } = await dbAdmin
      .from('events')
      .select('event_type, payload')
      .in('event_type', ['query.served', 'query.unserved']);
    if (evErr) throw evErr;

    // Grouping helper
    const getGenKey = (slug: string, ver: number) => `${slug}@v${ver}`;

    // --- Process Funnel & Cost Stats ---
    const funnel: Record<string, {
      requested: number;
      hook_rejected: number;
      pending: number;
      approved: number;
      rejected: number;
      total_cost: number;
      cost_per_approved: number;
    }> = {};

    (runs || []).forEach(r => {
      const key = getGenKey(r.generator_slug, r.generator_ver);
      if (!funnel[key]) {
        funnel[key] = { requested: 0, hook_rejected: 0, pending: 0, approved: 0, rejected: 0, total_cost: 0, cost_per_approved: 0 };
      }
      funnel[key].requested += r.items_requested || 0;
      funnel[key].hook_rejected += r.items_rejected_by_hooks || 0;
      funnel[key].total_cost += Number(r.cost_usd || 0);
    });

    (profiles || []).forEach(p => {
      const run = p.generation_runs as any;
      if (!run) return;
      const key = getGenKey(run.generator_slug, run.generator_ver);
      if (!funnel[key]) {
        funnel[key] = { requested: 0, hook_rejected: 0, pending: 0, approved: 0, rejected: 0, total_cost: 0, cost_per_approved: 0 };
      }
      if (p.status === 'pending') funnel[key].pending++;
      else if (p.status === 'approved') funnel[key].approved++;
      else if (p.status === 'rejected') funnel[key].rejected++;
    });

    // Calculate cost per approved item
    Object.keys(funnel).forEach(key => {
      const f = funnel[key];
      f.cost_per_approved = f.approved > 0 ? f.total_cost / f.approved : 0;
    });

    // --- Process Reason Leaderboard ---
    const reasons: Record<string, number> = {};
    (decisions || []).forEach(d => {
      if (d.reason_code) {
        reasons[d.reason_code] = (reasons[d.reason_code] || 0) + 1;
      }
    });
    const reasonLeaderboard = Object.entries(reasons)
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count);

    // --- Process Curation Throughput ---
    const decisionsCount = (decisions || []).length;
    const decisionsByDay: Record<string, number> = {};
    const times: number[] = [];

    (decisions || []).forEach(d => {
      const date = new Date(d.created_at).toISOString().split('T')[0];
      decisionsByDay[date] = (decisionsByDay[date] || 0) + 1;
      if (typeof d.time_spent_ms === 'number') {
        times.push(d.time_spent_ms);
      }
    });

    times.sort((a, b) => a - b);
    let medianTimeSpentMs = 0;
    if (times.length > 0) {
      const mid = Math.floor(times.length / 2);
      medianTimeSpentMs = times.length % 2 !== 0 ? times[mid] : (times[mid - 1] + times[mid]) / 2;
    }

    const throughput = {
      total_decisions: decisionsCount,
      decisions_per_day: Object.entries(decisionsByDay).map(([day, count]) => ({ day, count })),
      median_time_spent_ms: medianTimeSpentMs,
    };

    // --- Process Demand Combo Stats ---
    const demandServed: Record<string, number> = {};
    const demandUnserved: Record<string, number> = {};

    (queryEvents || []).forEach(e => {
      const filters = e.payload?.filters || {};
      const filterKey = JSON.stringify(filters);
      if (e.event_type === 'query.served') {
        demandServed[filterKey] = (demandServed[filterKey] || 0) + 1;
      } else {
        demandUnserved[filterKey] = (demandUnserved[filterKey] || 0) + 1;
      }
    });

    const formatDemand = (demandMap: Record<string, number>) =>
      Object.entries(demandMap)
        .map(([filtersJson, count]) => ({ filters: JSON.parse(filtersJson), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    const demand = {
      served_combos: formatDemand(demandServed),
      unserved_combos: formatDemand(demandUnserved),
    };

    return NextResponse.json({
      funnel,
      reason_leaderboard: reasonLeaderboard,
      throughput,
      demand,
    });
  } catch (e) {
    return toResponse(e);
  }
}
