# PSYCHOSYNTH — Master Plan (Final Synthesis)

**Verified behavioral infrastructure for the agent economy.** Synthetic psychological data, generated and curated in an internal Lab, composed into products by recipes, sold to autonomous agents over x402, with cryptographic provenance as the moat.

This document supersedes Idea1–5 and Concepts.md. It locks every open pivot, merges the best of all five designs into one architecture, and lays out seven compounding phases where Phase 1 is a real, shippable MVP. One addition not fully specified in any prior idea is treated as first-class here: the **Generator OS** — the requirement that generators themselves are created, changed, versioned, and operated inside the dashboard, with hooks and automatic pipelines.

---

## 1. What each idea contributes — and what is cut

| Source | Adopted | Cut |
|---|---|---|
| **Idea 1 (FACES MVP)** | Agent Playground demo, SDK, LLM-as-judge consistency checks | MBTI as real trait model; dashboard-before-revenue |
| **Idea 2 (Pragmatic)** | Sequencing discipline, A→B→C product ladder, Base-first x402, pack-vs-micro pricing test, exit criteria per phase, misuse ToS | Deferring the Lab entirely to Phase 4 (conflicts with generator-driven workflow) |
| **Idea 3 (Commercial GTM)**| Full GTM playbook, metrics table, agent analytics, custom curation requests, premium tiers | $PSYCH token, dynamic surge pricing, cross-chain bridges, Robinhood MCP |
| **Idea 4 (Intelligence OS)**| Knowledge-graph *mental model*, 5-layer conceptual stack, "products are views", world-class design principles | Graph database implementation (relational + junctions delivers the same queries at far lower complexity) |
| **Idea 5 (Verified Infra)** | Provenance-first schema, deterministic seeds, recipes table, distribution validators, MCP discovery, public Lab funnel, arXiv/academic moat | Nothing major — this is the backbone |

