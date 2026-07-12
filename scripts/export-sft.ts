import { dbAdmin } from '../src/modules/core/db';
import { renderTemplate } from '../src/modules/generation/template';
import * as fs from 'fs';
import * as path from 'path';

async function run() {
  const { data: items, error } = await dbAdmin.from('profiles')
    .select('content, generation_runs(params, generators(prompt_template))')
    .eq('status', 'approved');

  if (error) {
    console.error('Failed to fetch approved profiles:', error.message);
    process.exit(1);
  }

  const dir = path.join(process.cwd(), 'exports');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  const file = path.join(dir, 'sft.jsonl');
  const stream = fs.createWriteStream(file, { flags: 'w' });

  for (const item of (items ?? [])) {
    const run = item.generation_runs as any;
    const gen = run?.generators;
    const prompt = gen ? renderTemplate(gen.prompt_template, run.params) : '';

    const row = {
      messages: [
        { role: 'system', content: 'You generate synthetic psychological data.' },
        { role: 'user', content: prompt },
        { role: 'assistant', content: JSON.stringify(item.content) }
      ]
    };
    stream.write(JSON.stringify(row) + '\n');
  }
  stream.end();
  console.log(`SFT dataset exported to ${file} (${(items ?? []).length} rows)`);
}

run().catch(console.error);
