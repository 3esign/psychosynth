# Data Enrichment — authored synthesis pipeline

Scripts that populate the system with large volumes of coherent synthetic data
**without an LLM API key**. All content is authored by the offline synthesis
engine (`scripts/lib/synth.js`, `scripts/lib/behavior.js`): component banks +
coherence logic + a seeded PRNG. This is the same "author + insert directly"
pattern as `scripts/populate-edge-cases.js`, generalized and scaled.

Every generated item is:
- **schema-valid** against the generator's own `output_schema`;
- **internally coherent** — summaries/responses are derived from the actual
  Big Five vector, decision style, and top bias (avoids `incoherent_traits` /
  `bias_mismatch` curator rejections);
- **de-duplicated** — a trigram guard keeps summaries lexically distinct
  (proxy for the `pg_trgm` dedup hook; avoids `generic_content` / near-dupes);
- **provenance-stamped** — a `provenance` row per item, `model =
  authored/psychosynth-synth-v1`.

## Prerequisites

1. `.env` must have `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
   (already present). Scripts parse `.env` directly — no `dotenv` needed.
2. Migrations `0001`–`0007` applied (profiles, generators, scenarios,
   responses, emotional_patterns, bias links).
3. Run from the repo root: `node scripts/<name>.js`.

Every script supports `--dry` (synthesize + validate, **no DB writes**) so you
can preview output before committing it.

## Run order

```bash
# 1) Profiles -> curation queue (status=pending). Flagship library.
node scripts/legacy/generate-profiles.js --count 150 --seed batch-01

#    (curate them in the Lab: /lab/review — A/R/E/J/K. Only approved
#     profiles are sold by personality-profile-library.)

# 2) Scenarios + scenario<->bias links + expanded emotional patterns.
node scripts/legacy/generate-scenarios.js --count 120 --seed batch-01

# 3) Responses: how profiles behave in scenarios (needs 1 & 2 loaded).
#    Defaults to APPROVED profiles — run after curating step 1.
node scripts/legacy/generate-responses.js --status approved --per 3 --max 400
```

## Scripts

### `generate-profiles.js`
Big Five profiles across all 5 domains (general/trading/negotiation/social/
workplace), with domain skews and tail cases. Inserts as `pending` by default
(`--status approved` to go live immediately). Writes `profiles`,
`profile_bias_links`, `provenance`, and one `generation_runs` row.

Flags: `--count N` (default 120), `--seed S`, `--status pending|approved`, `--dry`.

### `generate-scenarios.js`
Scenarios in 4 categories (trading/negotiation/social/crisis), each with
`scenario_bias_applications` links, plus upserts the emotional_patterns set
(16 total). Scenarios are reference data (no curation status) and are inserted
idempotently by `slug`.

Flags: `--count N` (default 120), `--seed S`, `--dry`.

### `generate-responses.js`
For each profile, pairs `--per` scenarios (soft-weighted toward the profile's
domain) and composes `response`, `reasoning_chain`, `emotional_arc`, and
`confidence`. Writes `profile_scenario_responses` + `provenance`, under one
`generation_runs` row.

Flags: `--status approved|pending|all` (default approved), `--per N` (default 3),
`--max N` (default 400), `--seed S`, `--dry`.

## Coherence & derivation rules (mirror `big-five-profile-gen`)

- **MBTI** derived from Big Five: E/I←extraversion, N/S←openness,
  T/F←agreeableness, J/P←conscientiousness (cosmetic label only).
- **big_five** ~ N(0.5, 0.15) per trait, clamped [0.03, 0.97], with optional
  domain/skew mean shifts.
- **decision_style** inferred from centered trait deviations (balanced across
  all six styles).
- **suggested_biases**: 2–4 of the 20 seeded biases, strengths justified by the
  trait vector (`biasAffinities`).

## Reproducibility

Everything is seeded. The same `--seed` produces the same batch. Use a fresh
seed per batch to avoid regenerating identical content.

## Verification (offline, no DB)

`--dry` on each script validates output against the real schemas. A full check
(300 profiles / 120 scenarios / 80 responses) confirmed: 0 schema violations,
0 MBTI-rule violations, 0 unknown bias slugs, balanced trait means (~0.5) and
decision-style distribution, and 14+ distinct emotional patterns exercised.

---

## v4 — bulk enrichment orchestrator (`scripts/enrich-dataset.mjs`)

The v4 pipeline scales the authored engine into a single reproducible batch and
emits **SQL files** (not client inserts) so data reaches the DB reviewably. It
supersedes `populate-v3-dataset.ts`, whose output had three defects it fixes:

| v3 defect | v4 fix |
|---|---|
| near-identical summaries (one template per archetype, only numbers differ) | `synth.buildSummary` — combinatorial, 100% distinct, no `$\lambda$` LaTeX |
| unconditioned BUY/SELL responses (`actions[i % 6]`) | `behavior.buildResponse` — action derived from trait posture + top bias + scenario |
| `batch-<name>-<i>` tag pollution | clean kebab-case tags with the pack pins, no batch tags |
| Dark-Triad / prospect-theory from uniform noise | `lib/psychometrics.js` — derived coherently from Big Five + biases, archetype-anchored |

New modules:

- **`scripts/lib/psychometrics.js`** — derives `dark_triad`, `prospect_theory`
  (λ/α/β) and `cognitive_reflection` from the Big Five vector + chosen biases,
  with optional per-archetype anchors; `buildFullProfile()` assembles the row.
- **`scripts/lib/archetypes.js`** — 44 archetypes (22 legacy solana/retail/whale
  + 22 fresh: Base-native degens, Doppler bonding-curve whale-vs-retail, a2a/x402
  counterparty negotiators, extra Robinhood retail sub-segments). Tag pins match
  the live recipes (`chain:solana`, `robinhood`+`retail-trading`).
- **`scripts/lib/synth.js`** — content banks widened additively (same exports).

Run:

```bash
node scripts/enrich-dataset.mjs --dry                    # quality gates, no writes
node scripts/enrich-dataset.mjs --profiles 4000 --responses 4000 --seed <seed>
# -> outputs/enrich-v4/{00..05}.sql + APPLY_ALL.sql + REPORT.json  (see that folder's README)
```

The orchestrator refuses to write SQL unless quality gates pass (distinct
summary ratio ≥ 0.98, zero batch/malformed tags, zero schema violations, and
posture buckets demonstrably separated by neuroticism). The 4,000/4,000 batch
was loaded into a scratch PostgreSQL 16 against the real schema to confirm every
FK, jsonb cast and `ON CONFLICT` clause is valid before shipping.