**Permanently cut:** Robinhood (wrong layer — serves a user's own agent, not buyers of your data). Tokenization/$PSYCH (revisit only after product-market fit; adds regulatory and complexity risk with no near-term buyer benefit). True graph DB. MBTI as source of truth (kept only as a cosmetic, searchable label). **Naming trap, flagged permanently:** Virtuals' Agent Commerce Protocol (Base, agent-to-agent escrow — used in Phase 6) ≠ Stripe/OpenAI's Agentic Commerce Protocol (ChatGPT human checkout — irrelevant here).

---

## 2. Locked decisions (the five pivots)

1.  **Trait model — Big Five (OCEAN) canonical, MBTI cosmetic.** Every profile is backed by Big Five scores generated against academic instruments (IPIP-NEO framing; Kahneman/Tversky sources for biases). `mbti_label` exists so agents searching "INTJ" still find you, but it is derived, never authoritative. This keeps academic credibility (Phases 5–7 depend on it) without losing developer searchability.
2.  **Database — relational Postgres + JSONB + recipe engine.** The knowledge graph is the *conceptual* model; junction tables are its implementation. Products are never tables — they are `recipe` rows resolved by one service layer. Adding product #10 is a config change.
3.  **Trust — provenance from day one, on-chain later.** Recording prompt hash, model, seed, and content SHA-256 per entity costs one table and ten lines of code in Phase 1. Publishing hashes to a Solana registry, signed reviews, and validator attestations come in Phase 5 when there is something worth verifying publicly. This ordering means nothing is ever regenerated retroactively — Phase 1 data is already Phase 5-verifiable.
4.  **Payments/chain — x402 on Base first, Solana mirror second, ACP for bespoke deals.** Base carries the bulk of real x402 volume and Coinbase's facilitator tier is free at MVP scale. Solana mirror lands in Phase 5 (its agent ecosystem is the discovery prize, addressed via Solana Agent Kit in Phase 4 regardless of payment rail). Offer packs alongside per-query pricing from day one — observed x402 volume skews to fewer, larger payments.
5.  **Generator OS — generators are data, not code.** Every generator is a row: prompt template + parameter schema + output schema + hook chain. You can vibe-code a new generator form in the dashboard, change methodology, or run batches without touching backend code. Every run is logged; every entity traces to its run; runs *are* provenance. Dashboards are thin clients over the same API agents use — so you can build, replace, or multiply dashboards freely without migrating anything.

---

## 3. System architecture

```
                        AI Models (any provider, structured JSON output)
                                        │
                              GENERATOR OS  ← generators, runs, hooks
                                        │
                     Validation pipeline (hooks: schema → dedup → judge → distribution)
                                        │
                        KNOWLEDGE BASE (Postgres + JSONB + junctions)
                        entities · relations · provenance · versions
                                        │
                 ┌──────────────────────┼──────────────────────┐
                 ▼                      ▼                      ▼
          Dashboard Lab(s)        Recipe Engine           Dataset snapshots
          (thin clients over      (products = config)     (immutable, pinned)
           the same API)                │
                                        ▼
                                 COMMERCE LAYER
                    x402 (Base → +Solana) · packs · previews · receipts
                                        │
                 ┌──────────────────────┼──────────────────────┐
                 ▼                      ▼                      ▼
           Agent APIs            MCP server /              Custom bundles
           (per-query)           Agent Kit / Eliza         (Virtuals ACP escrow)
```

Five conceptual layers (from Idea 4), implemented relationally: **L1 primitives** (profiles, traits, biases, emotional patterns, decision styles) → **L2 behavior** (scenarios, responses) → **L3 reasoning** (reasoning chains, emotional arcs on responses) → **L4 simulation** (multi-profile compositions — Phase 6) → **L5 products** (recipes referencing L1–L4).

---

## 4. Consolidated data model

Full inventory — Phase number marks when each table lands. Nothing later requires altering anything earlier.

| Table | Phase | Purpose |
|---|---|---|
| `profiles` | 1 | Big Five JSONB, cosmetic `mbti_label`, decision style, tags, status |
| `biases` | 1 | Reference set (Loss Aversion, FOMO, …) with examples + mitigations |
| `profile_bias_links` | 1 | Junction with strength/weight |
| `provenance` | 1 | model, prompt_hash, seed, sha256, signature, attestations — per entity |
| `generators` | 1 | **Generator OS**: prompt template, schemas, hook chain, version, status |
| `generation_runs` | 1 | **Generator OS**: every batch — params, seed, cost, counts, status |
| `curation_queue` | 1 | Pending items with quality scores + reviewer notes |
| `products` | 1 | slug, recipe_id, price_model JSONB, status |
| `x402_payments` | 1 | payment hash, buyer wallet, product, amount, status |
| `scenarios` | 2 | Situations by category (trading, negotiation, social, crisis) |
| `profile_scenario_responses` | 2 | response, reasoning chain, emotional arc, confidence |
| `scenario_bias_applications` | 2 | Junction: which biases a scenario activates |
| `emotional_patterns` | 2 | trigger → response patterns, intensity levels |
| `decision_styles` | 2 | Reference table |
| `recipes` | 2 | Query-rule JSON DSL + composition rules |
| `versions_changelog` | 2 | Methodology change history per entity |
| `datasets` / `dataset_items` | 3 | **Generator OS**: named immutable snapshots products can pin |
| `reviews`, `attestations` (on-chain refs) | 5 | Signed buyer reviews, validator signatures, registry tx refs |

Core entity DDL is already drafted in Idea 5. The **new** Generator OS tables are specified below:

```sql
-- A generator is data. New generator = new row. New methodology = new version.
CREATE TABLE generators (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT UNIQUE NOT NULL,        -- 'big-five-profile-gen'
  version         INT NOT NULL DEFAULT 1,
  entity_type     TEXT NOT NULL,               -- 'profile' | 'scenario' | 'response' | ...
  description     TEXT,
  prompt_template TEXT NOT NULL,               -- with {{placeholders}}
  params_schema   JSONB NOT NULL,              -- JSON Schema → dashboard auto-renders the form
  output_schema   JSONB NOT NULL,              -- JSON Schema the model output must satisfy
  model_config    JSONB NOT NULL,              -- {provider, model, temperature, seed_strategy}
  hooks           JSONB NOT NULL DEFAULT '[]', -- ordered hook chain, see §5
  status          TEXT NOT NULL DEFAULT 'active',  -- active | deprecated | draft
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every execution is logged. Runs ARE provenance.
CREATE TABLE generation_runs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generator_id   UUID NOT NULL REFERENCES generators(id),
  generator_ver  INT NOT NULL,
  params         JSONB NOT NULL,               -- the filled form values
  seed           INT,                          -- deterministic reproducibility
  model_used     TEXT NOT NULL,
  items_created  INT DEFAULT 0,
  items_approved INT DEFAULT 0,
  cost_usd       NUMERIC(10,4),
  hook_results   JSONB DEFAULT '[]',           -- per-hook pass/fail + scores
  status         TEXT NOT NULL DEFAULT 'running', -- running | done | failed
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Named immutable snapshots: "trading-profiles-v3, 500 items, frozen".
CREATE TABLE datasets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT UNIQUE NOT NULL,
  version      INT NOT NULL DEFAULT 1,
  entity_type  TEXT NOT NULL,
  sha256_hash  TEXT,                           -- hash of ordered member content
  frozen_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE dataset_items (
  dataset_id  UUID REFERENCES datasets(id) ON DELETE CASCADE,
  entity_id   UUID NOT NULL,
  PRIMARY KEY (dataset_id, entity_id)
);
```

Every entity row carries `generation_run_id` → run → generator+version → prompt template. That single chain answers "which prompt, which model, which seed produced this byte" — which is the entire Phase 5 trust story, captured for free from day one.

---

## 5. Generator OS — how you actually operate this

This is the system behind your workflow: *create data → change how you create data → keep everything organized and automatic.*

*   **Generators as data.** The dashboard reads `params_schema` and auto-renders a form (JSON Schema → form fields). Writing a new generator means filling in a prompt template and two schemas — in the dashboard, no code redeployment. Editing methodology bumps `version`; old runs stay mapped to old versions forever.
*   **Hook chain (the automation).** Each generator declares an ordered pipeline that fires on every generated item:
    ```json
    "hooks": [
      {"type": "schema_validate"},
      {"type": "dedup",           "config": {"similarity_threshold": 0.92}},
      {"type": "llm_judge",       "config": {"rubric": "big_five_consistency", "min_score": 0.7}},
      {"type": "distribution_check", "config": {"norms": "ipip_neo_population"}},
      {"type": "auto_tag"},
      {"type": "provenance_stamp"},
      {"type": "route",           "config": {"auto_approve_above": 0.9, "else": "curation_queue"}}
    ]
    ```
    Hook types are implemented once in the service layer; generators compose them. High-scoring items can auto-approve; everything else lands in the curation queue. This is how "as automatic as possible" remains compatible with human curation.
*   **Datasets.** When a batch is worth naming ("the 500 profiles behind Profile Library v1"), freeze it as a dataset: immutable membership + content hash. Products/recipes pin dataset versions, so a buyer's purchase never mutates under them, and the Phase 5 on-chain registry has a stable artifact to hash.
*   **Multiple dashboards, guaranteed.** Rule: **the Lab has no private backdoor** — every dashboard action goes through the same API layer (with an admin scope). Consequence: you can rebuild the dashboard, run three specialized dashboards (curation cockpit / generator studio / analytics), or replace the UI entirely without migrating the data layer.

---

## 6. Product catalog and pricing

Launch ladder:

| # | Product | Phase | Proves | Price (test, don't assume) |
|---|---|---|---|---|
| 1 | Personality Profile Library | 1 | Atomic layer | $0.01/query · $49 pack |
| 2 | Behavioral Scenario Library | 2 | Relations compound | $0.03/query · $99 themed pack |
| 3 | Trading Psychology Suite | 2–3 | Recipes compose without code | $0.05/query · $199 pack |
| 4 | Cognitive Bias Simulator | 3 | Recipe-only product (no new code — the modularity test) | $0.02/query |
| 5 | Negotiation Dynamics Pack | 6 | Multi-profile interaction data | $0.04/query |
| 6 | Emotional Response & Empathy Pack | 6 | L1 patterns as standalone | $0.02/query |
| 7 | Benchmark & Evaluation Sets | 6 | Seeded reproducibility | $0.10/query (premium) |
| 8 | Custom Curated Bundles | 6 | ACP request→escrow→deliver | $500+ per engagement |

Every product includes a ~5% free preview, version-locked purchases, and prices in machine-readable response headers.

---

## 7. The seven phases

Compounding rule: each phase is independently deployable, plugs into the layers below it, and never rewrites them.

### Phase 1 — Revenue spine + Lab v0 (MVP)
*   **Goal**: One autonomous agent pays real money, and every byte served is traceable to a generator run.
*   **Build**:
    *   Supabase project; Phase-1 tables (§4) including `generators`, `generation_runs`, `provenance` from day one.
    *   Two seed generators created as rows: `big-five-profile-gen`, `bias-linker-gen`. Minimal hook chain: `schema_validate` → `provenance_stamp` → `curation_queue`.
    *   **Lab v0** — one Next.js page with three panels: run a generator (auto-rendered form), review queue (approve/reject/edit), browse approved. Supabase Studio remains the fallback.
    *   ~300–500 approved profiles with bias links.
    *   One endpoint (`GET /v1/products/personality-profile-library`) behind x402 on Base (Sepolia → mainnet). Pack purchase + per-query. 5% free preview.
*   **Exit criteria**: One machine-initiated, unassisted paid transaction; for any served profile, you can verify the generator version, prompt hash, and seed that produced it.

### Phase 2 — Relational compounding + recipe engine
*   **Goal**: Prove data compounds instead of restarting per product, and products become config.
*   **Build**:
    *   Tables: `scenarios`, `profile_scenario_responses`, `scenario_bias_applications`, `emotional_patterns`, `decision_styles`, `recipes`, `versions_changelog`.
    *   New generators (in-dashboard): `scenario-gen`, `response-gen` — `response-gen` takes an *existing approved profile* as input, conditioning old personalities on new situations at zero new-personality generation cost.
    *   Recipe resolver service: JSON query-DSL → SQL. Products 2 and 3 ship as recipes over existing data.
    *   Version pinning: products reference entity/dataset versions; changelog formalized.
*   **Exit criteria**: Product 4 (Cognitive Bias Simulator) is definable as one `products` + `recipes` row with zero backend code; a second distinct paying agent.

### Phase 3 — Dashboard Lab OS (full)
*   **Goal**: Remove yourself as the bottleneck; the Lab becomes your operating system.
*   **Build**:
    *   **Generator Studio**: create/edit/version generators, batch runs with live progress, cost tracking, run history, and version diffs.
    *   **Curation Cockpit**: keyboard-driven approve/reject, bulk ops, and inline quality scoring.
    *   **Data Explorer**: faceted search (sliders for Big Five traits, tags, biases, quality).
    *   **Dataset Manager**: freeze/browse/compare snapshots, content hashes.
    *   **Product Builder**: compose recipes visually, live sample preview, one-click publish.
    *   **Methodology Tracker + Distribution Monitor**: exact prompt/model/criteria per entity; synthetic Big Five distributions checked against published population norms.
    *   Full hook library live: dedup/similarity, LLM-as-judge rubrics, distribution checks, auto-approve thresholds.
*   **Exit criteria**: Ship a new batch and a new product end-to-end without touching SQL directly; add a brand-new generator type entirely in-dashboard.

### Phase 4 — Agent-native discovery
*   **Goal**: Agents that have never heard of you find, evaluate, and pay you autonomously.
*   **Build**:
    *   **MCP server** (catalog + query + pay as tools — reaches Claude/OpenAI agent builders).
    *   **Solana Agent Kit plugin** + **Eliza plugin**; listings in x402 discovery registries and agent directories.
    *   OpenAPI spec + schema.org markup; pricing in headers; `psychosynth-sdk` (TS + Python) automating the 402→pay→receive handshake.
    *   **Agent Playground**: public demo — a mock trading bot toggles market volatility, buys a risk-averse profile mid-run, and changes behavior.
*   **Exit criteria**: First revenue from an agent/developer you did not personally onboard.

### Phase 5 — Commerce & trust hardening
*   **Goal**: Infrastructure you'd trust at 10× volume, and trust competitors can't replicate.
*   **Build**:
    *   Solana payment mirror of every endpoint, session pre-authorization, receipts + refunds, metering, per-agent spend dashboards, rate limiting, and anomaly detection.
    *   Dataset + methodology SHA-256 hashes published to a lightweight Solana registry program.
    *   Wallet-signed buyer reviews, escrow for large bundles, and external validator signatures (academic spot-checks).
    *   A/B test generator versions against benchmark sets; auto-promote winning methodology; buyer ratings feed quality scores.
*   **Exit criteria**: Traffic could 10× overnight without touching payment code; any buyer can cryptographically verify what they bought at runtime.

### Phase 6 — Composition engine + catalog expansion
*   **Goal**: Evolve from a catalog vendor to a reproducible experimental substrate.
*   **Build**:
    *   Query-time composition DSL: *"200 profiles, openness ≥ 0.7, high loss aversion, responding to 'crypto_volatility', seed 42"* → compiled joins → statistically filtered → signed dataset with fresh methodology hash. Same seed + same versions = byte-identical output.
    *   Products 5–7 ship as recipes (Negotiation, Emotional Response, Benchmark & Eval Sets).
    *   Product 8: custom bundles via **Virtuals ACP** (request → negotiate → escrow → deliver → evaluate).
*   **Exit criteria**: A benchmark customer reproduces a dataset byte-for-byte from seed + version; first ACP-escrowed custom engagement completed.

### Phase 7 — Public Lab, ecosystem & scale
*   **Goal**: The Lab becomes the top of the funnel; the methodology becomes citable; revenue arrives organically.
*   **Build**:
    *   **Public Dashboard Lab**: free tier (explore profiles, view methodology, run limited previews) → paid API → premium curation.
    *   arXiv methodology preprint; joint validation study against human baselines (Union Nikola Tesla partnership).
    *   Community curation: Open contribution proposals where verified academic contributors can earn revenue share.
    *   Auto-scaling read replicas, edge caching, and multi-chain settlement.
*   **Exit criteria**: Revenue from channels no founder touched; the methodology is cited; the system is self-sustaining.

---

## 8. Go-to-market roadmap

*   **Phase 1**: Build in public on X; open-source the x402 middleware; direct outreach to Solana trading-bot builders via Pumpolis footing.
*   **Phase 2–3**: Discord server for early agent devs (free credits for feedback); technical blog on x402 and synthetic psychometric validation.
*   **Phase 4**: Submit to MCP registry, Solana Agent Kit, Eliza registry, Virtuals catalog, and LangChain community tools; publish the interactive Agent Playground.
*   **Phase 5**: Case studies demonstrating real agent performance upgrades; sponsor agent-hackathon tracks.
*   **Phase 6**: Direct outreach to evaluation labs using reproducibility as the key differentiator.
*   **Phase 7**: Publish arXiv preprint; present the public Lab on Show HN; demo live agent-to-agent transactions at AI agent summits.

Dual audience throughout: **agents** pay per query; **humans** (researchers, developers) pay for curation and exploration tools.

---

## 9. Metrics per phase

| Phase | Key Metric | Target |
|---|---|---|
| **1** | First unassisted paid agent query | Week 4 |
| **2** | Products live / 2nd distinct paying agent | 3 products, Week 8 |
| **3** | Batch shipped with zero SQL touched | Week 12 |
| **4** | Agent wallets registered / first organic sale | 100 wallets, Week 16 |
| **5** | Monthly revenue / verifiable datasets | $1,000 MRR, Week 20 |
| **6** | Reproducible benchmark customers / custom bundles | 3 + 1, Week 26 |
| **7** | Agent wallets / MRR / citations | 10,000 · $10k · 1 preprint, Week 32+ |

---

## 10. Tech stack

*   **Database**: Supabase (Postgres + JSONB, RLS, Auth, Supabase Studio for v0 backup).
*   **Backend & Frontend**: Next.js (App Router) + TypeScript, single repository. API routes serve both dashboards and agent queries identically.
*   **AI Generation**: Provider-agnostic LLM interface (Claude/GPT structured JSON outputs), models configurable in the database (`generators.model_config`).
*   **Payments**: x402 SDK with Coinbase facilitator (Base chain) for Phase 1; Solana payment mirror in Phase 5.
*   **Agent Interfaces**: MCP Server, Solana Agent Kit, Eliza plugins, OpenAPI.
*   **Hosting**: Vercel + Supabase managed cloud.

---

## 11. Design principles (the constitution)

1.  **Everything is versioned** — Never overwrite; bump versions and log to changelogs.
2.  **Everything is composable** — Products are config recipes; they reference entities/datasets; no product ever gets its own table.
3.  **Everything is traceable** — entity → run → generator version → prompt hash → seed. Runs are provenance.
4.  **Everything is API-first** — Admin dashboards and agent clients consume the same endpoints.
5.  **Everything is automatic by default, human by exception** — Hook chains validate, score, and route.
6.  **Everything is reproducible** — Same seed + same versions = byte-identical output.
7.  **Everything is honest** — Synthetic datasets are labeled as such; strict adherence to misuse-focused ToS.

---

## 12. First two weeks (concrete execution)

*   **Days 1–2**: Initialize Supabase project; create Phase-1 tables including `generators`, `generation_runs`, and `provenance`.
*   **Days 3–4**: Build the generation service: read generator row → compile template → call model (JSON mode) → validate output against `output_schema` → stamp provenance → route to queue. Seed the `big-five-profile-gen` generator row.
*   **Days 5–7**: Launch **Lab v0** page (Run, Review, Browse). Generate and curate initial set of 300–500 profiles.
*   **Days 8–9**: Deploy the `/query/profiles` endpoint with x402 middleware on Base Sepolia.
*   **Days 10–11**: Shift payment gate to Base mainnet (live USDC, per-query pricing, 5% preview).
*   **Days 12–14**: Complete the first unassisted agent transaction. Post the API endpoint publicly and launch the build-in-public campaign.
