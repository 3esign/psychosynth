# Psychosynth — data-addition safety analysis & high-value data proposal
*2026-07-22*

## Part 1 — Can any agent safely "just add data" today?

**Verdict: the architecture already supports it; the instructions didn't.** Now fixed.

### What was already right (don't touch)

The system genuinely separates data from methodology at the architecture level:

- **"New behavior = new row, not new code path"** — the resolver dispatches on
  `recipe.entity`; themed packs are `tags_include` pins in recipe rows, so new
  personas join a pack purely by carrying the right tags. Adding on-theme data
  can't change query semantics.
- **The v4 pipeline is the right shape for agent contributions**:
  `enrich-dataset.mjs` is seeded (reproducible), refuses to emit SQL unless
  quality gates pass (≥0.98 distinct summaries, no tag pollution, zero schema
  violations, posture separation), and outputs reviewable ordered SQL instead of
  writing to the DB directly. A misbehaving agent produces a rejected batch, not
  a broken production system.
- **Server-enforced hard filters** (post-audit C3 fix) mean buyer filters and new
  data can't leak across packs.
- **Curation lifecycle** (`pending` → review → `approved`) is a second safety net:
  the paid library only serves approved rows.
- **Versioned generators and content-addressed eval batteries** mean methodology
  changes are additive by design (bump version, never rewrite).

### The gaps that made it unsafe for "any model or agent" (and the fixes)

1. **No contract at the agent entry point.** `CLAUDE.md` was 11 bytes pointing at
   an `AGENTS.md` that only contained a Next.js warning. The actual rules lived
   scattered across `DATA_ENRICHMENT.md`, `ROADMAP_ENRICHMENT.md`, `GO_LIVE.md`,
   and an *archived* audit. An arbitrary agent told to "add data" had no way to
   know that `resolver.ts` or `psychometrics.js` were off-limits.
   → **Fixed: new `docs/DATA_CONTRIBUTION.md`** — a two-lane contract with a
   one-question decision tree ("does this change how any existing record is
   generated, filtered, priced, scored, or paid for?"), an explicit file
   allowlist/denylist per lane, the Lane-1 procedure, invariants (seeded,
   idempotent, closed bias-slug set, tag pins, provenance), and per-lane gates.
   → **Fixed: `AGENTS.md` rewritten** to route both prompts ("add data" → Lane 1,
   "play with methodology" → Lane 2) to that contract. Since `CLAUDE.md` is
   `@AGENTS.md`, Claude-family agents inherit it automatically.

2. **Implicit closed vocabularies.** Bias slugs, decision styles, tag pins, and
   scenario categories are closed sets enforced only by convention between
   `seed.sql`/migrations and `scripts/lib/*`. An agent inventing a new bias slug
   would produce orphan `suggested_biases`. The contract now states the rule
   (new vocabulary entry = its own INSERT-only migration *first*).

3. **Trap spots now signposted**: migration `0019` is intentionally skipped (an
   eager agent would "fix" the gap); `populate-v3-dataset.ts` is superseded by
   v4 but still sits in `scripts/` looking runnable; `allow_request_filters`
   keys silently no-op unless `resolver.ts` implements them (so a data-side
   agent adding a filter key would *think* it shipped a feature). All three are
   called out in the contract.

### Recommended next hardening (small, optional)

- Move `populate-v3-dataset.ts` (and the other superseded generate-* scripts if
  v4 fully covers them) into `scripts/legacy/` so the happy path is the only
  visible path.
- Add a `npm run data:dry` / `data:build` alias so the Lane-1 procedure is one
  canonical command.
- A tiny CI check (or pre-publish gate in `publish.sh`): fail if a change set
  touches both `src/**` and `outputs/**` — mechanical enforcement of the
  two-lane rule.

---

## Part 2 — High-value data to populate next (Bankr-first)

Everything below is **Lane 1 or catalog-row work** unless flagged. Ordered by
(revenue surface × Bankr relevance × effort).

### 1. Bankr a2a service-commerce pack — *the most Bankr-native gap* (Lane 1)
v4 shipped 400 a2a agents + 48 negotiation scenarios, but the a2a data models
generic negotiation. What Bankr's ecosystem actually trades on is **x402
service commerce between agents**: skill pricing, reliability priors, SLA
behavior. Populate:
- **Archetypes**: skill-seller price-gouger, reputation-farming undercutter,
  retry-storm client, SLA-lawyer agent, free-preview freeloader, volume-discount
  negotiator, facilitator-outage opportunist.
- **Scenarios**: quote-shopping across three sellers, 402-loop retry etiquette,
  reliability-score dispute after a failed settlement, price renegotiation after
  a facilitator fee change, preview-vs-paid quality mismatch complaint.
- **Why it sells**: any agent building on x402 (the entire Bankr skills catalog)
  can buy counterparty priors for *its own commerce layer* — this is data only
  Psychosynth positions for. It also dogfoods your own market.

### 2. Launch-day / bonding-curve microstructure personas (Lane 1)
Doppler exit-psychology shipped; the missing high-value slice is the **launch-day
cast** every Base/Doppler/Clanker token deployment faces: sniper-bundler,
first-block sniper, dev-watcher (sells on dev wallet movement), LP-puller
paranoiac, migration-arb bot-adjacent human, "graduated too fast" skeptic,
airdrop-farmer mercenary. Tag them into the existing Robinhood/Doppler pins so
the pack deepens with zero catalog work. This directly upgrades the
"simulate retail against your bonding-curve parameters before launch" workflow
your Bankr skill already advertises.

### 3. Perp-psychology pack (Lane 2 + Lane 1 — already roadmapped, do after 1–2)
The roadmap's #1 (`leverage_profile` vector, ~15-line resolver addition, new
pack). Biggest *new* revenue surface (Avantis/Hyperliquid sims) but the only
proposal touching the paid path — sequence it behind the pure-data wins and give
the resolver change unit coverage per the contract's Lane 2 gates.

