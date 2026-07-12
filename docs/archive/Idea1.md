# FACES: Framework for Agentic Cognitive & Emotional Synthetics

FACES is a modular, web3-agent-native platform designed to generate, curate, and sell static and dynamic psychological synthetic datasets to AI agents. These datasets (personality profiles, behavioral scenarios, cognitive bias models, emotional trajectories) enable agents to simulate human-like decision-making, bias testing, and emotional intelligence. 

This document details the database architecture, maps how 3 specific products pull from this architecture, and outlines a 7-phase development roadmap to take FACES from an MVP to a globally deployed, agentic-web3 commerce engine.

---

## 1. Product Mapping Examples
Below is an explanation of how three different products are dynamically assembled by pulling from the core database tables.

### Product 1: "Solana DeGen" Trading Psychology Profile Pack
*   **Purpose**: Provides agents with behavioral models of retail crypto traders, showing how they react to high volatility, market crashes, and FOMO triggers.
*   **DB Query Logic**:
    1.  Select all `profiles` tagged with `category = 'crypto_trading'` and trait profiles where `neuroticism > 0.7` and `loss_aversion` is linked via `profile_bias_links`.
    2.  Join with `scenarios` of category `market_volatility` (e.g., "Jupiter Token Drop of 40%").
    3.  Retrieve the corresponding reactions and reasoning from `profile_scenario_responses`.
*   **Response Payload**: A JSON array of agent profiles, complete with MBTI, Big Five traits, and specific behavioral answers detailing their irrational decision paths (e.g., panic selling or FOMO buying).

### Product 2: Agent Negotiation Sandbox Dataset (v1)
*   **Purpose**: Provides structured conversational trees showing how different personality types negotiate under pressure.
*   **DB Query Logic**:
    1.  Select two distinct groups of `profiles` (e.g., Group A: MBTI ENTJ/Assertive, Group B: MBTI ISFJ/Cooperative).
    2.  Retrieve `scenarios` tagged with `negotiation_hostage` or `negotiation_business`.
    3.  Retrieve the step-by-step conditional response tree from `profile_scenario_responses` where both profiles interact in the same scenario context.
*   **Response Payload**: A structured interaction sequence detailing the bids, emotional escalation levels, concessions, and ultimate resolution/stalemate outputs for agent training.

### Product 3: Cognitive Bias Benchmark Suite
*   **Purpose**: A ground-truth test suite to evaluate whether other LLMs or agents are vulnerable to specific cognitive biases (e.g., Confirmation Bias, Sunk Cost Fallacy).
*   **DB Query Logic**:
    1.  Select all entries from the `biases` table.
    2.  For each bias, fetch linked `scenarios` containing hidden cognitive traps.
    3.  Pull the dual-branch answers from `profile_scenario_responses`: one flagged as `is_rational = true` and one flagged as `is_rational = false` (exhibiting the bias).
*   **Response Payload**: A validation set of prompt scenarios and corresponding multiple-choice evaluations with ground-truth classifications for agent benchmarking.

---

## 2. Modular Database Architecture
We will use a hybrid relational + document schema in PostgreSQL (using Supabase for rapid development and real-time triggers). 

```mermaid
erDiagram
    profiles ||--o{ profile_bias_links : has
    biases ||--o{ profile_bias_links : linked_to
    profiles ||--o{ profile_scenario_responses : responds_to
    scenarios ||--o{ profile_scenario_responses : triggers
    biases ||--o? profile_scenario_responses : applied_in
    products ||--o{ x402_payments : generates
    products }o--o{ tags_categories : categorized_by
    curation_queue }o--o| profiles : generates
```

### Table Schemas (SQL DDL draft)

