# PSYCHOSYNTH — Development Proposal & Build Specification

**Version 1.0 · July 2026 · Supersedes nothing, implements MASTERPLAN.md**

MASTERPLAN.md remains the strategic document (what and why). This document is the engineering document (how, exactly). It adds one major subsystem the master plan under-specified — the **Learning Loop** — and re-cuts the phases so Phase 1 is a complete working vertical slice that already collects every byte of operational data you will later want for prompt optimization, orchestration tuning, and model fine-tuning.

Read order for a build session: §2 (decisions) → §3 (architecture) → §4 (data model) → §9 (Phase 1 guide). Sections 5–8 are the reference specs you consult while building.

---

## 1. Why this revision exists

The master plan treats feedback and improvement as late-phase features (A/B tests in Phase 5, ratings feeding scores). But the operating reality is a **lab**: you will run generation experiments daily, change prompts weekly, and curate continuously. A lab that does not capture its own operations as structured data is throwing away its most valuable output. Three concrete losses if we build as originally planned:

1. **Curation labor evaporates.** You will make thousands of approve/reject/edit decisions. Unrecorded, they are gone. Recorded properly, they are a labeled dataset: approvals are positive labels, rejections with reason codes are classified negatives, and every manual edit is a preference pair (original → improved). That is exactly the format SFT and DPO fine-tuning consume. Your daily work becomes a proprietary training corpus as a side effect.
2. **Prompt changes are unfalsifiable.** Without frozen evaluation sets and recorded metrics, "the new prompt feels better" is the best you can say. With golden sets and a promotion rule, every prompt/model/temperature change is a measured experiment, and system prompts improve monotonically instead of drifting.
3. **Demand is invisible.** Agents will query with filters you cannot serve. If those misses aren't logged, you generate blind. Logged, they become an automatic generation backlog: make what buyers already asked for.

The fix costs almost nothing at build time — one append-only table, one decisions table, and the discipline of logging — because everything else in the architecture (generators as data, runs as provenance, hooks as pipeline) was already designed to produce structured traces.

---

## 2. Locked decisions (six)

Decisions 1–5 are inherited from MASTERPLAN §2 unchanged. Decision 6 is new.

1. **Trait model** — Big Five (OCEAN) canonical, generated against IPIP-NEO framing; Kahneman/Tversky sources for biases. `mbti_label` kept as derived, cosmetic, searchable — never authoritative.
2. **Database** — relational Postgres (Supabase) + JSONB + junction tables. The knowledge graph is the mental model; junctions are the implementation. Products are never tables; they are recipe rows resolved by one service.
3. **Trust** — provenance recorded from day one (model, prompt hash, params, content SHA-256 per entity); published on-chain in Phase 5. Nothing is ever regenerated retroactively.
4. **Payments** — x402 on Base first (Coinbase facilitator; packages `@x402/next`, `@x402/core`, `@x402/evm`, facilitator via `@coinbase/x402`), Solana mirror in Phase 5, Virtuals ACP for bespoke deals in Phase 6. Packs offered alongside per-query from day one.
5. **Generator OS** — generators are rows, not code: prompt template + params schema + output schema + hook chain + model config. Every run is logged; runs are provenance. Dashboards are thin clients over the same API agents use — no private backdoor.
6. **Learning Loop (new)** — every operation emits an event into an append-only spine; every curation decision is captured as a label with reason codes and edit diffs; every prompt/model change is an experiment measured against frozen golden sets before promotion; every buyer query is demand telemetry. The lab's byproducts (SFT/DPO exports, eval suites, calibration data) become sellable products in Phase 6.

