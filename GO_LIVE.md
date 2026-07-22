# GO-LIVE runbook — real simulations + real Bankr execution

This is the end-to-end path to make everything run **for real**: live API, real
x402 payments landing in your wallet, and the Bankr bot able to discover, pay,
and execute.

> **On "mocks":** nothing mock ships in the repo or the deployed app. The only
> mocks used were a local `curl` shim + JSON fixtures in this build sandbox to
> verify script logic offline. The scripts, the API, and the Bankr skill all hit
> the real `https://psychosynth.vercel.app` and the real Base chain. There is no
> "mock mode" to turn off — going live is deploy + env + DB + Bankr listing.

---

## Step 1 — Set production environment variables (Vercel → Settings → Env Vars)

**Required**
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — the real project keys.
- `ADMIN_EMAILS` — allowlist for `/lab` (fail-closed if empty).
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — **required in production**; without them rate limiting degrades to per-instance memory a serverless deploy can't enforce. Free DB at console.upstash.com.
- `X402_PAYOUT_ADDRESS` — **your real Base wallet.** This is where paid-query USDC lands. Nothing gets paid to *you* until this is your address.
- `X402_NETWORK=base`

**Recommended**
- `BASE_RPC_URL` — a dedicated RPC (Alchemy/QuickNode). The public `mainnet.base.org` rate-limits under real traffic and will cause intermittent 503s on settlement.

**Optional**
- `X402_FACILITATOR_URL` — defaults to PayAI's free public facilitator (Base mainnet, no key, it pays gas). Override only for Coinbase CDP.
- `SOLANA_PAYOUT_ADDRESS` + `SOLANA_RPC_URL` — only if you accept the self-settled Solana path.
- `EVAL_USE_LLM_JUDGE=true` + a provider key (`OPENROUTER_API_KEY` or `ANTHROPIC_API_KEY`) — upgrades the `robinhood-stress-battery` scorer from the free deterministic one to the LLM judge. The buyer pays before scoring, so it stays revenue-positive.

**Never set in Vercel** (local-only, in your `.env`): `TEST_BUYER_PRIVATE_KEY`, `SETTLEMENT_PRIVATE_KEY`. Deploying a private key is a compromise.

---

## Step 2 — Ship the code

```bash
bash scripts/publish.sh -m "go live: v4 data + bankr skill fixes"
```

Gates run, commit, push → Vercel builds and deploys the production branch.

## Step 3 — Apply the database (once per release that changes it)

```bash
psql "$DATABASE_URL" -f supabase/migrations/0021_bias_examples_mitigations.sql
psql "$DATABASE_URL" -f outputs/enrich-v4/APPLY_ALL.sql
psql "$DATABASE_URL" -f outputs/enrich-v4/05_repair_v3.sql        # review first
# if generated: psql "$DATABASE_URL" -f outputs/doppler-a2a-v1/APPLY_ALL.sql
```

## Step 4 — Verify the live surface (free, real deployment, no mock)

```bash
bash scripts/smoke.sh          # hits the REAL psychosynth.vercel.app
```

Expect `ALL CHECKS PASSED`: discovery, products, all 5 previews, eval battery,
and the bias preview serving populated examples/mitigations.

---

## Step 5 — Prove ONE real paid settlement (this is "the simulation, for real")

The paid query **is** the simulation — it returns real synthetic personas /
conditioned responses from your DB, settled on-chain. Do one real purchase:

1. Fund a Base wallet with a little **USDC** (≥ $0.05 covers several queries).
   No ETH needed — x402 EIP-3009 is **gasless for the payer**; the facilitator
   broadcasts and pays gas.
2. Put that wallet's key in your **local** `.env` as `TEST_BUYER_PRIVATE_KEY`.
3. Run the end-to-end buyer:
   ```bash
   npm run buyer-test        # scripts/buyer-test.ts
   ```
   Expect: `402` quote → auto-sign EIP-3009 → `200` with records, and the
   settlement transaction landing at your `X402_PAYOUT_ADDRESS` on Basescan.

If that returns records and the tx shows on Basescan, real agents can pay and
you get paid. Keep the Basescan link — it goes in the Bankr PR as proof.

---

## Step 6 — List the skill in Bankr (so the bot can execute for real)

1. Fork `https://github.com/BankrBot/skills`, branch `add-psychosynth`.
2. Copy `integrations/bankr-skills/psychosynth/` to the fork **root** as
   `psychosynth/` — the folder name MUST equal `catalog.json`'s `slug`, or the
   skill is silently skipped from the Discover catalog.
3. Mark the scripts executable so they run in Bankr's runtime:
   ```bash
   git update-index --chmod=+x psychosynth/scripts/*.sh psychosynth/workflows/*.sh
   ```
4. Open the PR (title + body template in `integrations/bankr-skills/HANDOFF.md`);
   include the Basescan settlement tx from Step 5 as proof.
5. After merge it appears on **skills.bankr.bot** and installs with:
   ```
   install the psychosynth skill from https://github.com/BankrBot/skills/tree/main/psychosynth
   ```

## Step 7 — The Bankr bot executes for real

Once installed, in Bankr (the platform wallet signs + settles automatically):

- `Using the psychosynth skill, run discovery` — free preflight.
- `Using the psychosynth skill, preview the robinhood counterparty pack` — free.
- `Using the psychosynth skill, buy the 100-persona robinhood counterparty pack` — **paid**: Bankr's wallet signs the EIP-3009 authorization, it settles on Base, you receive USDC, real personas return.
- `Using the psychosynth skill, run the doppler launch simulation` — runs the workflow script against the live API.
- `Using the psychosynth skill, submit my agent to the robinhood stress battery` — **paid $2** behavioral certification.

---

## Money flow (per paid call)

Agent signs a gasless USDC `TransferWithAuthorization` (EIP-3009) → facilitator
broadcasts it and pays the gas → USDC arrives at your `X402_PAYOUT_ADDRESS` →
the server returns the records in the same request. You receive USDC per query
and pay $0 gas.

## Go-live checklist

- [ ] Prod env vars set (esp. real `X402_PAYOUT_ADDRESS` + Upstash)
- [ ] `bash scripts/publish.sh` → deployed
- [ ] DB migrations + data applied
- [ ] `bash scripts/smoke.sh` → ALL CHECKS PASSED
- [ ] `npm run buyer-test` → 200 + Basescan settlement tx to your wallet
- [ ] Bankr PR merged; `install …` works; a paid Bankr prompt returns records
