# PSYCHOSYNTH — M1 Completion & Remediation Plan

**Date:** 2026-07-11 · **Basis:** code audit vs `IMPLEMENTATION.md` (the spec; § references below point there)
**Goal:** close the gap between current code and the §15 Definition of Done.
**Rule:** the spec is the contract. Where current code diverges, converge to spec unless a task below explicitly says otherwise. Read `node_modules/next/dist/docs/` before touching Next-specific code (Next 16 conventions differ — e.g. `src/proxy.ts` IS the correct middleware filename; do **not** rename it to `middleware.ts`).

---

## 0. Current state (audited, verified)

**Done & sound** — keep as-is:
migrations `0001–0004` + `seed.sql` (incl. 20 biases, both generators, recipe, live product); `modules/core` (auth, canonical, db, errors); `modules/learning`; `modules/hooks` (all 4 + registry); `modules/recipes/resolver` (parameterized, no SQL injection); `modules/commerce/payments`; export scripts; `requireAdmin` on all existing lab routes. `tsc --noEmit` is clean.

**Broken** — fix in WS1/WS2:

| # | Defect | Where |
|---|--------|-------|
| B1 | Paywall accepts ANY successful Base tx (no amount/recipient/USDC check, no replay protection); real x402 libs installed but unused | `src/proxy.ts` |
| B2 | Buyer attribution lost: proxy sets `x-buyer-wallet`/`x-tx-ref` on the *response*; route reads *request* headers → every `x402_payments` row has null wallet/tx_ref | `src/proxy.ts` + `api/v1/products/[slug]` |
| B3 | `/api/v1/preview/:slug` is paywalled; spec says free | `src/proxy.ts` matcher/slug parsing |
| B4 | Paid route never emits `query.served`/`query.unserved` → demand telemetry dead, `export-demand.ts` always empty | `api/v1/products/[slug]/route.ts` |
| B5 | Cost always ~0: reads `usage.promptTokens` but `ai@7` exposes `inputTokens`/`outputTokens` (`as any` hides the type error) | `modules/generation/models.ts:49` |
| B6 | Run processing fired without `after()`/`waitUntil` → serverless teardown kills runs mid-flight | `modules/generation/executor.ts` |
| B7 | `curation/decide` skips the spec's Zod body schema and edited-content re-validation | `api/lab/curation/decide/route.ts` |
| B8 | Fail-open config: `db.ts`/`auth.ts` fall back to dummy keys; dev auth bypass; `x-mock-payment` bypass | `core/db.ts`, `core/auth.ts`, `proxy.ts` |

**Missing entirely** — build in WS2–WS5:
Lab API: `runs/:id`, `generators` POST + `/:slug/version`, `entities/profiles(/:id)`, `products`, `stats`, `/api/health`. UI: `/lab/login`, `/lab/run`, real `/lab/review`, `/lab/browse`(+stats), all 5 `components/lab/*`, layout auth gate. Public: `/docs`, `/methodology/[slug]`. Infra: rate limiting, `.env.example`, CI, tests, ESLint import-boundary rules.

---

## 1. Workstreams