One honesty correction to the master plan, locked here: **LLM generation is replayable, not byte-deterministic.** Model providers do not guarantee identical outputs for identical inputs (OpenAI's `seed` is best-effort; Anthropic has no seed). So the guarantee we sell is precise: *generation* is fully replayable (every byte traces to prompt hash + model + params + recorded output), and *query-time composition* (Phase 6) is byte-deterministic (same seed + same frozen dataset versions = identical output, because sampling happens in our code, not the model). Never claim deterministic generation in marketing or docs.

---

## 3. System architecture

### 3.1 Module map

Six modules, one database, one API layer. A single Next.js repository at Phase 1 — modularity is enforced by folder boundaries and import rules, not by premature microservices. Extract packages only when a boundary proves itself (SDK in Phase 4 is the first).

```
                 ┌───────────────────────────────────────────────┐
                 │                  AI PROVIDERS                  │
                 │   (Anthropic / OpenAI / any, structured JSON)  │
                 └───────────────────────┬───────────────────────┘
                                         │
              ┌──────────────────────────▼──────────────────────────┐
              │  GENERATION  (Generator OS runtime)                  │
              │  template compiler · model interface · run executor  │
              └──────────────┬───────────────────────┬───────────────┘
                             │ items                 │ every step
              ┌──────────────▼───────────┐   ┌───────▼──────────────┐
              │  HOOKS  (pipeline)        │   │  LEARNING             │
              │  validate · dedup · judge │──▶│  events · decisions   │
              │  distribution · route     │   │  experiments · goldens│
              └──────────────┬───────────┘   │  exports · telemetry  │
                             │                └───────▲──────────────┘
              ┌──────────────▼───────────────────────┼───────────────┐
              │  CORE-DB  (Postgres + JSONB)          │               │
              │  entities · junctions · provenance · runs · datasets │
              └──────────────┬───────────────────────┬───────────────┘
                             │                       │
              ┌──────────────▼───────────┐   ┌───────▼───────────────┐
              │  RECIPES (resolver)       │   │  LAB-UI (thin client)  │
              │  products = config        │   │  run · review · browse │
              └──────────────┬───────────┘   │  (same API, admin scope)│
                             │                └───────────────────────┘
              ┌──────────────▼───────────────────────────────────────┐
              │  COMMERCE  (x402 middleware · pricing · receipts)     │
              └──────────────┬───────────────────────────────────────┘
                             │
              ┌──────────────▼───────────────────────────────────────┐
              │  AGENT INTERFACES  (REST now; MCP · SDK · plugins P4) │
              └──────────────────────────────────────────────────────┘
```

### 3.2 Module responsibilities and boundary rules

| Module | Owns | May import | Never |
|---|---|---|---|
| `core` | DB client, shared types, canonical JSON + hashing | — | imports other modules |
| `generation` | run executor, template compiler, model providers | core, hooks, learning | writes entities except through executor |
| `hooks` | hook registry + implementations | core, learning | calls generation (no cycles) |
| `learning` | event logger, decisions, exports, calibration, goldens | core | mutates entities (write-only telemetry, read-only analytics) |
| `recipes` | query-DSL → SQL resolver | core | knows about payments |
| `commerce` | pricing, x402 config, payment records | core, recipes | generates data |

Hard rules that keep the system modular:

- **No private backdoor.** Lab UI calls `/api/lab/*` (auth: admin). Agents call `/api/v1/*` (auth: payment). Both route through the same modules. You can rebuild or multiply dashboards without touching data.
- **New behavior = new row, not new code path.** New product → `products`+`recipes` row. New methodology → generator version bump. New validation → hook config change. New generator type → row with new schemas. Code changes are reserved for new *hook types* and new *DSL capabilities*.
- **Append, don't mutate.** Entities are versioned; events and decisions are append-only; datasets are frozen. Deletes are status changes (`archived`), never row deletion — the learning loop depends on history surviving.
- **Everything through the executor.** No script may insert entities directly. If it didn't go through a generation run (or an explicit `manual-entry` generator), it doesn't exist. This is what makes provenance complete rather than mostly-complete.

### 3.3 Tech stack

- **Database/Auth**: Supabase (Postgres 15+, RLS, Auth). Supabase Studio is the emergency fallback UI.
- **App**: Next.js 15 App Router + TypeScript, single repo. Vercel hosting.
- **Model calls**: Vercel AI SDK (`generateObject`) with provider registry — provider/model/temperature live in `generators.model_config`, so switching models is a DB edit.
- **Validation**: Zod for internal contracts; Ajv for the JSON-Schema stored in generator rows (params/output schemas are data, so they need a runtime JSON-Schema validator, not compile-time types).
- **Payments**: `@x402/next` middleware + `@coinbase/x402` facilitator, network `base` (testnet `base-sepolia` first). Verify current package APIs at docs.x402.org when building — the ecosystem moves fast (x402 Foundation formalized under the Linux Foundation, April 2026).
- **Jobs**: Phase 1 runs generation inline from the API route with batch sizes ≤ 25 (a run of 25 profiles completes within serverless limits). Phase 3 moves batches to a queue (Supabase Edge Functions cron or Inngest) — the `generation_runs` table is already the job record either way.

---

## 4. Data model

Migration files map to sections: `0001_core.sql` (§4.1–4.3), `0002_generator_os.sql` (§4.4), `0003_learning.sql` (§4.5), `0004_commerce.sql` (§4.6). Everything below ships in Phase 1 unless marked otherwise. Later-phase tables (§4.7) are specified now so nothing ever needs altering — only adding.

### 4.0 The content + promoted-columns pattern

Every generated entity stores the **exact model output** in a `content JSONB` column — this is the byte source of truth that gets hashed for provenance and exported for training. Alongside it, frequently-queried fields are **promoted** to real columns (populated from `content` at insert). Queries hit promoted columns and indexes; hashing, export, and replay always use `content`. Never "fix" data by editing promoted columns alone; edits go through curation (which snapshots old/new content and re-stamps provenance).

### 4.1 Reference tables

```sql
-- 0001_core.sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE biases (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,            -- 'loss-aversion'
  name          TEXT NOT NULL,                   -- 'Loss Aversion'
  description   TEXT NOT NULL,
  source        TEXT,                            -- 'Kahneman & Tversky (1979)'
  examples      JSONB NOT NULL DEFAULT '[]',
  mitigations   JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE decision_styles (                    -- reference, seeded by hand
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug  TEXT UNIQUE NOT NULL,                     -- 'analytical' | 'intuitive' | ...
  name  TEXT NOT NULL,
  description TEXT
);

CREATE TABLE rejection_reasons (                  -- the label taxonomy (Learning Loop)
  code        TEXT PRIMARY KEY,                   -- 'incoherent_traits'
  label       TEXT NOT NULL,
  description TEXT NOT NULL,
  entity_type TEXT                                -- NULL = applies to all types
);
```

Seed `rejection_reasons` with an initial taxonomy (extend freely; never delete codes, deprecate them):

| code | meaning |
|---|---|
| `incoherent_traits` | Big Five scores contradict each other or the narrative |
| `bias_mismatch` | linked biases implausible for the trait vector |
| `generic_content` | boilerplate; no distinguishing detail |
| `unrealistic` | psychologically implausible pattern |
| `distribution_outlier` | valid alone, but skews population stats |
| `duplicate_like` | too similar to existing approved item (missed by dedup) |
| `schema_drift` | valid JSON but semantically off-schema |
| `other` | free-text note required |

Reason codes are what turn rejections from "deleted work" into a classified negative dataset — and they tell you *which* generator failure mode to fix.

### 4.2 Core entities

```sql
CREATE TABLE profiles (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version            INT NOT NULL DEFAULT 1,
  content            JSONB NOT NULL,              -- exact model output (source of truth)
  -- promoted columns ↓
  big_five           JSONB NOT NULL,              -- {openness..neuroticism} 0.0–1.0
  mbti_label         VARCHAR(4),                  -- derived, cosmetic
  decision_style     TEXT,
  tags               TEXT[] NOT NULL DEFAULT '{}',
  summary            TEXT,                        -- one-line human description
  -- lifecycle ↓
  quality_score      NUMERIC(3,2) CHECK (quality_score BETWEEN 0 AND 1),
  status             TEXT NOT NULL DEFAULT 'pending',  -- pending|approved|rejected|archived
  generation_run_id  UUID,                        -- FK added in 0002 (table order)
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_status   ON profiles(status);
CREATE INDEX idx_profiles_tags     ON profiles USING gin(tags);
CREATE INDEX idx_profiles_bigfive  ON profiles USING gin(big_five);
CREATE INDEX idx_profiles_summary_trgm ON profiles USING gin(summary gin_trgm_ops); -- dedup

CREATE TABLE profile_bias_links (
  profile_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  bias_id        UUID REFERENCES biases(id)   ON DELETE CASCADE,
  strength       NUMERIC(3,2) CHECK (strength BETWEEN 0 AND 1),
  context_notes  TEXT,
  generation_run_id UUID,
  PRIMARY KEY (profile_id, bias_id)
);
```

### 4.3 Provenance

```sql
CREATE TABLE provenance (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type    TEXT NOT NULL,                   -- 'profile'|'scenario'|'response'|'dataset'
  entity_id      UUID NOT NULL,
  entity_version INT NOT NULL DEFAULT 1,
  model          TEXT NOT NULL,                   -- 'claude-sonnet-4-5' / 'manual'
  prompt_hash    CHAR(64) NOT NULL,               -- sha256(rendered prompt)
  template_hash  CHAR(64) NOT NULL,               -- sha256(generator prompt_template)
  params         JSONB NOT NULL DEFAULT '{}',     -- run params incl. temperature, seed
  sha256_content CHAR(64) NOT NULL,               -- sha256(canonical(content))
  signature      TEXT,                            -- platform key signature (P5 fills)
  attestations   JSONB NOT NULL DEFAULT '[]',     -- validator signatures (P5)
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, entity_version)
);
CREATE INDEX idx_provenance_entity ON provenance(entity_type, entity_id);
```

Hashing rule (implemented once in `core/canonical.ts`, used everywhere): canonical JSON = keys sorted recursively, no whitespace, UTF-8 → SHA-256 hex. Curation edits create `entity_version = n+1` provenance rows with `model = 'human-edit'`; the original row is never touched.

### 4.4 Generator OS

```sql
-- 0002_generator_os.sql
CREATE TABLE generators (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL,                  -- 'big-five-profile-gen'
  version         INT NOT NULL DEFAULT 1,
  entity_type     TEXT NOT NULL,                  -- what it produces
  description     TEXT,
  prompt_template TEXT NOT NULL,                  -- {{placeholders}}
  params_schema   JSONB NOT NULL,                 -- JSON Schema → Lab auto-renders form
  output_schema   JSONB NOT NULL,                 -- JSON Schema each item must satisfy
  model_config    JSONB NOT NULL,                 -- {provider, model, temperature, max_items_per_call}
  hooks           JSONB NOT NULL DEFAULT '[]',    -- ordered chain, §5.3
  status          TEXT NOT NULL DEFAULT 'draft',  -- draft|active|deprecated
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (slug, version)
);

CREATE TABLE generation_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generator_id    UUID NOT NULL REFERENCES generators(id),
  generator_slug  TEXT NOT NULL,                  -- denormalized for painless querying
  generator_ver   INT NOT NULL,
  params          JSONB NOT NULL,                 -- the filled form
  model_used      TEXT NOT NULL,
  items_requested INT NOT NULL,
  items_created   INT NOT NULL DEFAULT 0,
  items_auto_approved INT NOT NULL DEFAULT 0,
  items_rejected_by_hooks INT NOT NULL DEFAULT 0,
  cost_usd        NUMERIC(10,4),
  hook_summary    JSONB NOT NULL DEFAULT '[]',    -- aggregate per-hook pass rates
  status          TEXT NOT NULL DEFAULT 'running',-- running|done|failed
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at     TIMESTAMPTZ
);

ALTER TABLE profiles ADD CONSTRAINT fk_profiles_run
  FOREIGN KEY (generation_run_id) REFERENCES generation_runs(id);

-- Named immutable snapshots (used by products P2+, goldens P3, on-chain hashes P5)
CREATE TABLE datasets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT NOT NULL,
  version      INT NOT NULL DEFAULT 1,
  entity_type  TEXT NOT NULL,
  description  TEXT,
  sha256_hash  CHAR(64),                          -- hash of ordered member content hashes
  frozen_at    TIMESTAMPTZ,                       -- NULL = still mutable
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (slug, version)
);
CREATE TABLE dataset_items (
  dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE,
  entity_id  UUID NOT NULL,
  position   INT NOT NULL,                        -- stable ordering for hashing
  PRIMARY KEY (dataset_id, entity_id)
);
```

The provenance chain every served byte answers: entity → `generation_run_id` → run → (`generator_slug`, `generator_ver`) → prompt template + hashes. One join path, no gaps.

### 4.5 Learning Loop

```sql
-- 0003_learning.sql

-- The spine. Append-only. Everything that happens, happens here too.
CREATE TABLE events (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_type  TEXT NOT NULL,                      -- taxonomy §6.1
  actor_type  TEXT NOT NULL,                      -- 'human'|'system'|'hook'|'agent'
  actor_id    TEXT,                               -- user id / hook name / wallet addr
  entity_type TEXT,
  entity_id   UUID,
  run_id      UUID,
  payload     JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_events_type_ts ON events(event_type, ts);
CREATE INDEX idx_events_entity  ON events(entity_type, entity_id);
-- No UPDATE/DELETE ever. Enforce in Postgres:
CREATE RULE events_no_update AS ON UPDATE TO events DO INSTEAD NOTHING;
CREATE RULE events_no_delete AS ON DELETE TO events DO INSTEAD NOTHING;

-- Curation decisions: the labeled dataset. One row per human judgment.
CREATE TABLE curation_decisions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type      TEXT NOT NULL,
  entity_id        UUID NOT NULL,
  run_id           UUID,
  decision         TEXT NOT NULL,                 -- 'approved'|'rejected'|'edited_approved'
  reason_code      TEXT REFERENCES rejection_reasons(code),  -- required when rejected
  original_content JSONB NOT NULL,                -- snapshot before decision
  edited_content   JSONB,                         -- snapshot after (edits only)
  notes            TEXT,
  time_spent_ms    INT,                           -- cockpit measures this
  judge_score      NUMERIC(3,2),                  -- what the LLM judge said (calibration)
  judge_rubric     TEXT,                          -- which rubric+version scored it
  decided_by       TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_decisions_entity ON curation_decisions(entity_type, entity_id);
CREATE INDEX idx_decisions_run    ON curation_decisions(run_id);

-- The review queue is a VIEW, not a table — no state to keep in sync.
CREATE VIEW curation_queue AS
  SELECT 'profile' AS entity_type, id AS entity_id, content, quality_score,
         generation_run_id, created_at
  FROM profiles WHERE status = 'pending'
  ORDER BY created_at;
```

Phase 2 adds `judge_rubrics`; Phase 3 adds `experiments` and `golden_sets` (§4.7) — but note they only *analyze* data that `events` and `curation_decisions` are already collecting from day one. That is the entire point of shipping this migration in Phase 1.

### 4.6 Commerce

```sql
-- 0004_commerce.sql
CREATE TABLE recipes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version           INT NOT NULL DEFAULT 1,
  query_rules       JSONB NOT NULL,   -- Phase 1 supports: {entity, filters, limit, order}
  composition_rules JSONB,            -- Phase 2+: joins, ratios, sampling
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,   -- 'personality-profile-library'
  name        TEXT NOT NULL,
  description TEXT,
  recipe_id   UUID NOT NULL REFERENCES recipes(id),
  dataset_id  UUID REFERENCES datasets(id),      -- optional version pin (P2+)
  price_model JSONB NOT NULL,         -- {"per_query_usdc":0.01,"pack":{"usdc":49,"queries":5000}}
  preview_pct NUMERIC(4,3) NOT NULL DEFAULT 0.05,
  status      TEXT NOT NULL DEFAULT 'draft',     -- draft|live|retired
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE x402_payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_slug   TEXT NOT NULL,
  buyer_wallet   TEXT,
  network        TEXT NOT NULL,                  -- 'base' | 'base-sepolia'
  amount_usdc    NUMERIC(12,6) NOT NULL,
  tx_ref         TEXT,                           -- facilitator settlement reference
  query_params   JSONB,                          -- what they asked for (demand telemetry)
  rows_served    INT,
  status         TEXT NOT NULL DEFAULT 'settled',-- settled|failed|refunded
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_wallet ON x402_payments(buyer_wallet);
```

The recipe engine ships in Phase 1 deliberately (master plan had it in Phase 2) — but only with single-entity `query_rules`. This costs ~50 lines now and means "products are config" is true from the first product, not retrofitted.

### 4.7 Later-phase tables (specified now, created later)

| Table | Phase | Shape |
|---|---|---|
| `scenarios` | 2 | like profiles: content + promoted (title, category, tags) + lifecycle |
| `profile_scenario_responses` | 2 | profile_id, scenario_id, content JSONB, reasoning, emotional_arc JSONB, confidence, lifecycle cols |
| `scenario_bias_applications` | 2 | scenario_id, bias_id, activation_notes |
| `emotional_patterns` | 2 | trigger, pattern JSONB, intensity, lifecycle cols |
| `versions_changelog` | 2 | entity_type, entity_id, old_version, new_version, changes, actor |
| `judge_rubrics` | 2 | slug, version, rubric_prompt, output schema (score+rationale), status |
| `golden_sets` | 3 | slug, entity_type, params_matrix JSONB (inputs to replay), checks JSONB (§6.4) |
| `experiments` | 3 | slug, kind ('generator_ab'\|'golden_regression'\|'judge_calibration'), champion JSONB, challenger JSONB, metrics JSONB, verdict, timestamps |
| `reviews`, `attestations` | 5 | wallet-signed buyer reviews; validator signatures; on-chain tx refs |

---

## 5. Generator OS — runtime specification

### 5.1 Lifecycle

`draft` → (golden check, P3+) → `active` → `deprecated`. Editing an active generator's template, schemas, or model config is forbidden; instead insert a new row with the same slug and `version + 1` (the Lab does this automatically on "Save as new version"). Old versions stay resolvable forever because runs reference `(generator_id)` and denormalized `(slug, version)`.

### 5.2 Run execution algorithm

One function, `executeRun`, is the only writer of entities in the whole system:

```
POST /api/lab/runs {generator_slug, params, count}
 1. load newest active generator row for slug
 2. validate params against generator.params_schema (Ajv) — 400 on failure
 3. insert generation_runs row (status running); emit event generation.run_started
 4. for each batch of min(count, model_config.max_items_per_call):
    a. render prompt: template + params + batch size (§5.4)
    b. call model via generateObject with output_schema (array-wrapped)
    c. for each returned item:
       i.   run hook chain in declared order (§5.3); each hook emits hook.executed
       ii.  chain verdict: reject | pending | approved  (route hook decides)
       iii. insert entity row (content + promoted columns, status from verdict)
       iv.  insert provenance row (hashes, model, params)
       v.   emit generation.item_created
 5. update run counters, hook_summary, cost, status done; emit generation.run_completed
 6. on any throw: run status failed + error; emit generation.run_failed
```

Cost tracking: token usage from the provider response × price table in `generation/models.ts` → `cost_usd` on the run. You will want per-approved-item cost later ("this methodology yields approvable profiles at $0.011 each") — it falls out of `cost_usd / items_approved` per run, aggregable per generator version. That number is how you compare methodologies economically, not just qualitatively.

### 5.3 Hook contract

Hooks are pure-ish functions registered by name; generators compose them via config. Implement the interface once, then every future validation idea is a config edit:

```ts
// modules/hooks/types.ts
export interface HookContext {
  item: unknown;                 // parsed model output for one entity
  generator: GeneratorRow;
  run: GenerationRunRow;
  db: SupabaseClient;
  prior: HookResult[];           // results of earlier hooks in the chain
}

export interface HookResult {
  hook: string;
  passed: boolean;
  score?: number;                // 0–1 when the hook scores rather than gates
  data?: Record<string, unknown>;// diagnostics (similarity match id, KS stat, …)
  verdict?: 'reject' | 'pending' | 'approve';  // only routing hooks set this
}

export type Hook = (ctx: HookContext, config: Record<string, unknown>)
  => Promise<HookResult>;
```

Built-in hook library (Phase 1 ships the first four; Phase 2–3 the rest):

| hook | phase | behavior |
|---|---|---|
| `schema_validate` | 1 | Ajv against `output_schema`; fail ⇒ verdict reject |
| `dedup` | 1 | trigram similarity on `summary` vs approved items (`pg_trgm`, threshold config, default 0.55); flag ⇒ score 0, routing decides. Phase 3 upgrades to embedding cosine (pgvector) without config change — hook name stays `dedup` |
| `provenance_stamp` | 1 | computes hashes; always passes (it records, never gates) |
| `route` | 1 | terminal: applies `auto_approve_above` / `auto_reject_below` to mean of prior scores; default config sends everything to `pending` (human curation) |
| `llm_judge` | 2 | scores item against a rubric row (`judge_rubrics`), records score+rationale; score feeds `route` and later calibration (§6.3) |
| `distribution_check` | 3 | batch-level: KS test of trait marginals vs IPIP-NEO population norms; flags outlier items |
| `auto_tag` | 3 | cheap model call suggesting tags; never gates |

Config example stored in `generators.hooks`:

```json
[
  {"type": "schema_validate"},
  {"type": "dedup", "config": {"threshold": 0.55}},
  {"type": "provenance_stamp"},
  {"type": "route", "config": {"auto_approve_above": null, "auto_reject_below": null}}
]
```

Start with `auto_approve_above: null` — approve nothing automatically until §6.3 shows the judge agrees with you ≥ 90% of the time. Then raise the threshold with evidence, not optimism. "Automatic by default, human by exception" is the destination, not the starting point.

### 5.4 Template compilation

`{{param}}` substitution plus two conveniences: `{{#if param}}...{{/if}}` blocks and `{{json param}}` (canonical JSON embed). Nothing more — no loops, no logic. If a template needs logic, that logic belongs in `params_schema` defaults or in a new generator version. Keeping templates dumb keeps them diffable, hashable, and comparable across versions, which the whole learning loop depends on.

### 5.5 Model interface

```ts
// modules/generation/models.ts
import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';

const providers = {
  anthropic: (model: string) => anthropic(model),
  openai:    (model: string) => openai(model),
} as const;

export async function generateItems(cfg: ModelConfig, prompt: string, schema: JSONSchema7) {
  const { object, usage } = await generateObject({
    model: providers[cfg.provider](cfg.model),
    temperature: cfg.temperature,
    schema: jsonSchemaToZod(schema),     // or use ai's jsonSchema() passthrough helper
    prompt,
  });
  return { items: (object as { items: unknown[] }).items, usage };
}
```

Provider and model are data (`model_config`), so a model comparison is: bump generator version with a different `model_config`, run both against the same golden set, read the experiment result. No deploy.

---

## 6. Learning Loop — specification

The learning loop is four feedback cycles of increasing period, all fed by the same two tables (`events`, `curation_decisions`):

```
 cycle              period   consumes                    improves
 1 routing          per-item hook scores                 what reaches your eyes
 2 curation         daily    decisions + reason codes    generator prompts (you read failure modes)
 3 experimentation  weekly   goldens + experiments       prompts/models/orchestration, measured
 4 training         monthly+ SFT/DPO/classifier exports  fine-tuned models, sellable datasets
```

### 6.1 Event taxonomy

Namespaced `domain.action`, snake_case payload keys, entity refs always via columns (not payload). Emit through one helper (`learning/events.ts` — fire-and-forget, never throws into the caller, because telemetry must not break production):

| event_type | actor | payload (beyond entity/run cols) |
|---|---|---|
| `generation.run_started` | human | `{params, count}` |
| `generation.item_created` | system | `{verdict}` |
| `generation.run_completed` | system | `{items_created, cost_usd, hook_summary}` |
| `generation.run_failed` | system | `{error}` |
| `hook.executed` | hook | `{hook, passed, score, data}` |
| `curation.decided` | human | `{decision, reason_code, time_spent_ms}` |
| `judge.scored` | hook | `{rubric, rubric_version, score}` |
| `judge.overridden` | system | `{judge_score, human_decision}` — emitted when they disagree |
| `query.served` | agent | `{product_slug, filters, rows, amount_usdc, wallet}` |
| `query.unserved` | agent | `{product_slug, filters, rows_found: 0..k}` — **the demand goldmine** |
| `preview.served` | agent | `{product_slug, rows}` |
| `payment.settled` / `payment.failed` | agent | `{amount_usdc, network, tx_ref}` |
| `product.published` | human | `{product_slug, recipe_version}` |
| `generator.version_bumped` | human | `{slug, from_version, to_version, diff_summary}` |
| `dataset.frozen` | human | `{slug, version, sha256}` |
| `experiment.concluded` | system | `{slug, verdict, metrics}` (P3) |

Rules: payloads small (< 2 KB), no secrets, no full content (content lives on entities; events point at them). The spine must stay cheap enough that nobody ever hesitates to log.

### 6.2 Curation as labeling

The cockpit enforces the discipline that makes decisions machine-usable:

- **Approve** — one keystroke; logs decision + `time_spent_ms`.
- **Reject** — requires a `reason_code` (picker, one extra keystroke); `other` requires a note. Friction is deliberate and tiny.
- **Edit** — opens the content editor; on save, decision `edited_approved` stores both `original_content` and `edited_content`, entity content is replaced, `version` bumps, new provenance row (`model='human-edit'`). **Edits are the single highest-value data you produce** — each is a (worse, better) pair in identical context, exactly the shape DPO training consumes.
- `judge_score`/`judge_rubric` are stamped onto the decision row when a judge hook scored the item (P2+), so human-vs-judge agreement is one query, forever.

What the accumulating corpus yields (see §6.5 exports): quality classifiers (predict approval from content — eventually your first-pass filter), rubric material (top reason codes per generator version = the judge rubric's checklist, written from evidence), and fine-tuning sets.

### 6.3 Judge calibration (Phase 2–3)

The LLM judge is only useful if it predicts *your* judgment. Calibration is a standing query over decisions where both scores exist:

- **Agreement** = share of items where `(judge_score ≥ τ)` matches human approve/reject. Track per `(rubric, rubric_version, generator_slug)`.
- Alert when agreement over trailing 200 decisions < 0.80. Revise the rubric using the actual disagreement rows as few-shot examples (the rubric editor pre-loads them). Bump rubric version; the old one's record stays.
- `auto_approve_above` may only be raised when agreement ≥ 0.90 sustained over ≥ 300 decisions — and auto-approved items get 5% random spot-check sampling back into the queue (`curation.spot_check` events) so calibration never goes stale.

This is the mechanism that safely converts your time from "review everything" to "review the interesting 20%".

### 6.4 Golden sets and prompt CI (Phase 3)

A golden set is a frozen replay harness for one entity type: a `params_matrix` (e.g. 12 representative param combinations × 5 items each) plus `checks` — property assertions, not exact-output comparisons (LLMs aren't deterministic; properties are stable):

```json
{
  "checks": [
    {"type": "schema_pass_rate",  "min": 1.0},
    {"type": "dedup_flag_rate",   "max": 0.10},
    {"type": "judge_mean",        "rubric": "big-five-consistency", "min_vs_champion": -0.02},
    {"type": "trait_distribution","test": "ks", "norms": "ipip_neo", "min_p": 0.05},
    {"type": "cost_per_item",     "max_vs_champion": 1.25}
  ]
}
```

**Promotion rule:** a generator version reaches `active` only by passing its golden set and not losing to the current champion beyond the declared tolerances. Result stored as an `experiments` row (`kind: golden_regression`); the Lab shows a red/green diff. This is CI for prompts: system prompts and orchestration configs can only ratchet upward, and every change leaves a measured record. The same harness compares models and temperatures (`generator_ab` experiments), so orchestration choices are also evidence-based.

### 6.5 Export pipelines

Scripts in Phase 1 (`scripts/export-*.ts`), Lab UI in Phase 3. Every export freezes a `datasets` row (with hash) over the decision/event rows it consumed, so exports themselves have provenance — necessary the moment they become products (Phase 6).

- **SFT** (`export-sft.ts`) → JSONL, one line per approved item: `{"messages":[{"role":"system","content":<fixed preamble>},{"role":"user","content":<rendered prompt>},{"role":"assistant","content":<canonical content JSON>}]}`. Prompts re-rendered exactly via run params + template (replayability paying off).
- **DPO** (`export-dpo.ts`) → one line per `edited_approved`: `{"prompt":<rendered>,"chosen":<edited_content>,"rejected":<original_content>}`. Optionally augmented with (approved, rejected-same-run) pairs at lower weight.
- **Rejection classifier** (`export-reject-cls.ts`) → `{"input":<content>,"label":<reason_code or "approved">}` for training the first-pass quality filter.
- **Demand report** (`export-demand.ts`) → aggregation of `query.served`/`query.unserved` filters: top requested trait ranges, tags, scenario categories; unmet combinations ranked by frequency × recency. This is next week's generation plan, written by your customers.

### 6.6 What feeds back into system prompts and orchestration, concretely

| Signal | Feeds | Mechanism |
|---|---|---|
| reason-code frequencies per generator version | generator prompt text | weekly review: top failure mode becomes an explicit instruction/example in v+1, verified by golden run |
| edit diffs | generator prompt + few-shots | recurring edit patterns become few-shot examples in the template |
| judge disagreements | judge rubric | disagreement rows pre-loaded into rubric editor as counter-examples |
| hook pass rates per version | hook configs / chain order | e.g. dedup flag rate ↑ ⇒ raise diversity instruction or threshold |
| cost per approved item | model_config | cheaper model passes golden set ⇒ promote it; evidence, not vibes |
| unserved queries | generation backlog | demand report → run planner with pre-filled params |
| spot-check failures | auto-approve threshold | agreement drop auto-lowers `auto_approve_above` (safety ratchet) |

---

## 7. API surface

Two prefixes, one service layer. Admin routes require a Supabase session with `role=admin` (single user in Phase 1); public routes require payment (or serve free previews/catalog).

### 7.1 Lab API (`/api/lab/*`, admin)

| Route | Method | Does |
|---|---|---|
| `/api/lab/generators` | GET/POST | list; create draft |
| `/api/lab/generators/:slug/version` | POST | save-as-new-version |
| `/api/lab/runs` | POST | executeRun (§5.2) |
| `/api/lab/runs/:id` | GET | run status + counters (UI polls) |
| `/api/lab/queue` | GET | `curation_queue` view, paginated |
| `/api/lab/decisions` | POST | `{entity_type, entity_id, decision, reason_code?, edited_content?, time_spent_ms}` — writes decision, updates entity, bumps version on edit, new provenance, emits events |
| `/api/lab/entities/profiles` | GET | browse with filters (status, tags, trait ranges) |
| `/api/lab/products` | GET/POST | manage products+recipes |
| `/api/lab/stats` | GET | run history, approval rates, reason-code breakdown |

### 7.2 Public agent API (`/api/v1/*`)

| Route | Payment | Does |
|---|---|---|
| `/api/v1/products` | free | machine-readable catalog: slug, description, price_model, schema of returned records, filter params |
| `/api/v1/preview/:product` | free | deterministic ~5% sample (lowest N by content hash — stable, so agents can cache-check honesty) |
| `/api/v1/query/:product` | x402 | resolve recipe → apply request filters → serve JSON; logs `query.served` / `query.unserved` + `x402_payments` row |

Response envelope (every paid response):

```json
{
  "product": "personality-profile-library",
  "product_version": 1,
  "dataset_version": null,
  "count": 20,
  "records": [ ... ],
  "provenance": {
    "methodology": "https://<host>/methodology/big-five-profile-gen@3",
    "content_hashes": ["sha256:..."],
    "generated_by": "psychosynth",
    "synthetic": true
  }
}
```

`synthetic: true` in every payload is constitution principle #7 (honesty) made machine-readable. Pricing also appears in response headers on 402 challenges (agents budget before paying — the x402 middleware handles the challenge; we add `X-Product-Pricing` on catalog/preview responses too).

---

## 8. Repository layout

```
psychosynth/
├── supabase/
│   ├── migrations/
│   │   ├── 0001_core.sql            §4.1–4.3
│   │   ├── 0002_generator_os.sql    §4.4
│   │   ├── 0003_learning.sql        §4.5
│   │   └── 0004_commerce.sql        §4.6
│   └── seed.sql                     biases, decision_styles, rejection_reasons, generators
├── src/
│   ├── middleware.ts                x402 payment gate on /api/v1/query/*
│   ├── app/
│   │   ├── lab/
│   │   │   ├── layout.tsx           auth gate + nav
│   │   │   ├── run/page.tsx         generator picker + auto-form + run monitor
│   │   │   ├── review/page.tsx      curation cockpit (keyboard-driven)
│   │   │   └── browse/page.tsx      faceted table of approved data
│   │   └── api/
│   │       ├── lab/…                §7.1 routes
│   │       └── v1/…                 §7.2 routes
│   ├── modules/
│   │   ├── core/                    db.ts · types.ts · canonical.ts
│   │   ├── generation/              executor.ts · template.ts · models.ts
│   │   ├── hooks/                   types.ts · registry.ts · schema-validate.ts ·
│   │   │                            dedup.ts · provenance.ts · route.ts
│   │   ├── learning/                events.ts · decisions.ts
│   │   ├── recipes/                 resolver.ts
│   │   └── commerce/                pricing.ts · payments.ts
│   └── components/lab/              SchemaForm.tsx · ReviewCard.tsx · JsonEditor.tsx
├── scripts/                         export-sft.ts · export-dpo.ts · export-reject-cls.ts ·
│                                    export-demand.ts · freeze-dataset.ts
└── packages/                        (empty until P4: sdk/)
```

Import rules from §3.2 enforced with ESLint `no-restricted-imports` per folder — cheap now, priceless when the repo grows.

---

## 9. Phase 1 build guide (step by step)

Goal restated: **one autonomous agent pays real money for a query, every served byte traces to a generator run, and every operational action is already being captured as learning data.** Target: 14 working days.

### Step 0 — Accounts & prerequisites (half day)

1. Supabase project (free tier fine). Note URL + anon key + service-role key.
2. Vercel project linked to a new GitHub repo.
3. Model API key (Anthropic and/or OpenAI — both, ideally, to exercise the provider switch).
4. Coinbase Developer Platform account (facilitator) + an EVM wallet address for receiving USDC on Base. Get Base Sepolia test USDC from the CDP faucet.
5. `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=…
NEXT_PUBLIC_SUPABASE_ANON_KEY=…
SUPABASE_SERVICE_ROLE_KEY=…
ANTHROPIC_API_KEY=…
OPENAI_API_KEY=…
X402_PAYOUT_ADDRESS=0x…
X402_NETWORK=base-sepolia        # flip to 'base' on day 10
CDP_API_KEY_ID=…                 # facilitator auth (mainnet)
CDP_API_KEY_SECRET=…
```

### Step 1 — Scaffold (half day)

```bash
npx create-next-app@latest psychosynth --ts --app --eslint --tailwind
cd psychosynth
npm i @supabase/supabase-js ai @ai-sdk/anthropic @ai-sdk/openai ajv zod
npm i @x402/next @x402/core @x402/evm @coinbase/x402
npm i -D supabase
npx supabase init && npx supabase link --project-ref <ref>
```

Create the folder skeleton from §8. Add the ESLint import-boundary rules.

### Step 2 — Migrations + seed (1 day)

Write the four migration files verbatim from §4; `npx supabase db push`. Seed:

- ~20 `biases` rows (Loss Aversion, FOMO, Anchoring, Sunk Cost, Confirmation, Overconfidence, Herd Behavior, Availability, Recency, Disposition Effect, Status Quo, Endowment, Hindsight, Optimism, Framing, Gambler's Fallacy, Ostrich, Bandwagon, Authority, Dunning–Kruger) with `source` citations.
- 6 `decision_styles` (analytical, intuitive, dependent, avoidant, spontaneous, deliberative).
- `rejection_reasons` table from §4.1.
- The two seed generators from Step 6 (SQL insert of the full rows).

### Step 3 — Core module (half day)

```ts
// modules/core/canonical.ts — the one hashing implementation, used everywhere
import { createHash } from 'crypto';

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value as object).sort();
    return `{${keys.map(k =>
      `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`
    ).join(',')}}`;
  }
  return JSON.stringify(value);
}

export const sha256 = (s: string) =>
  createHash('sha256').update(s, 'utf8').digest('hex');

export const contentHash = (content: unknown) => sha256(canonicalJson(content));
```

`db.ts` exports two clients: `dbAdmin` (service role — server only) and a per-request user client for auth checks. Types in `types.ts` mirror §4 rows.

### Step 4 — Learning module first (half day)

Build the event logger *before* the executor so nothing ever ships unlogged:

```ts
// modules/learning/events.ts
import { dbAdmin } from '@/modules/core/db';

type EventInput = {
  event_type: string;
  actor_type: 'human' | 'system' | 'hook' | 'agent';
  actor_id?: string;
  entity_type?: string; entity_id?: string; run_id?: string;
  payload?: Record<string, unknown>;
};

export function emit(e: EventInput): void {
  // fire-and-forget: telemetry must never break or slow the caller
  void dbAdmin.from('events').insert({ payload: {}, ...e })
    .then(({ error }) => { if (error) console.error('[events]', error.message); });
}
```

### Step 5 — Generation runtime (2 days)

`template.ts` (§5.4 renderer + `templateHash`), `models.ts` (§5.5), `hooks/*` (the four Phase-1 hooks per §5.3 contract, plus `registry.ts` mapping name → implementation), then `executor.ts` implementing §5.2 exactly. Wire `POST /api/lab/runs` and `GET /api/lab/runs/:id`.

Executor skeleton (abridged — full logic per §5.2):

```ts
// modules/generation/executor.ts
export async function executeRun(input: { generatorSlug: string; params: Json; count: number; actorId: string }) {
  const gen = await loadActiveGenerator(input.generatorSlug);
  validateParams(gen.params_schema, input.params);              // Ajv, throws 400
  const run = await insertRun(gen, input);
  emit({ event_type: 'generation.run_started', actor_type: 'human',
         actor_id: input.actorId, run_id: run.id, payload: { params: input.params, count: input.count } });
  try {
    for (const batch of batches(input.count, gen.model_config.max_items_per_call)) {
      const prompt = renderTemplate(gen.prompt_template, { ...input.params, count: batch });
      const { items, usage } = await generateItems(gen.model_config, prompt, gen.output_schema);
      for (const item of items) {
        const results = await runHookChain(gen.hooks, { item, generator: gen, run });
        const verdict = finalVerdict(results);                  // reject|pending|approve
        const entity = await insertEntity(gen.entity_type, item, verdict, run.id);
        await insertProvenance(entity, gen, prompt, input.params);
        emit({ event_type: 'generation.item_created', actor_type: 'system',
               entity_type: gen.entity_type, entity_id: entity.id, run_id: run.id,
               payload: { verdict } });
      }
      await addUsageCost(run.id, usage, gen.model_config);
    }
    await finishRun(run.id, 'done');
  } catch (err) {
    await finishRun(run.id, 'failed', String(err));
    emit({ event_type: 'generation.run_failed', actor_type: 'system', run_id: run.id,
           payload: { error: String(err) } });
    throw err;
  }
}
```

`insertEntity` maps `content` → promoted columns per entity type (Phase 1: profiles only; the mapping table lives beside it so Phase 2 adds scenarios by adding one mapping, not touching the executor).

### Step 6 — Seed generators (1 day, mostly prompt writing)

Two rows. The profile generator in full (this template is the actual Phase-1 methodology, iterate on it as data comes in):

```json
{
  "slug": "big-five-profile-gen", "version": 1, "entity_type": "profile",
  "model_config": {"provider": "anthropic", "model": "claude-sonnet-4-5",
                    "temperature": 0.9, "max_items_per_call": 10},
  "params_schema": {
    "type": "object",
    "properties": {
      "count":        {"type": "integer", "minimum": 1, "maximum": 100, "default": 20},
      "domain":       {"type": "string", "enum": ["general","trading","negotiation","social","workplace"], "default": "general"},
      "trait_skew":   {"type": "string", "enum": ["none","high_neuroticism","high_openness","low_agreeableness","high_conscientiousness"], "default": "none"},
      "extra_instructions": {"type": "string", "default": ""}
    },
    "required": ["count", "domain"]
  },
  "hooks": [
    {"type": "schema_validate"},
    {"type": "dedup", "config": {"threshold": 0.55}},
    {"type": "provenance_stamp"},
    {"type": "route", "config": {"auto_approve_above": null, "auto_reject_below": null}}
  ]
}
```

Prompt template (stored in `prompt_template`):

```
You are a psychometric data engineer generating synthetic personality profiles
grounded in the Five-Factor Model as operationalized by the IPIP-NEO instrument.

Generate {{count}} synthetic profiles for the domain: {{domain}}.
{{#if trait_skew}}Population skew: {{trait_skew}} — shift that trait's mean by
+0.15–0.25 (or − for "low_"), keep others population-typical.{{/if}}

Requirements per profile:
1. big_five: five scores in [0,1], internally coherent, avoiding uniform or
   extreme-only vectors. Across the batch, scores should approximate a normal
   distribution (mean ≈ 0.5, sd ≈ 0.15 per trait) unless skewed above.
2. summary: 2–3 sentences describing how this person thinks and decides —
   specific, behavioral, never generic. No names, no demographics.
3. decision_style: one of analytical | intuitive | dependent | avoidant |
   spontaneous | deliberative, consistent with the trait vector.
4. mbti_label: the closest MBTI type derived from the Big Five vector
   (E/I from extraversion, N/S from openness, T/F from agreeableness,
   J/P from conscientiousness). This is a cosmetic label.
5. suggested_biases: 2–4 objects {slug, strength} drawn ONLY from this list:
   {{json bias_slugs}} — strengths in [0,1] justified by the trait vector
   (e.g. high neuroticism supports loss-aversion strength > 0.6).
6. tags: 3–6 lowercase tags including "{{domain}}".

{{extra_instructions}}

Return JSON: {"items": [ ...profiles ]}. No commentary.
```

Note: `bias_slugs` is a *system param* the executor injects at render time (all approved bias slugs from the DB); it is not in `params_schema`. The renderer documents a small reserved-param set (`bias_slugs`, `count`) so generators can rely on them.

`output_schema` requires exactly those fields with ranges/enums (write it as strict JSON Schema; `additionalProperties: false`). The second generator, `bias-linker-gen@1`, takes an existing approved profile as a param and proposes refined `profile_bias_links` rows — exercising the "generator consuming existing entities" pattern that Phase 2's `response-gen` depends on. `suggested_biases` from the profile generator are written to `profile_bias_links` at insert (strength from the model), so profiles are sellable with bias links from run one; the linker refines.

### Step 7 — Lab v0 (2–3 days)

Three pages, deliberately plain. The only component worth real effort is the review cockpit — you will live in it.

- **Run** (`/lab/run`): generator dropdown → `SchemaForm` (recursive renderer over `params_schema`: string→input, enum→select, integer/number→number input, boolean→checkbox, array-of-string→tag input; ~120 lines, no library needed) → POST → poll run status, show counters and per-hook pass rates as they update.
- **Review** (`/lab/review`): fetch queue page; card renders `content` prettily (trait bars, summary, bias chips) + hook diagnostics. Keys: **A** approve · **R** reject (reason-code palette, 1–8 keys) · **E** edit (JSON editor pre-filled; save = `edited_approved`) · **J/K** next/prev. A visible `time_spent` timer per card writes `time_spent_ms`. Every action → `POST /api/lab/decisions`.
- **Browse** (`/lab/browse`): approved entities table; filter by tags, trait ranges (min/max inputs), status; row click → full content + provenance chain (run → generator@version → prompt hash).

The decisions route is the learning loop's front door — it must atomically: insert `curation_decisions`, update entity (`status`, or content+version on edit), insert new provenance on edit, emit `curation.decided`. Use one Postgres function (`rpc`) for atomicity.

### Step 8 — Generate + curate the corpus (2 days, overlaps 7)

Runs of 20–50 across domains (`general`, `trading`, `negotiation`, `social`) and skews. Target **300–500 approved profiles**. Expect to reject 20–40% early — that is the learning loop eating its first meal: watch reason-code frequencies in `/lab/stats`, fix the prompt, bump generator version, compare approval rates between versions (your first informal experiment, and the habit §6.4 later formalizes).

### Step 9 — Product + recipe + public API (1 day)

```sql
INSERT INTO recipes (query_rules) VALUES
('{"entity":"profile","filters":{"status":"approved"},
   "allow_request_filters":["tags","big_five_min","big_five_max","decision_style","mbti_label"],
   "default_limit":20,"max_limit":100}');

INSERT INTO products (slug,name,recipe_id,price_model,status) VALUES
('personality-profile-library','Personality Profile Library', <recipe-id>,
 '{"per_query_usdc":0.01,"pack":{"usdc":49,"queries":5000}}','live');
```

`recipes/resolver.ts` (Phase-1 scope): translate `query_rules` + whitelisted request filters into a parameterized Supabase query. Big-Five range filters map to JSONB comparisons (`(big_five->>'openness')::numeric >= $x`). Never interpolate raw request values — whitelist keys, parameterize values. Wire `/api/v1/products`, `/api/v1/preview/:product` (lowest-N-by-hash sample), `/api/v1/query/:product` (resolver + envelope §7.2 + `query.served`/`query.unserved` events + `x402_payments` row from middleware context).

### Step 10 — Payment gate + first transaction (2 days)

```ts
// src/middleware.ts  — verify exact API shape against docs.x402.org when building
import { paymentMiddleware } from '@x402/next';
import { facilitator } from '@coinbase/x402';

export const middleware = paymentMiddleware(
  process.env.X402_PAYOUT_ADDRESS!,
  {
    '/api/v1/query/personality-profile-library': {
      price: '$0.01',
      network: process.env.X402_NETWORK!,          // base-sepolia → base
      config: { description: 'Synthetic Big Five personality profiles, per query' },
    },
  },
  facilitator,
);
export const config = { matcher: ['/api/v1/query/:path*'] };
```

Test buyer: a 30-line script using `x402-fetch` (or the current client helper) with a funded test wallet — request → 402 → pay → 200. That script becomes the SDK seed and the README example. Then: flip `X402_NETWORK=base`, fund payout address checks, real $0.01 transaction from a wallet you didn't pre-authorize interactively. **Exit criteria met when:** (a) unassisted paid query on mainnet; (b) for any served profile you can produce generator version, prompt hash, template hash, and content hash; (c) `/lab/stats` shows reason-code and approval-rate breakdowns computed *from events and decisions*, proving the loop records itself.

### Phase 1 explicitly excludes

LLM judge hook (P2), embeddings dedup (P3), experiments/goldens UI (P3), MCP/SDK (P4), Solana (P5), packs redemption flow (sell per-query only until a buyer asks — pack rows exist in `price_model` but redemption tokens are P2), scenario tables (P2). Resist all of it; the loop closes first.

---

## 10. Phases 2–7

Compounding rule unchanged: each phase deploys independently, plugs into layers below, never rewrites them. Each phase now also states **what the learning loop gains** — the lab lens on every expansion.

### Phase 2 — Relational compounding + recipe DSL + judge

- **Build**: `scenarios`, `profile_scenario_responses`, `scenario_bias_applications`, `emotional_patterns`, `versions_changelog` tables. Generators `scenario-gen@1` and `response-gen@1` (takes an approved profile + scenario as params — old personalities conditioned on new situations at zero new-personality cost). Recipe DSL v2: joins + composition ratios; resolver extended. Products 2 (Behavioral Scenario Library) and 3 (Trading Psychology Suite) as recipe rows. `llm_judge` hook + `judge_rubrics` table (first rubric: `big-five-consistency`, written from Phase-1 reason-code data). Pack redemption (signed query-credit tokens).
- **Learning gains**: judge scores start accumulating beside human decisions → calibration data (§6.3) builds passively. Demand telemetry now spans three products.
- **Exit**: Product 4 (Cognitive Bias Simulator) defined as one `products`+`recipes` row, zero backend code; a second distinct paying agent; ≥ 500 decisions carry judge scores.

### Phase 3 — Lab OS + Learning Loop v1 (pulled forward — a lab needs this early)

- **Build**: Generator Studio (create/edit/version, live run monitor, version diffs), Curation Cockpit v2 (bulk ops, spot-check sampling), Data Explorer (faceted, trait sliders), Dataset Manager (freeze/compare/hash), Product Builder (visual recipe composer + live preview). Learning surfaces: `experiments` + `golden_sets` tables and runner (§6.4), promotion rule enforced in Studio ("activate" requires green golden run), calibration dashboard (§6.3), demand dashboard (unmet queries → one-click prefilled run), reason-code analytics. Hook upgrades: embeddings dedup (pgvector), `distribution_check` vs IPIP-NEO norms, `auto_tag`. Batch runs move to queued jobs.
- **Learning gains**: the loop becomes *operational* — prompts change only via measured experiments; auto-approve turns on where calibration clears 0.90; exports get a UI.
- **Exit**: a generator version promoted via golden regression with recorded experiment; auto-approve live for ≥ 1 generator with spot-checks flowing; new batch + new product shipped end-to-end without SQL.

### Phase 4 — Agent-native discovery

- **Build**: MCP server exposing catalog/preview/query/pay as tools; `psychosynth-sdk` (TS + Python) grown from the Step-10 buyer script (402 handshake automated); OpenAPI spec + schema.org markup; listings: x402 registries (Coinbase discovery), MCP registry, Solana Agent Kit plugin, Eliza plugin, LangChain community tools; Agent Playground (public demo: mock trading bot buys a risk-averse profile mid-run when volatility spikes, visibly changes behavior).
- **Learning gains**: `query.*` events now come from strangers — demand telemetry becomes market research. Playground interactions logged as funnel events.
- **Exit**: first revenue from an agent/developer you never contacted.

### Phase 5 — Commerce & trust hardening

- **Build**: Solana payment mirror (same endpoints, second rail); session pre-authorization; receipts + refunds; metering + per-wallet spend dashboards; rate limiting + anomaly detection on the events spine (it already has every request). Trust: platform signing key live (fills `provenance.signature`), dataset + methodology hashes published to a lightweight Solana registry program, wallet-signed buyer `reviews`, `attestations` from academic spot-checks (Union Nikola Tesla), escrow for large bundles.
- **Learning gains**: buyer reviews join quality signals; anomaly detection is the events spine's first adversarial consumer.
- **Exit**: traffic could 10× without payment-code changes; any buyer can verify purchase hashes on-chain at runtime.

### Phase 6 — Composition engine + the loop's byproducts become products

- **Build**: query-time composition DSL ("200 profiles, openness ≥ 0.7, high loss-aversion links, responding to crypto_volatility scenarios, seed 42") → compiled joins → statistical filters → frozen signed dataset with fresh methodology hash; **byte-determinism guaranteed here** (sampling in our code — the honest determinism claim from §2). Products 5–7 as recipes (Negotiation Dynamics, Emotional Response Pack, Benchmark & Eval Sets). **New product class from the Learning Loop**: curated SFT/DPO fine-tuning sets and eval/benchmark suites exported from §6.5 pipelines — provenance-stamped, dataset-frozen, sold through the same recipe engine (they are just datasets). Custom bundles via Virtuals ACP (request → negotiate → escrow → deliver → evaluate).
- **Exit**: a benchmark customer reproduces a dataset byte-for-byte from seed + versions; first ACP engagement; first sale of a learning-byproduct dataset.

### Phase 7 — Public Lab + ecosystem

- **Build**: public read-only Lab (explore profiles, methodology pages rendered from generator rows + golden results — the transparency is literally the internal tooling made public); free tier → paid API → premium curation funnel; arXiv methodology preprint (the experiments table *is* the paper's results section); community curation with revenue share for verified academic contributors (their decisions enter `curation_decisions` with `decided_by`, calibrated like judges); scale work (read replicas, edge caching, multi-chain settlement).
- **Exit**: revenue from untouched channels; methodology cited; system self-sustaining.

---

## 11. Metrics & operating cadence

| Phase | Key metric | Target |
|---|---|---|
| 1 | first unassisted paid query · % entities with full provenance | week 4 · 100% |
| 2 | products live · 2nd paying agent · decisions with judge scores | 3 · week 8 · 500+ |
| 3 | prompt changes via experiments · judge agreement · auto-approve share | 100% · ≥0.85 · ≥30% |
| 4 | agent wallets · first organic sale | 100 · week 16 |
| 5 | MRR · verifiable datasets on-chain | $1,000 · all live products |
| 6 | reproducible benchmark customers · byproduct dataset sales | 3 · 1+ |
| 7 | wallets · MRR · citations | 10,000 · $10k · 1 preprint |

**Weekly lab cadence** (30 minutes, from `/lab/stats` — this habit *is* the learning loop):

1. Reason-code leaderboard per generator version → worst failure mode → prompt fix → version bump (→ golden run from P3).
2. Judge agreement trend (P2+) → rubric revision if < 0.85.
3. Demand report → next week's generation runs.
4. Cost per approved item per generator version → model/config experiments if drifting up.

---

## 12. Design principles (constitution v2)

1. **Everything is versioned** — never overwrite; bump and log.
2. **Everything is composable** — products are recipes; no product ever gets a table.
3. **Everything is traceable** — entity → run → generator@version → prompt hash → content hash. Runs are provenance.
4. **Everything is API-first** — dashboards and agents consume the same endpoints; no private backdoor.
5. **Everything is automatic by default, human by exception** — hook chains route; humans see what earns their attention. *Amended: automation levels are earned through calibration evidence, never assumed.*
6. **Everything is reproducible** — generation is fully replayable; composition is byte-deterministic. Claim each precisely.
7. **Everything is honest** — `synthetic: true` in every payload; misuse-focused ToS; no deterministic-generation claims.
8. **Everything is a lesson** *(new)* — every run, decision, edit, query, and payment lands in the events spine or decisions table in a machine-learnable shape. If an action taught you something and left no row behind, the system is broken. The lab's own operation is its most defensible dataset.

---

## 13. Immediate next actions

1. Step 0–2 of §9 (accounts, scaffold, migrations + seed) — everything else depends on them.
2. Write the strict `output_schema` for `big-five-profile-gen@1` (the one deliberately-omitted artifact here; write it against §9 Step 6's field list, `additionalProperties: false`).
3. First run of 20 profiles on Base Sepolia money-path by end of week 1; corpus + mainnet transaction by end of week 2 (§9 Step 10 exit criteria).

