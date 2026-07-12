# Psychosynth

Synthetic psychometric data, generated and human-curated in an internal Lab, sold to autonomous agents over the x402 protocol (USDC on Base). Every record is versioned, schema-validated, and carries a cryptographic provenance chain. All data is synthetic — `synthetic: true` in every paid payload.

## Architecture at a glance

- **Generator OS** — generators are database rows (prompt template + params schema + output schema + hook chain + model config), not code. New methodology = new version row.
- **Hooks pipeline** — every generated item passes `schema_validate → dedup (pg_trgm) → provenance_stamp → route` before reaching a human.
- **The Lab** (`/lab`) — admin UI: run generators, keyboard-driven curation queue (A/R/E/J/K), data browser with provenance drawer, system metrics.
- **Learning Loop** — every run, hook execution, curation decision, and buyer query lands in append-only `events` / `curation_decisions` tables; export scripts turn them into SFT/DPO/classifier datasets.
- **Payments** — custom EIP-3009 gate in `src/proxy.ts` (Next 16 middleware): buyer signs a gasless USDC `TransferWithAuthorization`; we verify off-chain, settle on-chain from a settlement wallet, and serve data in the same request.

## Setup

1. `npm install`
2. Copy `.env.example` → `.env` and fill every variable (see comments in the file).
3. Apply migrations + seed: `npx supabase db push` (migrations `0001`–`0005`), then run `supabase/seed.sql`.
4. `npm run dev`

## API surface

| Route | Auth | Purpose |
|---|---|---|
| `GET /api/v1/products` | free, rate-limited | catalog |
| `GET /api/v1/preview/:slug` | free, rate-limited | deterministic sample (lowest content hashes) |
| `GET /api/v1/query/:slug` | x402 payment | full records with filters |
| `GET /api/health` | free | DB connectivity check |
| `/api/lab/*` | admin session | generators, runs, queue, decisions, entities, products, stats |
| `/docs`, `/methodology/:slug` | free | buyer documentation, per-generator methodology |

Admin access: Supabase email/password login at `/lab/login`, allowlisted via `ADMIN_EMAILS`.

## Scripts

- `npm run buyer-test` — end-to-end paid query against a running instance (needs `TEST_BUYER_PRIVATE_KEY` with USDC on Base).
- `npm run export:sft | export:dpo | export:reject-cls | export:demand` — training-data and demand exports into `exports/`.
- `npm run typecheck` — `tsc --noEmit`.

## Known M1 limitations (deliberate, documented)

- Rate limiting is in-memory per serverless instance (catalog/preview only) — upgrade path is a distributed store (e.g. Upstash Redis).
- Batch generation runs inside Vercel's `after()` window; keep batch counts modest (≤ ~25) or move to a worker/queue for larger runs.
- Payment settlement waits for on-chain receipt before serving (fail-closed by design; adds ~2s latency per paid call).

## Docs

Strategy and specs live in `docs/` (MASTERPLAN → DEVELOPMENT → IMPLEMENTATION → M1_COMPLETION_PLAN). Superseded brainstorms are in `docs/archive/`.
