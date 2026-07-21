// Create (or confirm) the Lab admin user in Supabase Auth.
//
// Keeps the password OUT of the repo: it is read from an env var at run time,
// never hard-coded. Node 18+ (global fetch), no dependencies.
//
// Usage (from the project root):
//   ADMIN_BOOTSTRAP_EMAIL=you@example.com \
//   ADMIN_BOOTSTRAP_PASSWORD='the-password' \
//   node scripts/create-admin.mjs
//
// Supabase URL + service-role key are loaded from .env / .env.local.
// NOTE: also add the same email to ADMIN_EMAILS in the app env, or the Lab
// will reject the login (fail-closed allowlist).

import fs from 'node:fs';

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}
loadEnv('.env');
loadEnv('.env.local');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;

if (!url || !key) { console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env/.env.local'); process.exit(1); }
if (!email || !password) { console.error('Set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD env vars'); process.exit(1); }

const res = await fetch(`${url}/auth/v1/admin/users`, {
  method: 'POST',
  headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password, email_confirm: true }),
});
const body = await res.json().catch(() => ({}));

if (res.ok && body.id) {
  console.log('✓ Created admin user:', body.email, '(id ' + body.id + ')');
} else if (res.status === 422 || /already|exists|registered/i.test(JSON.stringify(body))) {
  console.log('• User already exists — no change. Reset the password in Supabase → Authentication if needed.');
} else {
  console.error('✗ Failed:', res.status, JSON.stringify(body));
  process.exit(1);
}