```sql
-- Core Table: Profiles
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version VARCHAR(20) NOT NULL,
    codename VARCHAR(100) NOT NULL,
    mbti VARCHAR(4),
    big_five JSONB NOT NULL, -- {openness: 0.8, conscientiousness: 0.5, ...}
    decision_style VARCHAR(50), -- analytical, intuitive, dependent
    emotional_patterns JSONB, -- baseline volatility, recovery rate
    metadata JSONB, -- {generation_prompt_hash, quality_score, author}
    status VARCHAR(20) DEFAULT 'draft', -- draft, curated, archived
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Core Table: Scenarios
CREATE TABLE scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL, -- trading, negotiation, social
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Core Table: Biases
CREATE TABLE biases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    examples JSONB,
    mitigations JSONB
);

-- Junction Table: Profile Bias Strengths
CREATE TABLE profile_bias_links (
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    bias_id UUID REFERENCES biases(id) ON DELETE CASCADE,
    strength NUMERIC(3,2) CHECK (strength >= 0.0 AND strength <= 1.0),
    PRIMARY KEY (profile_id, bias_id)
);

-- Junction Table: Profile Scenario Responses
CREATE TABLE profile_scenario_responses (
    id PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    scenario_id UUID REFERENCES scenarios(id) ON DELETE CASCADE,
    response_text TEXT NOT NULL,
    reasoning TEXT,
    bias_applied UUID REFERENCES biases(id),
    is_rational BOOLEAN DEFAULT false,
    emotional_intensity NUMERIC(3,2), -- 0.0 to 1.0 scale
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Core Table: Products (Recipes for dynamic views)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    version VARCHAR(20) NOT NULL,
    pricing_type VARCHAR(50) DEFAULT 'x402_query', -- x402_query, static_pack
    price_amount NUMERIC(10, 6) NOT NULL, -- Amount in SOL or USDC
    recipe JSONB NOT NULL, -- {"profile_tags": ["trading"], "scenario_categories": ["trading"]}
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Payment Tracker (x402 compliance)
CREATE TABLE x402_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_hash VARCHAR(255) UNIQUE NOT NULL, -- Solana signature
    buyer_wallet VARCHAR(255) NOT NULL, -- Solana Public Key
    product_id UUID REFERENCES products(id),
    amount NUMERIC(10, 6) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, verified, expired
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 3. Seven-Phase Development Roadmap

### Phase 1: Minimum Viable Product (MVP) - Database Core & LLM Generator Scripts
*   **Objective**: Set up local development environment, database tables, LLM scripts using structured JSON outputs to populate the tables, and a lightweight "Dashboard Lab" page to view, search, and export data.
*   **Deliverables**:
    *   PostgreSQL schema scripts.
    *   Python-based LLM generation script (populating profiles, biases, and responses with structured JSON).
    *   Next.js static site to explore the generated data and download raw JSON files.

### Phase 2: Product Orchestration API Layer
*   **Objective**: Transition from static JSON files to dynamic API assembly based on "recipes".
*   **Deliverables**:
    *   FastAPI/Express backend that translates a Product Recipe JSON into SQL query filters.
    *   Dynamic endpoints (e.g., `/api/v1/products/:id/sample`).
    *   Dashboard visual builder for creating product recipes (drag & drop profiles and scenarios).

### Phase 3: Solana x402 Protocol Middleware
*   **Objective**: Secure the dynamic endpoints behind a micropayments paywall conforming to the HTTP 402 "Payment Required" standard.
*   **Deliverables**:
    *   Custom server middleware intercepting product query requests.
    *   Return header `X-402-Payment-Request: Solana:<recipient_wallet>:<amount_in_usdc_or_sol>`.
    *   Verification endpoint that listens for Solana Transaction Signatures, inspects the transaction on-chain via RPC, matches the amount, and grants access.

### Phase 4: Agent SDK & Interactive Agent Playground
*   **Objective**: Enable agents to query the platform natively and provide a visual demonstration of an agent consuming psychological traits to modify its actions.
*   **Deliverables**:
    *   `faces-agent-sdk` (TypeScript/Python npm/pip package) to automate the `x402` request-pay-verify-receive handshake.
    *   Interactive client playground: A mock Solana Trading Interface showing a demo trading bot. When the user toggles market volatility, the bot queries the FACES API, pays the micropayment, receives a new "Risk Averse" profile, and alters its trade execution immediately.

### Phase 5: Automated Lab Evaluation & Curation Engine
*   **Objective**: Automate sanity-checking and quality scoring of AI-generated synthetic data.
*   **Deliverables**:
    *   LLM-as-a-Judge validation script running automatically on new curation queue items.
    *   Consistency checks: ensuring a profile's MBTI matches their Big Five score trends, and their scenario responses match their designated biases.
    *   Visual status dashboard in the Curation Lab (Approve, Regenerate, Edit, Archive).

### Phase 6: Base Chain & Virtuals Protocol ACP Integration
*   **Objective**: Expand market reach to the Base EVM network and the Virtuals Protocol.
*   **Deliverables**:
    *   Support for Base wallet signatures and ERC-20 USDC payments in the x402 middleware.
    *   Virtuals Agent Commerce Protocol (ACP) standard integration, allowing agents on Virtuals to query endpoints through smart contracts.

### Phase 7: Production Scale, Launch & Marketing Toolkit
*   **Objective**: Deploy the solution globally, launch marketing channels, and drive adoption.
*   **Deliverables**:
    *   Production hosting (Vercel + Supabase Managed DB) with edge routing.
    *   Public-facing Landing Page showing live on-chain stats (Agents served, total transactions, active product catalogs).
    *   Open-sourcing the x402 Solana Middleware package to encourage other builders.