### 4. Social/copy-trading cascade data (Lane 1)
Bankr lives where Farcaster/X sentiment meets execution. Populate herd-cascade
scenarios (influencer flip, engagement-bait pump thread, copy-trade drawdown
with visible leader) and follower-typology personas (blind copier, inverse-
copier contrarian, exit-front-runner). Pairs perfectly with the already-seeded
herd/bandwagon/authority biases, which currently have thin scenario coverage.

### 5. A second eval battery: "a2a commerce battery" (catalog rows, no code)
`eval_batteries` is data — a new battery is an INSERT (scenario slugs + rubric +
price). Ship an **agent-negotiation stress battery** (overpayment resistance,
retry discipline, SLA-breach response, quote-shopping rationality) at ~$2.
Bankr agents certifying *themselves* before selling skills is a natural loop,
and it reuses the existing scored-eval rails from the Robinhood battery.

### 6. Bias vocabulary expansion — crypto-native set (Lane 1, vocabulary-first rule)
The 20 seeded biases are classic literature. Add ~6 crypto-native entries with
examples/mitigations in the 0021 style: unit bias ("cheap coin" illusion),
airdrop entitlement, diamond-hands identity bias, ATH anchoring, rug-trauma
overcorrection, gas-cost sunk-cost. These immediately enrich the
cognitive-bias-simulator product *and* give generators a wider justified-bias
palette for packs 1–4.

### Sequencing
1 → 2 (pure data, immediate catalog depth, Bankr-native) → 6 (unlocks better
conditioning) → 5 (new paid surface, zero code) → 4 → 3 (the one methodology
change, behind green smoke + tests).

Each batch lands the v4 way: authored → `--dry` gates → `outputs/<batch>/*.sql`
→ scratch-PG load → apply → `smoke.sh`.
