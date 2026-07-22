# Data state & enrichment plan — 2026-07-22 (post-registry go-live)

Companion to `ANALYSIS_AND_DATA_PROPOSAL_2026-07-22.md` (safety analysis + the
Bankr-first proposal) and `ROADMAP_ENRICHMENT.md`. This file records **what is
actually generated vs applied right now**, the canonical apply path, and the
next enrichment directions once the backlog lands.

---

## 1. Current state — generated vs applied

Verified against the live API (2026-07-22): the solana-trading-pack preview
still serves `batch-solana-retry-*` personas and `/api/v1/discovery` lists only
the two Robinhood batteries → **none of the backlog below has reached
production.** (Bias examples/mitigations ARE live → 0021 is applied.)

| artifact | contents | status |
|---|---|---|
| `supabase/migrations/0021_bias_examples_mitigations.sql` | bias examples + mitigations | ✅ applied (live) |
| `supabase/migrations/0022_crypto_native_biases.sql` | 6 crypto-native biases (unit bias, ATH anchoring, …) | ⬜ **pending** |
| `supabase/migrations/0023_a2a_commerce_battery.sql` | a2a commerce battery ($2) + its 6 scenarios | ⬜ **pending** |
| `outputs/enrich-v4/` | 4,000 profiles · 80 scenarios · 4,000 responses + **05_repair_v3** (deletes polluted batch-* rows; guarded) | ⬜ **pending — apply FIRST** |
| `outputs/doppler-a2a-v1/` | 1,300 profiles (900 Doppler + 400 a2a) · 72 scenarios · 2,280 responses | ⬜ pending |
| `outputs/enrich-a2a-commerce/` | 1,000 profiles · 48 scenarios · 3,000 responses (skill-pricing, retry-etiquette, sla-dispute) | ⬜ pending |
| `outputs/enrich-launch-day/` | 1,000 profiles · 24 scenarios · 3,000 responses (sniper, bundle, launch-day) | ⬜ pending |
| `outputs/enrich-social-cascades/` | 1,000 profiles · 24 scenarios · 3,000 responses (copy-trading, farcaster cascades) | ⬜ pending |

Post-apply the paid library grows by **~8,300 approved profiles, ~250
scenarios, ~15,300 conditioned responses, 6 biases, and a third eval battery**
— all of it already generated, quality-gated, and idempotent.

Superseded artifacts (do **not** apply): `outputs/v4/` (pre-final cut of
enrich-v4), `outputs/APPLY_IN_SUPABASE.sql` + `outputs/FINALIZE.sql` (already
live: the behavioral-response-library product exists and the Robinhood pack is
narrowed), and everything flagged in `scratch/README.md` — notably
`scratch/load-data-batches.mjs`, which regenerates "v4" from a **different
seed** than the committed batch and must never run against production.

## 2. Canonical apply path (one command)

```bash
DATABASE_URL='postgresql://…' bash scripts/apply-data.sh   # then: bash scripts/smoke.sh
```

The script encodes the only safe order (vocabulary migrations → enrich-v4 →
guarded 05_repair_v3 → remaining batches), refuses to continue on any error,
and ends with count assertions incl. `batch-* == 0`. `smoke.sh`'s
`tag-hygiene/*` checks then prove it from the buyer-facing surface.

---

## 3. Enrichment directions (after the backlog lands)

Proposal items 1, 2, 4, 5, 6 from `ANALYSIS_AND_DATA_PROPOSAL_2026-07-22.md`
are **already generated** (the batches/migrations above). What follows is what
that plan leaves open, ordered by (new offering surface × effort), each tagged
with its `DATA_CONTRIBUTION.md` lane.

### 3.1 Productize the new segments as catalog rows — offerings without new data (catalog rows only)
The applied batches carry pinned tags that no product currently sells as a
dedicated pack. Per "new behavior = new row", each is just a recipe + product
INSERT (0013-style migration), zero resolver code:
- **`a2a-commerce-pack`** (pins `a2a-commerce`) — counterparty priors for agent
  service commerce; the most Bankr-native offering and cross-sells with the
  0023 battery ("buy the priors, then certify against them").
