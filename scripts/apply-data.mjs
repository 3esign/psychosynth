import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl || databaseUrl.includes('[YOUR-PASSWORD]')) {
  console.error('\nERROR: DATABASE_URL is missing or contains placeholder text.');
  console.error('Please set DATABASE_URL to your Supabase Postgres connection string.');
  console.error('Example:');
  console.error('  $env:DATABASE_URL="postgresql://postgres.jvbjfspgfucmthagtehy:YOUR_PASSWORD@aws-0-eu-north-1.pooler.supabase.com:6543/postgres"\n');
  process.exit(1);
}

const rootDir = path.resolve(__dirname, '..');

// Create pg client
const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});

async function runSqlFile(relativeFilePath, cwdDir = rootDir) {
  const fullPath = path.resolve(rootDir, relativeFilePath);
  console.log(`\n=== Executing ${relativeFilePath} ===`);
  
  const content = fs.readFileSync(fullPath, 'utf8');
  
  // If the file is a master apply file (contains \i), resolve and run each included file
  if (content.includes('\\i ')) {
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('\\i ')) {
        const includeFile = trimmed.substring(3).trim();
        const includePath = path.resolve(cwdDir, includeFile);
        const relativeIncludePath = path.relative(rootDir, includePath);
        console.log(`  -> Including ${relativeIncludePath}`);
        const sqlText = fs.readFileSync(includePath, 'utf8');
        try {
          await client.query(sqlText);
        } catch (err) {
          console.error(`FAILED executing included file ${relativeIncludePath}:`, err.message);
          throw err;
        }
      }
    }
  } else {
    // Otherwise, execute the file content directly
    try {
      await client.query(content);
    } catch (err) {
      console.error(`FAILED executing ${relativeFilePath}:`, err.message);
      throw err;
    }
  }
}

async function query(sqlCommand) {
  const res = await client.query(sqlCommand);
  if (res.rows && res.rows[0]) {
    const val = Object.values(res.rows[0])[0];
    return val;
  }
  return '';
}

async function main() {
  console.log('Connecting to database...');
  await client.connect();
  console.log('Connected successfully!');

  console.log('\n=== Preflight Verification ===');
  try {
    const totalProfiles = await query("SELECT count(*) FROM profiles;");
    const pollutedProfiles = await query("SELECT count(*) FROM profiles WHERE EXISTS (SELECT 1 FROM unnest(tags) t WHERE t LIKE 'batch-%');");
    console.log(`profiles total:          ${totalProfiles}`);
    console.log(`batch-* polluted profiles: ${pollutedProfiles}`);
  } catch (e) {
    console.error("Preflight failed. Please verify your DATABASE_URL and connection.", e.message);
    process.exit(1);
  }

  // 1. Migrations
  await runSqlFile('supabase/migrations/0021_bias_examples_mitigations.sql');
  await runSqlFile('supabase/migrations/0025_bias_taxonomy.sql');
  await runSqlFile('supabase/migrations/0022_crypto_native_biases.sql');
  await runSqlFile('supabase/migrations/0023_a2a_commerce_battery.sql');
  await runSqlFile('supabase/migrations/0024_productize_new_segments.sql');
  await runSqlFile('supabase/migrations/0026_perp_psychology_pack.sql');

  // 2. Batches
  const enrichV4Dir = path.resolve(rootDir, 'outputs/enrich-v4');
  await runSqlFile('outputs/enrich-v4/APPLY_ALL.sql', enrichV4Dir);
  await runSqlFile('outputs/enrich-v4/05_repair_v3.sql', enrichV4Dir);

  const dopplerDir = path.resolve(rootDir, 'outputs/doppler-a2a-v1');
  await runSqlFile('outputs/doppler-a2a-v1/APPLY_ALL.sql', dopplerDir);

  const a2aCommerceDir = path.resolve(rootDir, 'outputs/enrich-a2a-commerce');
  await runSqlFile('outputs/enrich-a2a-commerce/APPLY_ALL.sql', a2aCommerceDir);

  const launchDayDir = path.resolve(rootDir, 'outputs/enrich-launch-day');
  await runSqlFile('outputs/enrich-launch-day/APPLY_ALL.sql', launchDayDir);

  const socialCascadesDir = path.resolve(rootDir, 'outputs/enrich-social-cascades');
  await runSqlFile('outputs/enrich-social-cascades/APPLY_ALL.sql', socialCascadesDir);

  const perpDir = path.resolve(rootDir, 'outputs/perp-v1');
  await runSqlFile('outputs/perp-v1/APPLY_ALL.sql', perpDir);
  await runSqlFile('outputs/perp-v1/05_repair_v3.sql', perpDir);

  console.log('\n=== Post-apply Verification ===');
  const leftPolluted = await query("SELECT count(*) FROM profiles WHERE EXISTS (SELECT 1 FROM unnest(tags) t WHERE t LIKE 'batch-%');");
  const approvedProfiles = await query("SELECT count(*) FROM profiles WHERE status='approved';");
  const cleanSolana = await query("SELECT count(*) FROM profiles WHERE status='approved' AND 'chain:solana' = ANY(tags);");
  const scenarios = await query("SELECT count(*) FROM scenarios;");
  const responses = await query("SELECT count(*) FROM profile_scenario_responses;");
  const evalBatteries = await query("SELECT count(*) FROM eval_batteries WHERE status='live';");
  const biasesWithExamples = await query("SELECT count(*) FROM biases WHERE jsonb_array_length(examples) > 0;");

  console.log(`batch-* polluted profiles left: ${leftPolluted} (MUST be 0)`);
  console.log(`approved profiles:        ${approvedProfiles}`);
  console.log(`clean chain:solana:       ${cleanSolana}`);
  console.log(`scenarios:                ${scenarios}`);
  console.log(`conditioned responses:    ${responses}`);
  console.log(`live eval batteries:      ${evalBatteries}`);
  console.log(`biases with examples:     ${biasesWithExamples}`);

  await client.end();
  console.log('\n✅ DONE — All data applied successfully!');
}

main().catch(async (err) => {
  console.error("FATAL ERROR:", err);
  try {
    await client.end();
  } catch {}
  process.exit(1);
});
