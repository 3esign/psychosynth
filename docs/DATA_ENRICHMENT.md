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
node scripts/generate-profiles.js --count 150 --seed batch-01

#    (curate them in the Lab: /lab/review — A/R/E/J/K. Only approved
#     profiles are sold by personality-profile-library.)

# 2) Scenarios + scenario<->bias links + expanded emotional patterns.
node scripts/generate-scenarios.js --count 120 --seed batch-01

# 3) Responses: how profiles behave in scenarios (needs 1 & 2 loaded).
#    Defaults to APPROVED profiles — run after curating step 1.
node scripts/generate-responses.js --status approved --per 3 --max 400
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
