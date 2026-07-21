# Robinhood Push — Launch Checklist

Everything for the two Robinhood products is built, seeded, and security-hardened.
This is the "one click" a person or agent runs to go live.

## What goes live

| Product | Endpoints | Price | Data |
|---|---|---|---|
| **Robinhood Counterparty Pack** | `/api/v1/preview/robinhood-counterparty-pack` (free), `/api/v1/query/robinhood-counterparty-pack` (x402) | $0.03/query · $2.50 / 100 · $19 / 1,000 | ~30 seeded retail personas (grows as you generate more) |
| **Robinhood Stress Battery** | `/api/v1/eval/robinhood-stress-battery` — GET free (6 scenarios + rubric), POST x402 (scored report) | $2.00 / scoring run | 6 seeded scenarios, 5 behavioral dimensions |

Both auto-appear in `/api/v1/discovery`. Scoring runs on a **free deterministic scorer** (zero inference cost); flip `EVAL_USE_LLM_JUDGE=true` later for the LLM judge.

## One-time env (before first deploy)

Already set in local `.env`: `X402_PAYOUT_ADDRESS=0xYourPayoutWalletAddress`, `X402_NETWORK=base`.

Mirror these in your **host** (e.g. Vercel dashboard) — local `.env` does not ship to production:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `X402_PAYOUT_ADDRESS=0xYourPayoutWalletAddress`  (your USDC-on-Base fee wallet — self-custody, not an exchange address)
- `ADMIN_EMAILS=<your email>`  ← currently the `owner@example.com` placeholder; set this to log into the Lab
- Optional: `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` for real distributed rate limiting
- Do **not** set `EVAL_USE_LLM_JUDGE` (leave off = free scoring). No LLM keys needed.

## Launch

```bash
bash scripts/launch.sh      # checks env, runs `supabase db push`, typecheck, build
# then deploy as usual, e.g.:  vercel --prod   (or git push to your connected branch)
```

Migrations applied: `0013` (pack), `0014` (battery), `0015`+`0017` (30 personas), `0016` (security lockdown).

## Post-deploy smoke test

```bash
BASE=https://your-deployment.example.com
curl -s "$BASE/api/v1/discovery" | jq '.products[].slug, .evaluations[].battery'
curl -s "$BASE/api/v1/preview/robinhood-counterparty-pack" | jq '.count'      # > 0
curl -s "$BASE/api/v1/eval/robinhood-stress-battery" | jq '.scenarios|length' # 6
# Paid endpoints must answer 402 (quote) when unpaid:
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/api/v1/query/robinhood-counterparty-pack"   # 402
```

## Verification already done

- All embedded JSON in migrations `0013`–`0017` parses; the battery references exactly its 6 seeded scenarios.
- All new/changed TypeScript passes esbuild transform (no syntax errors).
- Security lockdown reviewed safe: the browser client is used only for login; every table read is server-side via the service role.

Not verified here (mounted-drive tsc was too slow): full `tsc --noEmit`. `scripts/launch.sh` runs `npm run typecheck` + `npm run build` locally, which will catch any type error before you deploy.

## First real payment

The eval POST and the pack query settle live USDC. Do one paid round-trip from a funded agent wallet before promoting publicly, and confirm the payment lands at `0x525e…a2C5` on Base.

## Rollback

Each migration is additive. To pull a product without a DB change, set its row `status='retired'`:

```sql
UPDATE products SET status='retired' WHERE slug='robinhood-counterparty-pack';
UPDATE eval_batteries SET status='retired' WHERE slug='robinhood-stress-battery';
```
