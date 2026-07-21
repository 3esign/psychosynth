# Psychosynth v4 enrichment batch

Generated offline by `scripts/enrich-dataset.mjs` (no LLM; seeded, reproducible).
Seed: `psychosynth-v4-2026-07-21`.

## What's here (apply in this order)

| file | rows | purpose |
|---|---|---|
| `00_generation_run.sql` | 1 generator + 1 run | engine identity + provenance anchor (idempotent) |
| `01_scenarios.sql` | 80 | fresh high-stakes scenarios (unique slugs) |
| `02_profiles.sql` | 4,000 | approved profiles, all sellable segments, full `content` (Big Five + Dark Triad + prospect-theory + cognitive-reflection) |
| `03_responses.sql` | 4,000 | trait-conditioned behavioral responses |
| `04_provenance.sql` | 8,000 | provenance stamps (synthetic, authored engine) |
| `05_repair_v3.sql` | — | **review before running** — deletes the batch-tag-polluted v3 rows |

Every insert is `ON CONFLICT DO NOTHING` and uses deterministic UUIDs, so the
batch is safe to re-run.

## Apply

```bash
# whole batch (leaves the v3 repair commented out):
psql "$DATABASE_URL" -f outputs/enrich-v4/APPLY_ALL.sql

# then, after reviewing it, the v3 rewrite-in-place cleanup:
psql "$DATABASE_URL" -f outputs/enrich-v4/05_repair_v3.sql
```

Or paste each numbered file into the Supabase SQL editor in order.

## Verified (loaded into a scratch PostgreSQL 16 against the real schema)

- 4,000 profiles / 4,000 responses / 80 scenarios / 8,000 provenance load with every FK, jsonb cast, and array satisfied.
- **100% distinct summaries** (4000/4000) — no near-duplicate template pollution.
- **0** `batch-*` tags, **0** malformed tags, **0** schema violations.
- Pack filters resolve: robinhood-counterparty-pack → 1,200, solana-trading-pack → 871, chain:base → 500, crypto-whale → ~580, x402 → 300.
- Advertised filters queryable: λ≥3.0 loss-averse → 473; machiavellianism≥0.7 → 775.
- **Responses are conditioned on traits**: mean neuroticism per posture bucket
  ranges 0.26 (calculating) → 0.71 (impulsive) — an `i % 6` action cycle would
  leave every bucket at ~0.5.
- `05_repair_v3.sql` deletes only `batch-*`-tagged rows, cascades their
  responses, and leaves the clean batch intact (verified with an injected row).

## Regenerate

```bash
node scripts/enrich-dataset.mjs --dry                       # quality gates only
node scripts/enrich-dataset.mjs --seed <new-seed>           # a fresh, non-overlapping batch
node scripts/enrich-dataset.mjs --profiles 8000 --responses 8000
```
