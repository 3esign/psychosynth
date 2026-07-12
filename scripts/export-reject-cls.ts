import { dbAdmin } from '../src/modules/core/db';
import * as fs from 'fs';
import * as path from 'path';

async function run() {
  const { data: decisions, error } = await dbAdmin.from('curation_decisions')
    .select('original_content, decision, reason_code');

  if (error) {
    console.error('Failed to fetch curation decisions:', error.message);
    process.exit(1);
  }

  const dir = path.join(process.cwd(), 'exports');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  const file = path.join(dir, 'reject-cls.jsonl');
  const stream = fs.createWriteStream(file, { flags: 'w' });

  for (const dec of (decisions ?? [])) {
    const row = {
      input: dec.original_content,
      label: dec.decision === 'approved' ? 'approved' : dec.reason_code || 'rejected'
    };
    stream.write(JSON.stringify(row) + '\n');
  }
  stream.end();
  console.log(`Rejection classification dataset exported to ${file} (${(decisions ?? []).length} rows)`);
}

run().catch(console.error);
