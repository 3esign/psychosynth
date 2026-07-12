# Verified Behavioral Infrastructure for the Agent Economy
## 7-Phase Compounding Roadmap, Provenance-first Schema, and World-class Execution Notes

The strategic frame of selling synthetic psychological data to agents is solid, but we can build a much stronger competitive edge. Selling synthetic psychological data to agents is trivially replicable — anyone with an LLM can generate profiles. What's **not replicable** is the trust stack around that data: verified methodology, cryptographic provenance, deterministic reproducibility, and composability at query time. That's the world-class play.

By positioning this less as "data-for-sale" and more as **"verified behavioral infrastructure for the agent economy"**, we establish a category that doesn't really exist yet.

Furthermore, the Dashboard Lab shouldn't stay internal. If made public, it becomes both a credibility engine (where researchers cite it and agent devs explore before purchase) and the top of the customer funnel:
```
Free Exploration ──> Paid API for Agents ──> Premium Curated Bundles
```

---

# 7-Phase Compounding Roadmap

Every phase is a module that plugs into the ones below it without changing them — Phase 4 doesn't rewrite Phase 1's schema, it adds a discovery layer over it. Nothing higher up requires re-architecting anything lower.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Phase 7: Ecosystem & Scale                                              │
│ - Public Dashboard Lab (Free tier exploration / Paid API access)        │
│ - Academic methodology preprints (Union Nikola Tesla partnership)       │
│ - External contributor curation, reputation, & revenue share            │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│ Phase 6: Query-Time Composition Engine                                  │
│ - Move from static packs to composition DSL & query-time joining        │
│ - Deterministic seeding for reproducible experimental runs              │
│ - Custom bundles generated and delivered on-demand                      │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│ Phase 5: Trust and Provenance                                           │
│ - SHA-256 methodology hashes stored on-chain (Solana Registry Program)  │
│ - Wallet-signed buyer reviews & Escrow contracts for bundle purchases   │
│ - Academic spot-checks & signed validator attestations                  │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│ Phase 4: Agent-Native Discovery                                         │
│ - MCP server for Claude Desktop / Claude Code / OpenAI tool integration  │
│ - Solana Agent Kit plugin (endpoints as Solana actions)                 │
│ - Base Virtuals ACP catalog & OpenAPI specifications                    │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│ Phase 3: Curation Dashboard Lab                                         │
│ - Next.js UI: AI-assisted generator queue, faceted profile explorer     │
│ - Curation cockpit & Product recipe builder (drag-and-drop)            │
│ - Methodology tracker & Big Five statistical population validators      │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│ Phase 2: Product Suite via Recipes                                      │
│ - Introduce products & recipes tables (products defined by config)      │
│ - Immutable version-locking for buyers                                  │
│ - Free sample previews (~5%) & versions_changelog table                 │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│ Phase 1: MVP Foundation & Revenue Loop                                  │
│ - Schema: profiles, scenarios, biases, profile_bias_links, provenance   │
│ - 500+ curated profiles (Big Five, decision style, bias links)          │
│ - /query/profiles endpoint gated by x402 middleware on Solana           │
└─────────────────────────────────────────────────────────────────────────┘
```

### Phase 1 — MVP Foundation
*   **Goal**: Ship one working revenue loop end-to-end so you can charge agents money on day one.
*   **Deliverables**:
    *   Postgres (Supabase) database with five initial tables: `profiles`, `scenarios`, `biases`, `profile_bias_links`, and `provenance`.
    *   One Product: *Personality Profile Library v1* (~500 curated profiles with Big Five, decision style, and weighted bias links).
    *   One API endpoint (`/query/profiles`) fronted by x402 middleware. An agent hits it with a filter, gets a price quote, pays USDC on Solana, and receives the payload.
    *   No dashboard yet — curation is done directly in SQL or Supabase Studio.
*   **Success Criterion**: One autonomous agent pays real money for one query, and we can cryptographically verify which profiles were served, from which version, and generated by which prompt.

### Phase 2 — Product Suite via Recipes
*   **Goal**: Introduce products and recipes tables so that new products require configuration, not code.
*   **Deliverables**:
    *   `products` and `recipes` tables. A recipe is a query rule plus a composition function that pulls from base entities.
    *   Launch *Behavioral Scenario Library*, *Cognitive Bias Simulator*, and *Emotional Response Pack* as three recipes over the same core data.
    *   Explicit versioning: Every entity gets a version column, and products are pinned to specific version ranges.
    *   Include free sample previews (~5% of each pack) so agents can evaluate before spending.
    *   Introduce `versions_changelog` table to formalize data iteration.

### Phase 3 — Dashboard Lab
*   **Goal**: Build the internal curation tool to enable scaling without human bottlenecks.
*   **Deliverables**:
    *   Next.js + Supabase client with four key views:
        1.  *AI Generator*: structured prompts targeting the curation queue.
        2.  *Data Explorer*: faceted filtering (sliders for Big Five traits, bias tags, quality).
        3.  *Curation Cockpit*: keyboard-driven approval/rejection and inline quality scoring.
        4.  *Product Builder*: drag-and-drop interface for composing product recipes.
    *   *World-Class Additions*:
        *   *Methodology Tracker*: records the exact prompt, model version, and validation criteria for each entity.
        *   *Distribution Monitor*: verifies that synthetic Big Five distributions statistically match published population norms.

### Phase 4 — Agent-Native Discovery
*   **Goal**: Meet autonomous agents where they live so they can discover the platform.
*   **Deliverables**:
    *   An **MCP Server** so any Claude Desktop, Claude Code, or OpenAI agent can install the catalog as a tool.
    *   A **Solana Agent Kit** plugin to make endpoints accessible as first-class on-chain actions.
    *   **Base Virtuals Protocol ACP** integration.
    *   OpenAPI specification + schema.org markup for auto-indexing.
    *   Pricing details returned directly in response headers so agents can budget-check before execution.

### Phase 5 — Trust and Provenance
*   **Goal**: Establish the cryptographic trust registry that competitors cannot replicate.
*   **Deliverables**:
    *   Dataset version SHA-256 methodology hashes (generation prompt + model + seed + criteria).
    *   Hash + dataset signature published to a lightweight Solana registry program.
    *   Signed reputation and review tables for paying agents.
    *   Escrow smart contracts for larger bundle purchases.
    *   Quality attestations signed by external validators (academic spot-checks).

### Phase 6 — Composition Engine
*   **Goal**: Move from static packs to query-time composition.
*   **Deliverables**:
    *   Agent queries like: *"give me 200 profiles with Big Five openness ≥ 0.7, high loss aversion, responding to scenario category 'crypto_volatility', seeded deterministically."*
    *   Composition engine that compiles the query, runs SQL joins, filters statistical anomalies, and returns a signed dataset with a fresh methodology hash.
    *   Unlocks reproducible ground-truth benchmark sets for agent evaluations.

### Phase 7 — Ecosystem and Scale
*   **Goal**: Make the Dashboard Lab public and publish formal credentials.
*   **Deliverables**:
    *   Public Dashboard Lab with a free tier (explore profiles, view methodology) and paid tier (full API access, custom compositions).
    *   Community curation: Open contribution proposals where verified academic contributors can earn revenue share.
    *   Publish a preprint on arXiv detailing the synthetic psychology methodology.
    *   Full multi-chain deployment (Solana, Base, and major EVM ecosystems).

---

# Modular Database Schema

This Phase 1 schema supports the entire stack. Future products, features, and composition queries are stored as rows in the `products` and `recipes` tables — never requiring new tables.

```sql
-- CORE ENTITIES (Layer 1)

CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version INT NOT NULL DEFAULT 1,
    big_five JSONB NOT NULL,             -- {openness, conscientiousness, extraversion, agreeableness, neuroticism} (0-1.0 scale)
    mbti_label VARCHAR(4),               -- Cosmetic label only
    decision_style VARCHAR(50),
    tags TEXT[] NOT NULL DEFAULT '{}',
    quality_score NUMERIC(3,2) CHECK (quality_score >= 0.0 AND quality_score <= 1.0),
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | approved | rejected
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance Indexes
CREATE INDEX idx_profiles_tags ON profiles USING gin(tags);
CREATE INDEX idx_profiles_quality ON profiles(quality_score);

CREATE TABLE scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version INT NOT NULL DEFAULT 1,
    title TEXT NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,       -- trading | negotiation | social | crisis
    tags TEXT[] NOT NULL DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE biases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,   -- 'Loss Aversion', 'FOMO', 'Herd Behavior'
    description TEXT NOT NULL,
    examples JSONB,
    mitigation_strategies JSONB
);

-- JUNCTIONS (Layer 2)

CREATE TABLE profile_bias_links (
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    bias_id UUID REFERENCES biases(id) ON DELETE CASCADE,
    strength NUMERIC(3,2) CHECK (strength >= 0.0 AND strength <= 1.0),
    weight NUMERIC(3,2),
    context_notes TEXT,
    PRIMARY KEY (profile_id, bias_id)
);

