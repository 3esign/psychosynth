import { dbAdmin } from '../src/modules/core/db';
import * as fs from 'fs';
import * as path from 'path';

async function run() {
  const { data: events, error } = await dbAdmin.from('events')
    .select('event_type, payload')
    .in('event_type', ['query.served', 'query.unserved']);

  if (error) {
    console.error('Failed to fetch demand events:', error.message);
    process.exit(1);
  }

  const dir = path.join(process.cwd(), 'exports');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  const stats: Record<string, { served: number; unserved: number; filters: any }> = {};

  for (const ev of (events ?? [])) {
    const p = ev.payload as any;
    // Query events store the requested filters under payload.filters
    // (see src/app/api/v1/query/[slug]/route.ts).
    const filters = p.filters ?? {};
    const key = JSON.stringify(filters);
    if (!stats[key]) {
      stats[key] = { served: 0, unserved: 0, filters };
    }
    if (ev.event_type === 'query.served') {
      stats[key].served++;
    } else {
      stats[key].unserved++;
    }
  }

  const list = Object.values(stats).sort((a, b) => (b.served + b.unserved) - (a.served + a.unserved));

  const file = path.join(dir, 'demand.json');
  fs.writeFileSync(file, JSON.stringify(list, null, 2));
  console.log(`Demand analytics report exported to ${file} (${list.length} filter combos from ${(events ?? []).length} events)`);
}

run().catch(console.error);