- **`token-launch-pack`** (pins `launch-day` + `doppler`) — the "simulate
  retail against your bonding-curve parameters" workflow the Bankr skill
  already advertises, as its own SKU instead of a robinhood-pack subset.
- **`social-cascade-pack`** (pins `social-cascade`, `copy-trading`).
Pricing: mirror robinhood tiers (base + pack-100 + pack-1k). Micro-priced
x402 entry tiers ($0.50 starter samples) suit agent impulse purchases.

### 3.2 Perp-psychology pack — the one remaining NEW data surface (Lane 2 + Lane 1)
Roadmap #1, unchanged and still the biggest new revenue surface
(Avantis/Hyperliquid sims): `leverage_profile` content vector, perp archetypes,
liquidation-cascade scenarios, ~15-line resolver filter addition with unit
coverage. Sequence LAST of the majors, behind a green smoke run, because it
touches the paid path.

### 3.3 Variation axes inside existing segments — depth, not breadth (Lane 1)
Same archetypes, systematically varied so buyers get distributions, not
stereotypes. Each axis is a tag vocabulary + generator variation in
`scripts/lib/*`, no schema change:
- **Market regime**: the same persona answering the same scenario in
  bull / bear / chop (`regime:bull` …). Regime-conditioned responses roughly
  triple `behavioral-response-library` depth and let sims flip regimes.
- **Experience cohort**: first-cycle newcomer ↔ multi-cycle veteran
  (`cycles:1|2|3+`) — modulates bias susceptibility coherently (veterans:
  lower FOMO, higher status-quo).
- **Time horizon**: scalper ↔ swing ↔ position (`horizon:*`) — orthogonal to
  archetype, meaningful for order-flow sims.
- **Capitalization**: shrimp / mid / whale already partially tagged — make it a
  first-class axis with coherent λ scaling.

### 3.4 Correlated cohorts — sell crowds, not individuals (Lane 1, high sim value)
Real launch-day crowds are correlated (followers copy leaders; panic cascades).
Emit **cohort batches**: 50–200 personas sharing a `cohort:<slug>` tag plus
intra-cohort structure (leader/follower links in `content.cohort`, correlated
trait draws). A buyer simulating a launch buys one coherent crowd instead of
i.i.d. samples — a capability none of the generic-data competitors position
for. Rides existing packs via tags; optionally later its own `crowd-pack` SKU.

### 3.5 Agent-native failure-mode taxonomy — biases OF agents (Lane 1, vocabulary-first)
The bias set models human cognition; buyers are increasingly stress-testing
**LLM agents**, whose documented failure modes differ: tool-output overtrust,
context-recency capture, sycophantic goal drift, prompt-injection gullibility,
retry-storm escalation, sunk-context fallacy. ~8 entries in the 0022 style
(INSERT-only migration first, then scenarios exercising them). Enriches the
bias simulator AND gives the 0023 battery a v2 scoring dimension nobody else
sells.

### 3.6 Second-order offerings on existing rails (catalog rows / Lane 1)
- **Rotating battery versions** for the a2a battery (the rails exist —
  `robinhood-stress-battery-rotating` proves the pattern) to resist
  memorization.
- **`perp-stress-battery`** once 3.2 lands ($2, same rails).
- **Refresh drops**: a dated quarterly batch per pack (`drop:2026-q3` tag) so
  repeat buyers have a reason to return; markets it as "living dataset".

### Sequencing

1. Apply the backlog (§2) + `smoke.sh` — everything else builds on it.
2. §3.1 catalog rows — new SKUs from applied data, migration-only, days not weeks.
3. §3.3 regime + experience axes — biggest content-richness win per effort.
4. §3.5 agent-bias taxonomy (vocabulary first), then its scenarios.
5. §3.4 correlated cohorts.
6. §3.2 perp pack (the lone Lane-2 change) + §3.6 batteries.

Every batch lands the v4 way: authored → gates → `outputs/<batch>/*.sql` →
scratch-PG load-test → `scripts/apply-data.sh` → `scripts/smoke.sh`.