CREATE TABLE profile_scenario_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    scenario_id UUID REFERENCES scenarios(id) ON DELETE CASCADE,
    response TEXT NOT NULL,
    reasoning TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PROVENANCE & METADATA (Trust Layer)

CREATE TABLE provenance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,    -- 'profile' | 'scenario' | 'response' | 'dataset'
    entity_id UUID NOT NULL,
    model_version VARCHAR(100) NOT NULL, -- e.g., 'gpt-4o-2024-05-13'
    prompt_hash VARCHAR(64) NOT NULL,    -- SHA-256 of the prompt template
    seed INT NOT NULL,                   -- Deterministic seed
    sha256_hash VARCHAR(64) NOT NULL,    -- Hash of the raw JSON content
    signature VARCHAR(256),              -- Platform private key signature
    attestations JSONB DEFAULT '[]',     -- Signatures from academic validators
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_provenance_entity ON provenance(entity_type, entity_id);

-- ORCHESTRATION (Layer 5)

CREATE TABLE recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version INT NOT NULL DEFAULT 1,
    query_rules JSONB NOT NULL,          -- JSON DSL specifying filters & JOIN requirements
    composition_rules JSONB,             -- Target population ratios, sample sizes
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(100) UNIQUE NOT NULL,   -- e.g., 'trading-psychology-pack'
    name VARCHAR(255) NOT NULL,
    recipe_id UUID REFERENCES recipes(id),
    price_model JSONB NOT NULL,          -- {"type": "per_query", "usdc": 0.01}
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE versions_changelog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    old_version INT,
    new_version INT NOT NULL,
    changes TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

# World-Class Execution Notes

1.  **Provenance as a Primitive**: Every dataset served has a cryptographic hash of its methodology (prompt + model + seed + criteria) and its bytes. This signature-plus-payload architecture allows agents to verify integrity at runtime.
2.  **Academic Grounding as the Moat**: Prompts cite established psychological instruments (e.g., IPIP-NEO for Big Five, Kahneman/Tversky sources for cognitive biases). Publishing preprints on arXiv makes datasets citable, driving developer confidence.
3.  **Deterministic Reproducibility**: Queries accept a `seed`. Same seed + same recipe version = byte-identical outputs, transforming the API from a simple vendor to a reproducible experimental substrate.
4.  **The Dual Audience**: Agents pay micropayments per query; humans (researchers, developers) pay for Explorer and Premium Curation subscriptions.
5.  **Composition Beats Catalog**: Query-time composition allows builders to query custom statistical distributions. Price scales with the complexity of the query rules.
6.  **Brand Identity**: Target names that signal trust and infrastructure (e.g., *Persona Provenance*, *Synthograph*, *Aegis*, *Behavior Registry*).

---

# Deployment and Spreading the Word

*   **Agent Channels**: Submit to Solana Agent Kit registry, MCP registry, Virtuals ACP catalog, LangChain community tool specs, and Eliza plugin directories.
*   **Human Channels**: Publish the arXiv preprint on synthetic methodology in Phase 3. Submit the Dashboard Lab to Show HN in Phase 7. Write case studies on agents improving benchmarks using the datasets.
*   **Academic Partnerships**: Leverage academic affiliations (such as Union Nikola Tesla) for joint validation studies to verify synthetic profiles against human baseline populations.
