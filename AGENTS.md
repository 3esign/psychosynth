<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Contributor contract — READ FIRST

There are two strictly separated lanes of work in this repo:

- **"Add data"** → you only populate content through the authored pipeline.
  Follow **`docs/DATA_CONTRIBUTION.md` Lane 1**. No edits to `src/**`, no new
  tables, no filter/pricing/scoring changes — SQL batches under `outputs/`,
  quality-gated and seeded.
- **"Play with the methodology"** → algorithms, resolver filters, scoring,
  generators, catalog, payments. Follow **`docs/DATA_CONTRIBUTION.md` Lane 2**:
  versioned rows over rewrites, tests + typecheck + `scripts/smoke.sh` gates,
  `buyer-test` for anything on the paid path.

If a task seems to need both lanes, split it into two change sets and land the
methodology change (with its gates) before the data batch that depends on it.

Key references: `docs/DATA_ENRICHMENT.md` (pipeline), `docs/ROADMAP_ENRICHMENT.md`
(planned packs), `GO_LIVE.md` (deploy/apply/verify), `docs/archive/DB_AUDIT_2026-07-18.md`
(security invariants).
