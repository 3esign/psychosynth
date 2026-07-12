import { dbAdmin } from '../src/modules/core/db';
import { renderTemplate } from '../src/modules/generation/template';
import * as fs from 'fs';
import * as path from 'path';

async function run() {
  // curation_decisions.run_id has no FK, so a PostgREST embed of
  // generation_runs is impossible here — fetch runs in a second query.
  const { data: decisions, error } = await dbAdmin.from('curation_decisions')
    .select('original_content, edited_content, run_id')
    .eq('decision', 'edited_approved');

  if (error) {
    console.error('Failed to fetch decisions:', error.message);
    process.exit(1);
  }

  const runIds = [...new Set((decisions ?? []).map(d => d.run_id).filter(Boolean))];
  const runsById = new Map<string, any>();

  if (runIds.length > 0) {
    const { data: runs, error: runsErr } = await dbAdmin.from('generation_runs')
      .select('id, params, generators(prompt_template)')
      .in('id', runIds);
    if (runsErr) {
      console.error('Failed to fetch generation runs:', runsErr.message);
      process.exit(1);
    }
    for (const r of (runs ?? [])) runsById.set(r.id, r);
  }

  const dir = path.join(process.cwd(), 'exports');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  const file = path.join(dir, 'dpo.jsonl');
  const stream = fs.createWriteStream(file, { flags: 'w' });

  let rows = 0;
  for (const dec of (decisions ?? [])) {
    const run = dec.run_id ? runsById.get(dec.run_id) : null;
    const gen = run?.generators as any;
    const prompt = gen ? renderTemplate(gen.prompt_template, run.params) : '';

    const row = {
      prompt,
      chosen: dec.edited_content,
      rejected: dec.original_content
    };
    stream.write(JSON.stringify(row) + '\n');
    rows++;
  }
  stream.end();
  console.log(`DPO preference dataset exported to ${file} (${rows} pairs)`);
}

run().catch(console.error);
