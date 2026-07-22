# Publishing psychosynth

One command handles the code side; the database is a separate, explicit step
(Vercel never runs migrations for you).

## One-click: code → GitHub → Vercel

```bash
bash scripts/publish.sh -m "feat: v4 enrichment + bankr skill fixes"
```

`publish.sh` runs the same gates Vercel runs, commits, and pushes. Because the
Vercel project is Git-integrated, the push triggers the production deploy — no
`vercel` CLI needed. Flags: `--skip-checks` (commit+push only), `--no-push`
(commit only).

What the gates run: `npm run typecheck`, `npm run lint`, `npm run test`,
`npm run build`.

## Database (Supabase / Postgres) — apply in order

Vercel deploys code, not data. Apply these to your database once per release
that changes them. All three are idempotent.

```bash
# 1) Fixes the cognitive-bias-simulator preview 500 (schema drift: adds the
#    examples/mitigations columns if missing) AND seeds real worked examples +
#    mitigations for all 20 biases (content the product advertised but shipped empty).
psql "$DATABASE_URL" -f supabase/migrations/0021_bias_examples_mitigations.sql
#    or:  npx supabase db push

# 2) v4 enrichment batch — 4,000 profiles + 4,000 conditioned responses +
#    80 scenarios + 8,000 provenance rows (all sellable segments).
psql "$DATABASE_URL" -f outputs/enrich-v4/APPLY_ALL.sql

# 3) v3 cleanup (rewrite-in-place) — REVIEW FIRST. Deletes the old
#    batch-tag-polluted profiles + their responses. Only touches batch-* rows.
psql "$DATABASE_URL" -f outputs/enrich-v4/05_repair_v3.sql
```

## What changed in this release

**Data pipeline (v4 enrichment)**
- `scripts/enrich-dataset.mjs` + `scripts/lib/{psychometrics,archetypes}.js`,
  widened `scripts/lib/synth.js`. Offline, seeded, gated generator.
- `outputs/enrich-v4/*` — the verified SQL batch (loads clean into PostgreSQL 16).
- `populate-v3-dataset.ts` deprecated (guarded so it can't be run).

**Bankr skill fixes** (`integrations/bankr-skills/psychosynth/`)
- Four workflow scripts corrected to use the right endpoints/fields (they were
  reading fields the free preview doesn't return, so they printed nulls).
- `SKILL.md` now documents all 5 products + the robinhood-stress-battery eval,
  and the preview-vs-paid record-shape difference.

**API fix**
- `supabase/migrations/0021_*` fixes the cognitive-bias-simulator preview 500.

## Post-deploy smoke test

After the Vercel deploy is live and the DB steps are applied, run the read-only
smoke test — it hits discovery, the products catalog, all 5 previews, and the
eval battery, and asserts each returns 200 with a sane shape (including that the
cognitive-bias preview serves populated `examples`/`mitigations` — the 500
regression guard):

```bash
bash scripts/smoke.sh
# against a preview deployment:
PSYCHOSYNTH_BASE_URL=https://your-preview.vercel.app bash scripts/smoke.sh
```

Exit 0 = all green. Any non-200 or shape failure prints `FAIL` and exits 1.

## Pre-flight checklist

- [ ] `bash scripts/publish.sh` gates pass locally
- [ ] Vercel env vars set (Supabase keys, `X402_*`, Upstash) — see `.env.example`
- [ ] DB steps 1–3 applied to the production database
- [ ] `bash scripts/smoke.sh` returns ALL CHECKS PASSED after deploy
