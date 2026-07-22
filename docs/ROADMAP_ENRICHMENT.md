# Psychosynth — enrichment roadmap (post-v4)

Detailed build plan for the four directions discussed. Each "data batch" reuses
the v4 pipeline (`scripts/enrich-dataset.mjs` + `scripts/lib/*`): generate →
quality-gate → load-test into scratch PostgreSQL → commit ordered SQL. "Schema
change" means a new `supabase/migrations/00NN_*.sql`.

Status legend: ✅ done · 🟡 partially in place · ⬜ not started.

---

## 1. Perp-psychology pack (leverage sensitivity) ⬜

**Goal.** A new sellable pack modeling how traders react to *leverage* —
funding-rate spikes, liquidation proximity, forced deleveraging — for
Avantis / Hyperliquid / perps simulations.

**Design.**
- New content vector `leverage_profile` in each profile's `content`:
  `{ funding_sensitivity, liquidation_anxiety, max_leverage_comfort,
  deleveraging_style }`, derived coherently in `scripts/lib/psychometrics.js`
  (`deriveLeverageProfile`) from the Big Five + prospect-theory (liquidation
  anxiety ← neuroticism + λ; max-leverage comfort ← risk posture; deleveraging
  discipline ← conscientiousness).
- New archetypes in `scripts/lib/archetypes.js` tagged `perp-trading` +
  `leverage-sensitive`: perp-scalper, funding-rate farmer, liquidation hunter,
  over-leveraged degen (100x), delta-neutral perp MM, cascade-liquidation
  victim, cross-margin over-extender.
- New perp scenarios in `scripts/lib/behavior.js` (category `trading`): funding
  flip, maintenance-margin call, liquidation cascade, basis blowout.

**Schema change.** `0024_perp_psychology_pack.sql`: `perp-psychology-gen`
generator, a recipe pinned to `tags_include:['perp-trading']`, and the
`perp-psychology-pack` product (pack tiers). Add leverage filters to the
recipe's `allow_request_filters` (`funding_sensitivity_min/max`,
`liquidation_anxiety_min/max`) **and** a matching block in
`src/modules/recipes/resolver.ts` (mirrors the existing Dark-Triad /
prospect-theory `content->…` filter loops — ~15 lines).

**Data batch.** ~1,500–2,000 perp personas (tagged `perp-trading`) + perp
scenarios + conditioned responses, emitted as `outputs/perp-v1/*.sql`.

**Verify.** Local PG load; pack filter resolves to only perp-tagged rows; new
leverage filters queryable; quality gates (distinct summaries, conditioning).

**Effort:** M–L. **Risk:** medium — touches the paid `resolver.ts` path, so the
resolver filter addition needs its own unit coverage before deploy.

---

## 2. Deepen Doppler + agent-to-agent (a2a) ✅ shipped (doppler-a2a-v1)

Doppler and x402/a2a archetypes already shipped in v4; this deepened both. **No
schema change, no resolver change — pure data batch.** Delivered:
`scripts/enrich-doppler-a2a.mjs` + `outputs/doppler-a2a-v1/*` — 900 Doppler
exit-psychology personas (451 feed the Robinhood pack) + 400 a2a agents + 48 a2a
negotiation scenarios + 24 Doppler trading scenarios + 2,280 conditioned
responses. Load-tested into PostgreSQL alongside v4.

**2a. Doppler v4 bonding-curve "exit psychology".** New archetypes tagged
`robinhood`+`retail-trading`+`doppler` (ride the existing robinhood pack):
curve-exit panic-seller, migration-day holder, multicurve rotator, post-graduation
dumper. Model the specific moment of bonding-curve → DEX migration.

**2b. a2a x402 negotiation scenarios.** New scenarios in `behavior.js` for
agent-to-agent commerce: reliability-score dispute, volume-discount haggling,
SLA-breach renegotiation, price-oracle disagreement. Generate responses via the
existing conditioned engine; they land in `behavioral-response-library` (filter
by the new `scenario_slug`s / category).

**Data batch.** `outputs/doppler-a2a-v1/*.sql` — supplemental profiles +
scenarios + responses.

**Verify.** Local PG load; category/scenario_slug filters; quality gates.

**Effort:** S–M. **Risk:** low (additive data only).

---

## 3. Catalog consistency + post-deploy smoke test 🟡

**Catalog:** ✅ verified consistent this turn — `/api/v1/products` and
`/api/v1/discovery` both query `products WHERE status='live'`; both return all 5
slugs. The earlier "3 vs 5" was a fetch-summarizer truncation, **not** a backend
bug. No code change.

**Smoke test (✅ shipped).** `scripts/smoke.sh` hits `/discovery`, `/products`,
all 5 `/preview/{slug}`, and `/eval/{battery}`; asserts HTTP 200, `count>0`, and
that the bias preview returns populated `examples`/`mitigations`. Wired into
`PUBLISH.md` + `GO_LIVE.md` as the post-deploy gate. Read-only.

**Effort:** S. **Risk:** none.

---

## 4. Runner / script hardening 🟡→✅

- ✅ **Done this turn:** a `curl`/`jq` preflight in all 7 skill scripts — a
  missing/mismatched binary now prints an install-guided message and exits 127
  instead of failing cryptically. Kills the `node-jq` class of failures (the
  scripts use the `jq` **CLI**, never the npm package).
- ⬜ **Optional next:** a pure-Node fallback (`workflows/psychosynth.mjs`) that
  reproduces the 4 workflows with zero external binaries, for runners that
  genuinely cannot provide `jq`. Plus a one-line note in `SKILL.md` restating
  the `requires.bins: [curl, jq]` contract.

**Effort:** S (note) / M (node fallback). **Risk:** low.

---

## Suggested sequencing

1. **#3 smoke test** — cheap, makes every subsequent deploy verifiable. (S)
2. **#2 Doppler + a2a** — additive data, no schema risk, immediate catalog depth. (S–M)
3. **#1 perp pack** — the biggest new revenue surface; do after #3 so the
   resolver change ships behind a green smoke test. (M–L)
4. **#4 node fallback** — only if a target runner can't provide `jq`. (M)

Each lands the same way as v4: verified SQL under `outputs/`, applied via the
`PUBLISH.md` DB steps, deployed by `scripts/publish.sh`.
