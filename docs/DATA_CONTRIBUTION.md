# DATA_CONTRIBUTION.md — the contract for adding data vs. changing methodology

**Audience: any model, agent, or human contributor.** Read this before touching
anything. It defines two strictly separated lanes. When the operator says
**"add data"**, you stay in Lane 1 — nothing outside it. When the operator says
**"play with the methodology"**, Lane 2 opens — with its own gates.

---

## The one-question decision tree

> **Does the change alter how ANY existing record is generated, filtered,
> priced, scored, or paid for?**

- **No → Lane 1 (DATA).** You are adding rows. Follow Lane 1 exactly.
- **Yes → Lane 2 (METHODOLOGY).** You are changing algorithms. Follow Lane 2.

If you are unsure, it is Lane 2. Never mix lanes in one change set.

---

## Lane 1 — DATA: "just populate"

### What Lane 1 means
Adding rows to content tables via the existing authored pipeline. The result is
always **reviewable SQL under `outputs/`**, never direct writes from ad-hoc
scripts, and never edits to server code.

### Files you MAY touch
| File | What you add there |
|---|---|
| `scripts/lib/archetypes.js` | new archetypes / pools (additive entries only) |
| `scripts/lib/synth.js` | wider content banks (additive; keep existing exports) |
| `scripts/lib/behavior.js` | new scenario templates / categories content (additive) |
| `outputs/<batch-name>/*.sql` | generated output of the orchestrator |
| `supabase/migrations/00NN_*.sql` | **INSERT-only** data migrations (biases, scenarios, emotional_patterns, persona seeds) |

### Files you may NOT touch in Lane 1
`src/**` (resolver, scoring, payments, proxy, routes), `mcp/**`,
`scripts/lib/psychometrics.js` derivations, generator `output_schema`s,
`recipes.query_rules`, `products.price_model`, hooks, `.env*`, anything under
`integrations/` except pure copy fixes. If your "data" change seems to need one
of these, stop — it is Lane 2.

### The Lane 1 procedure
```bash
# 1) Author content (archetypes / scenario banks) — additive edits only.
# 2) Dry run: quality gates, ZERO writes.
node scripts/enrich-dataset.mjs --dry --seed <batch-seed>
# 3) Real run: emits ordered SQL + REPORT.json — the orchestrator REFUSES to
#    write SQL if gates fail (distinct-summary ratio >= 0.98, no batch-tag
#    pollution, zero schema violations, posture separation).
node scripts/enrich-dataset.mjs --profiles N --responses N --seed <batch-seed>
# 4) Load-test into a scratch PostgreSQL 16 (validates every FK / jsonb / ON CONFLICT).
# 5) Apply via GO_LIVE.md Step 3 (psql), then: bash scripts/smoke.sh
```

### Lane 1 invariants (the "nothing else breaks" rules)
1. **Seeded + reproducible.** Every batch takes `--seed`; same seed = same batch.
   Never call `Math.random()` outside the seeded RNG.
2. **Idempotent SQL.** Scenarios/biases upsert by `slug` (`ON CONFLICT`);
   profiles/responses insert with fixed batch UUIDs. Re-applying a file must be safe.
3. **Bias slugs are a closed set.** `suggested_biases` and `profile_bias_links`
   may only reference slugs already in `biases` (seed.sql + 0021). Adding a new
   bias = its own INSERT-only migration FIRST, then use it.
4. **Tags are the routing layer.** Pack membership is `recipes.filters.tags_include`
   matching profile tags. New data intended for a pack MUST carry that pack's pin
   tags exactly (`robinhood`+`retail-trading`, `chain:solana`, …). Clean
   kebab-case only, no `batch-*` tags ever.
5. **Status lifecycle respected.** New profiles land `pending` unless the batch is
   gate-passed authored data (then `approved` is acceptable, as in v4). Never
   flip existing rows' status in a data batch.
6. **Provenance stamped.** One `provenance` row per item, one `generation_runs`
   row per batch, `model = authored/psychosynth-synth-v*`.
7. **Schema-valid.** Items validate against the owning generator's `output_schema`.
8. **New tables are not data.** If you think you need a new table, that is Lane 2.

### Verification checklist (must all pass before "done")
- `--dry` gate report clean
- scratch-PG load of the emitted SQL succeeds end-to-end
- `npm run typecheck` and `npm run test` still green (you touched no src/, so
  this is a canary — if they broke, you left the lane)
- after apply: `bash scripts/smoke.sh` → ALL CHECKS PASSED; pack previews return
  only on-theme rows

---

## Lane 2 — METHODOLOGY: algorithms, filters, scoring, catalog

Lane 2 covers: `scripts/lib/psychometrics.js` (trait derivations),
`src/modules/recipes/resolver.ts` (query semantics), `src/modules/eval/scoring.ts`
(battery scoring), hooks, generator prompt/schema changes, new sellable entities,
pricing, payments.

Rules:
1. **New sellable product = rows, not routes.** A generator + recipe + product
   migration (pattern: `0013_robinhood_counterparty_pack.sql`). Only put keys in
   `allow_request_filters` that `resolver.ts` already implements; if the filter
   doesn't exist yet, the resolver change is part of this Lane 2 change and needs
   unit tests (see the perp-pack plan in `docs/ROADMAP_ENRICHMENT.md` §1).
2. **New entity type** = a new `case` in `resolveQuery` + tests + a recipe row.
3. **Never in-place semantics changes.** Generators are versioned
   (`UNIQUE(slug, version)`) — bump `version`, don't rewrite v1. Same for
   `eval_batteries` (content-addressed via `content_sha256`).
4. **Gates:** `npm run typecheck`, `npm run test` (38+ tests must stay green),
   `bash scripts/smoke.sh` post-deploy, and for anything touching the paid path
   (`proxy.ts`, `payment-verify.ts`, `facilitator.ts`, `resolver.ts`) a real
   `npm run buyer-test` before calling it shipped.
5. **Security invariants** (from the DB audit): RLS ON for every new table;
   paid tables never publicly readable; no service-role key or private key ever
   leaves `.env` local.

---

## Migration numbering
Sequential `00NN_`; **0019 is intentionally skipped** — do not "fix" it. Data
migrations must be INSERT/UPSERT-only; schema migrations state their lane in the
header comment.

## Quick self-audit before you finish (either lane)
- Did I touch any file outside my lane's allowlist?
- Can my SQL be re-applied without error or duplication?
- Does the same seed reproduce my batch byte-for-byte?
- Did smoke.sh pass against the deployed surface?