Priorities: **P0** = revenue spine + data integrity (nothing else matters if payments are fake and telemetry is null). **P1** = curation loop (the corpus can't be built without it). **P2** = public surface + delivery hardening.

### WS1 — Payment gate, real x402 (P0, ~2 days, backend eng)

Replaces the hand-rolled gate. Spec: §11, §9.2.

1. **Rewrite `src/proxy.ts`** using `paymentMiddleware` from `@x402/next` + `facilitator` from `@coinbase/x402` (§11.1 skeleton). Keep the filename `proxy.ts`. Matcher: `['/api/v1/query/:path*']` only — catalog and preview fall outside it and become free again (fixes B1, B3). Verify the exact package API against docs.x402.org on build day (spec's own note — the packages move).
2. **Move the paid route** from `api/v1/products/[slug]/route.ts` to `api/v1/query/[slug]/route.ts` (spec path, §9.2). `products/[slug]` should not exist as a paid endpoint; update `scripts/buyer-test.ts` and the landing page URL.
3. **Buyer attribution** (fixes B2): take payer address + settlement reference from the x402 settlement result (check `@x402/next` docs for how it exposes them to the handler — request header or context). If any custom request-header forwarding remains, it must use `NextResponse.next({ request: { headers } })`, never `response.headers.set`.
4. **Emit `query.served` / `query.unserved`** in the query route with the filter payload (fixes B4); zero-result queries return 200 `count:0` (§9.2). Add `provenance` block + `docs` URL to the envelope exactly per §9.2.
5. **Rewrite `scripts/buyer-test.ts`** to `wrapFetchWithPayment` from `x402-fetch` (§11.3). Env: `TEST_BUYER_PRIVATE_KEY` (rename from `TEST_BUYER_PK`), never set in deployed envs.
6. **Env renames:** `MERCHANT_WALLET_ADDRESS` → `X402_PAYOUT_ADDRESS`; add `X402_NETWORK` (`base-sepolia` staging / `base` prod). Remove the `x-mock-payment` bypass; testnet is the dev path.
7. **Price source:** middleware hardcodes `$0.01` mirroring `products.price_model` (M1 accepts duplication, §11.1). Reconcile the seed's `{type:"flat", amount_usdc}` shape with what the catalog route publishes — pick one shape, document it in `/docs`.

**Acceptance:** buyer script completes 402→pay→200 on Base Sepolia; `x402_payments` row has real wallet + tx ref; `payment.settled`, `query.served` events present; unpaid request gets 402 with quote; preview + catalog respond with no payment; a replayed/forged tx hash cannot pass (guaranteed by facilitator verification, not our code).

### WS2 — Runtime & API integrity fixes (P0, ~1.5 days, backend eng)

1. **Cost tracking** (B5): `models.ts` → `usage.inputTokens` / `usage.outputTokens`, drop `as any`, keep `?? 0`. Sanity-check one live run shows non-zero `cost_usd`.
2. **Run survival** (B6): wrap `processRun` in `after()` (from `next/server`) in the runs route/executor so Vercel keeps the instance alive. Response stays 202 + `run_id`.
3. **Decisions route** (B7): align path to spec `POST /api/lab/decisions` (rename from `curation/decide`), copy the §9.1 reference implementation verbatim (Zod `Body` with all three `refine` rules), and add Ajv re-validation of `edited_content` against the generator's output schema (fetch generator via the entity's run; return `invalid_params` with Ajv errors). Also rename `curation/queue` → `queue` (§9.1). Cheap now — the UI that calls them is being rebuilt in WS4.
4. **Fail-closed config** (B8): `db.ts`/`auth.ts` throw at startup on missing env instead of dummy fallbacks; delete the dev auth bypass (use a real local Supabase user; `supabase start` per §12).
5. **Missing lab routes** (§9.1): `GET /api/lab/runs/:id` (UI polls 2s), `POST /api/lab/generators`, `POST /api/lab/generators/:slug/version` (version bump + `generator.version_bumped` event + deprecate old on activate), `GET /api/lab/entities/profiles` (+`/:id` with bias links, provenance, decisions), `GET/POST /api/lab/products` (publish flips status→`live`, emits `product.published`), `GET /api/lab/stats` (§10.5 payload — funnel, reason leaderboard, cost-per-approved, throughput, demand combos), `GET /api/health` (§16 runbook target).
6. **Rate limiting** (§13): per-IP token bucket, 60/min, 429 envelope, on `/api/v1/products` and `/api/v1/preview/*`. In-memory per instance is acceptable for M1; leave a comment noting the Upstash upgrade path.

**Acceptance:** all §9.1 routes exist and are `requireAdmin`-guarded (unit test: no session → 401); decide-route rejects: rejection without `reason_code`, `other` without notes, edit without content, edit failing output schema; a run started via API survives ≥60s of generation and lands counters + cost.

### WS3 — Lab UI (P1, ~4–5 days, frontend eng; the review page is the only page worth polish)

Spec: §10. Tailwind only, no component library. Every page: loading / empty / error states.

1. **Auth** (§10.2): `/lab/login` (email+password, `signInWithPassword`, browser client — auth is the only thing the browser does directly). `lab/layout.tsx` becomes a server component: `@supabase/ssr` cookie session → no session redirects to `/lab/login`, non-allowlisted email → 403 page. Remove dead nav links (`/lab/generators`, `/lab/settings`) or build stubs behind them.
2. **Components** `src/components/lab/`: `SchemaForm` (§10.3 — code provided in spec, copy it), `ReviewCard` (OCEAN trait bars, summary, style/MBTI chips, tags, bias chips, hook diagnostics, slug@version + run link), `JsonEditor` (textarea + `JSON.parse` + Ajv vs item schema + error list), `TraitBars`, `ReasonPalette` (all **8** reason codes with 1–8 hints — current page shows only 5; keep in sync with seed).
3. **`/lab/run`** (§10.3): generator dropdown (active, `slug@version`) + SchemaForm params + count + Run; right column run-history table (last 20) with newest run polling `GET /api/lab/runs/:id` every 2s; failure → red banner with `error`.
4. **`/lab/review`** (§10.4): replace current `lab/page.tsx`. One card at a time, "14 of 87" position, preload next 5. Full keyboard map: `A` approve, `R` reason palette, `1–8` pick reason (`other` → note → Enter), `E` editor, `⌘/Ctrl+Enter` save edit as `edited_approved` (client-side Ajv first), `Esc` close, `J/K` skip. **Real `time_spent_ms`** from a per-card mount timer (current code hardcodes 5000 — that poisons the throughput stats). Optimistic advance, rollback + toast on POST failure. Empty state links to `/lab/run`. Spec has the state/keyboard skeleton — start from it.
5. **`/lab/browse` + stats tab** (§10.5): filter bar reusing resolver param names 1:1 → table → row-click provenance drawer (content JSON, bias links, provenance rows, decision history — this drawer is a DoD demo item). Stats tab renders the `/api/lab/stats` payload: funnel per generator version, reason leaderboard, cost-per-approved, decisions/day, median `time_spent_ms`.

**Acceptance:** DoD walkthrough items 1–3 and 5 pass: login + 403 for non-allowlisted; run 20 profiles from UI with visible counters/cost; keyboard-only approve/reject-with-reason/edit land correctly in `curation_decisions` (edit bumps version + `human-edit` provenance row); browse drawer shows full provenance chain.

### WS4 — Public pages (P2, ~1 day, frontend eng)

Spec: §10.6.

1. `/` landing: synthetic-data disclosure, live product cards from `/api/v1/products`, link `/docs`. Fix the query URL it prints (now `/api/v1/query/...`).
2. `/docs`: the 402 flow in 10 lines, copy-paste `curl` + buyer snippet, filter reference rendered from recipes, zero-result policy ("you pay for the query, not the rows"), ToS section (prohibited uses per §13), privacy note (no PII by construction).
3. `/methodology/[slug]`: rendered from the generator row — description, model family, params/output schema tables, **template hash only** (not the template — that's the secret sauce), bias source citations. This is the `provenance.methodology` target in paid envelopes; it must not 404.

**Acceptance:** every URL emitted in a paid envelope resolves; landing shows live product with price.

### WS5 — Tests, CI, hardening (P2, ~2–3 days, both; start early, finish last)

Spec: §12–§14.

1. **Unit (Vitest):** canonical hash stability, template engine truthiness/`{{json}}`, resolver whitelisting + limit capping + trait-bound parsing, route-hook verdict logic, decisions Zod refines. Commit 3 canned LLM outputs under `fixtures/` (one valid, one schema-violating, one near-duplicate) — CI never calls real providers.
2. **Integration (local Supabase):** executeRun end-to-end with mocked `generateItems`; `decide_curation` all three decisions + double-decide raises + edit bumps version; resolver vs seeded fixtures; events UPDATE/DELETE affects 0 rows.
3. **CI** `.github/workflows/ci.yml` (§14, YAML provided in spec): lint + typecheck + test + secret tripwire (`! grep -r 'NEXT_PUBLIC_SUPABASE_SERVICE' src/`), plus manual-trigger money-path job running `buyer-test.ts` against staging testnet. Add `typecheck` and `test` npm scripts.
4. **`.env.example`** with every var: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAILS`, `OPENROUTER_API_KEY` (+ other provider keys), `X402_PAYOUT_ADDRESS`, `X402_NETWORK`, CDP keys (prod), and a comment that `TEST_BUYER_PRIVATE_KEY` is script-only, never deployed.
5. **ESLint import boundaries** (§4.1 rules) via `no-restricted-imports`: core imports nothing internal; modules never import `app/`; UI never imports `db.ts`.
6. **Security checklist §13** — walk every checkbox; `npm audit` clean of criticals.
7. Optional if time-boxed: Playwright happy path (login → run mocked → keyboard review → browse provenance).

**Acceptance:** CI green on a fresh clone; §13 all ticked.

---

## 2. Sequencing & ownership

Two engineers, ~1.5–2 weeks. Owner task on day 1: wallet setup (§11.2) — payout wallet → `X402_PAYOUT_ADDRESS`, funded Sepolia test buyer wallet.

```
Eng A (backend):  WS1 (d1–2) → WS2 (d3–4) → WS5 tests/CI (d5–7) → support cutover
Eng B (frontend): WS3 auth+components (d1–2) → run+review (d3–5) → browse/stats (d6) → WS4 (d7)
Owner:            wallet day 1 → corpus curation (≥300 approved) as soon as run+review land → mainnet cutover §11.4
```

Dependencies: WS3-review needs WS2.3 (decisions route) — land that first within WS2. WS4-methodology needs nothing new (generator row exists). Money-path CI job needs WS1 + staging env. Corpus curation (DoD: ≥300 approved) starts the moment WS3 run+review are usable — don't wait for browse/stats.

Explicitly **out of scope** (M2+, per §1.1): judge calibration, golden sets, product builder generating middleware config from DB, additional generators beyond seeded two, Redis rate limiting.

---

## 3. DoD traceability (§15)

| DoD item | Covered by |
|---|---|
| Login + 403 non-allowlisted | WS3.1 |
| Run from UI, counters + cost, hook-reject visible | WS3.3 + WS2.1/2.2 (cost, `after()`) + WS5.1 (fixtures) |
| Keyboard review: approve/reject/edit, `time_spent_ms`, version bump | WS3.4 + WS2.3 |
| ≥300 approved profiles | Owner, after WS3.3/3.4 |
| Browse provenance drawer | WS3.5 |
| Free + rate-limited catalog/preview, stable preview | WS1.1 + WS2.6 |
| Paid mainnet query; USDC arrives; payment + events recorded | WS1 (+ §11.4 cutover) |
| Zero-result → `count:0` + `query.unserved` | WS1.4 |
| `/lab/stats` from real data | WS2.5 + WS3.5 |
| Non-empty SFT/DPO exports | Existing scripts + corpus |
| §13 security checklist + CI green | WS5 |

---

## 4. Known divergences — decided

- `src/proxy.ts` filename: **keep** (Next 16 convention; spec's `middleware.ts` is stale naming).
- Lab route paths: **converge to spec** (`/api/lab/queue`, `/api/lab/decisions`) while the UI is rebuilt (WS2.3).
- Paid route path: **converge to spec** `/api/v1/query/:slug` (WS1.2).
- Seed `model_config` uses `openrouter`/`claude-3.5-sonnet` (spec wanted `claude-sonnet-4-5`): functional as-is; bump via a new migration when the owner wants — never edit an applied migration (§14).
- `price_model` shape (`amount_usdc` vs `per_query_usdc`): keep `amount_usdc` but publish it consistently in catalog + docs + middleware price (WS1.7).
