import { execSync } from 'child_process';
import path from 'path';
import fileSystem from 'fs';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl || databaseUrl.includes('[YOUR-PASSWORD]')) {
  console.error('\nERROR: DATABASE_URL is missing or contains placeholder text.');
  console.error('Please set DATABASE_URL to your Supabase Postgres connection string.');
  console.error('Example:');
  console.error('  $env:DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.jvbjfspgfucmthagtehy.supabase.co:5432/postgres"\n');
  process.exit(1);
}

const rootDir = path.resolve(import.meta.dirname, '..');

function runSqlFile(relativeFilePath, cwdDir = rootDir) {
  const fullPath = path.resolve(rootDir, relativeFilePath);
  console.log(`\n=== Executing ${relativeFilePath} ===`);
  try {
    execSync(`npx supabase db query --db-url "${databaseUrl}" -f "${fullPath}"`, {
      cwd: cwdDir,
      stdio: 'inherit'
    });
  } catch (err) {
    console.error(`FAILED executing ${relativeFilePath}:`, err.message);
    process.exit(1);
  }
}

function query(sqlCommand) {
  return execSync(`npx supabase db query --db-url "${databaseUrl}" "${sqlCommand}"`, {
    cwd: rootDir,
    encoding: 'utf8'
  });
}

console.log('\n=== Preflight Verification ===');
try {
  console.log(query("SELECT 'profiles total: ' || count(*) FROM profiles;"));
  console.log(query("SELECT 'polluted profiles: ' || count(*) FROM profiles WHERE EXISTS (SELECT 1 FROM unnest(tags) t WHERE t LIKE 'batch-%');"));
} catch (e) {
  console.error("Connection failed. Please verify your DATABASE_URL password and host.");
  process.exit(1);
}

// 1. Migrations
runSqlFile('supabase/migrations/0021_bias_examples_mitigations.sql');
runSqlFile('supabase/migrations/0022_crypto_native_biases.sql');
runSqlFile('supabase/migrations/0023_a2a_commerce_battery.sql');

// 2. Batches
const enrichV4Dir = path.resolve(rootDir, 'outputs/enrich-v4');
runSqlFile('outputs/enrich-v4/APPLY_ALL.sql', enrichV4Dir);
runSqlFile('outputs/enrich-v4/05_repair_v3.sql', enrichV4Dir);

const dopplerDir = path.resolve(rootDir, 'outputs/doppler-a2a-v1');
runSqlFile('outputs/doppler-a2a-v1/APPLY_ALL.sql', dopplerDir);

const a2aCommerceDir = path.resolve(rootDir, 'outputs/enrich-a2a-commerce');
runSqlFile('outputs/enrich-a2a-commerce/APPLY_ALL.sql', a2aCommerceDir);

const launchDayDir = path.resolve(rootDir, 'outputs/enrich-launch-day');
runSqlFile('outputs/enrich-launch-day/APPLY_ALL.sql', launchDayDir);

const socialCascadesDir = path.resolve(rootDir, 'outputs/enrich-social-cascades');
runSqlFile('outputs/enrich-social-cascades/APPLY_ALL.sql', socialCascadesDir);

console.log('\n=== Post-apply Verification ===');
console.log(query("SELECT 'polluted profiles left: ' || count(*) FROM profiles WHERE EXISTS (SELECT 1 FROM unnest(tags) t WHERE t LIKE 'batch-%');"));
console.log(query("SELECT 'approved profiles:        ' || count(*) FROM profiles WHERE status='approved';"));
console.log(query("SELECT 'clean chain:solana:       ' || count(*) FROM profiles WHERE status='approved' AND 'chain:solana' = ANY(tags);"));
console.log(query("SELECT 'scenarios:                ' || count(*) FROM scenarios;"));
console.log(query("SELECT 'conditioned responses:    ' || count(*) FROM profile_scenario_responses;"));
console.log(query("SELECT 'live eval batteries:      ' || count(*) FROM eval_batteries WHERE status='live';"));
console.log(query("SELECT 'biases with examples:     ' || count(*) FROM biases WHERE jsonb_array_length(examples) > 0;"));

console.log('\n✅ DONE — All data applied successfully!');
