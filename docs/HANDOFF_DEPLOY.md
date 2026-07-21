# Deployment Handoff — Psychosynth Robinhood Push

**For an executing agent (or the owner) with a real terminal + network.** Everything
below was prepared in a sandbox that cannot reach Supabase/hosts, so it is written
as exact, ordered steps another agent can run end-to-end. Do them in order.

## Known state (as of 2026-07-19)

- **Supabase project**: `faces`, org `3esign's Org`, FREE tier, compute NANO.
  - Ref: `your_supabase_project_ref` · URL `https://your_supabase_project_ref.supabase.co`
  - **STATUS: Unhealthy** ← must be resolved first (see Step 0).
  - **Last applied migration: `0007_bias_simulator_product`.** Migrations **0008–0017
    are NOT applied yet.** This includes everything the current app already expects
    (scenario-response product, pack pricing, reviews, chain generators) plus the new
    Robinhood work — so applying them also fixes latent breakage, not just adds features.
  - GitHub: no repo connected. Branches: none.
- **App**: Next.js 16 + Supabase, single repo. Payout wallet already set in local `.env`
  (`X402_PAYOUT_ADDRESS=0xYourEvmPayoutAddress`, `X402_NETWORK=base`).
  Admin email already set locally (`ADMIN_EMAILS=admin@example.com`).
- Secrets (Supabase anon key, service-role key, etc.) live in the repo's `.env` / `.env.local`.

## Step 0 — Make the Supabase project healthy (BLOCKER)

Nothing works while the project is Unhealthy. Open the project dashboard:
- If it shows **Paused/Restore**, click restore/resume and wait until Active.
- If it stays **Unhealthy** on nano compute, use **Project Settings → restart the project**
  (or Infrastructure → restart). Free/nano can go unhealthy under load or after idle.
- Confirm the SQL Editor loads and `select 1;` runs before continuing.

## Step 1 — Apply migrations 0008 → 0017

**Preferred (correct + tracked)** — from the repo root, with the project linked:

```bash
npx supabase link --project-ref your_supabase_project_ref   # if not already linked
npx supabase db push                                   # applies 0008..0017 in order
```

**Fallback (no CLI)** — paste `outputs/APPLY_IN_SUPABASE.sql` (a concatenation of
0008→0017) into **SQL Editor → New query → Run**, once. If a block errors with
"already exists", that migration was already applied — delete that block and re-run.

Verify after: `select max(version) from supabase_migrations.schema_migrations;` should
show `0017…`, and `select count(*) from profiles where status='approved';` ≥ 30.

## Step 2 — Create the Lab admin login

Either the UI or the script (both fine):

- **UI**: Supabase → Authentication → Users → Add user → email `admin@example.com`,
  the owner's password, tick **Auto Confirm User**.
- **Script** (keeps the password out of the repo):

```bash
ADMIN_BOOTSTRAP_EMAIL=admin@example.com \
ADMIN_BOOTSTRAP_PASSWORD='<owner-password>' \
node scripts/create-admin.mjs
```

(Only needed to use the internal Lab UI; the paid product APIs work without it.)
Owner note: the password was shared in chat during setup — rotate it after first login.

## Step 3 — Deploy the web app

No host is connected yet. Recommended: Vercel (zero-config for Next.js). From the repo root:

```bash
npx vercel login          # owner authenticates once
npx vercel link           # create/link a Vercel project
# set env (see Step 4) then:
npx vercel --prod
```

(Or push the repo to GitHub and import it in the Vercel dashboard.)

## Step 4 — Host environment variables

Set these on the host (Vercel → Project → Settings → Environment Variables), copying
secret values from the repo's `.env` / `.env.local`:

| Var | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your_supabase_project_ref.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (from `.env`) |
| `SUPABASE_SERVICE_ROLE_KEY` | (from `.env` — server only, never `NEXT_PUBLIC`) |
| `ADMIN_EMAILS` | `admin@example.com` |
| `X402_PAYOUT_ADDRESS` | `0xYourEvmPayoutAddress` |
| `X402_NETWORK` | `base` |

Optional: `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (real rate limiting).
Do **not** set `EVAL_USE_LLM_JUDGE` — leaving it off keeps eval scoring free (no inference).

## Step 5 — Build gate + smoke test

```bash
npm ci && npm run typecheck && npm run build   # must be green before promoting
```

After deploy (`BASE` = the live URL):

```bash
curl -s "$BASE/api/v1/discovery" | jq '.products[].slug, .evaluations[].battery'
curl -s "$BASE/api/v1/preview/robinhood-counterparty-pack" | jq '.count'          # ≥ 1
curl -s "$BASE/api/v1/eval/robinhood-stress-battery"      | jq '.scenarios|length' # 6
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/api/v1/query/robinhood-counterparty-pack"  # 402
```

## Step 6 — First live payment

The pack query and eval POST settle real USDC. Do one paid round-trip from a funded
agent wallet and confirm it lands at `0xYourEvmPayoutAddress` on Base before promoting publicly.

---

### What goes live
- **Robinhood Counterparty Pack** — `/api/v1/query/robinhood-counterparty-pack` ($0.03/query · $2.50/100 · $19/1,000), 30 seeded retail personas.
- **Robinhood Stress Battery** — `/api/v1/eval/robinhood-stress-battery` (GET free questions; POST $2.00 scored report, free deterministic scoring).

### Rollback (no code change)
```sql
UPDATE products       SET status='retired' WHERE slug='robinhood-counterparty-pack';
UPDATE eval_batteries SET status='retired' WHERE slug='robinhood-stress-battery';
```
