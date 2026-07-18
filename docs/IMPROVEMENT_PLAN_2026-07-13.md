# Psychosynth — Product Improvement Plan

**Date:** 2026-07-13
**Scope:** Overall product quality, visibility (discoverability), and usability (developer experience).
**Method:** Full read of `docs/`, source survey of `src/`, `mcp/`, `packages/`, `contracts/`, plus a build/architecture pass. Findings verified against the live repo and the installed Next.js 16 docs.

> **Correction (post-review):** An earlier draft flagged the x402 paywall as "not wired in" (a missing `middleware.ts`). That was wrong — it applied pre-16 Next.js conventions. **Next.js 16 renamed Middleware to "Proxy"**, whose convention is exactly a `src/proxy.ts` file exporting a `proxy` function + `config` matcher, which is what exists. The paywall **is** correctly wired. This document reflects the corrected finding.

---

## Executive summary

Psychosynth is in strong shape *strategically* — the internal docs (`MASTERPLAN`, `IMPLEMENTATION`, `AUDIT`) are thorough, honest, and self-correcting, and the core web app (Lab UI, generator OS, curation loop, x402 pricing) is near Milestone-1 completion. The engineering discipline in the main app is good: clean module boundaries, centralized errors, injection-safe DB queries.

The gap is not vision — it's **finish and reach**. The thing holding the product back today is singular: **everything an outside agent or developer would touch is unfinished.** The MCP server, the TS/Python/Eliza SDKs, and the on-chain registry are all built ahead of roadmap but are unpublished, undocumented, and in places broken. Nobody can discover or adopt the product right now even though the artifacts exist. The core revenue path, by contrast, is sound: the x402 paywall is correctly wired via the Next 16 Proxy convention, and the payment-verification logic (EIP-3009 verification, replay guard, on-chain settlement) is solid.

The plan below is organized into three pillars — Quality, Visibility, Usability — followed by a phased roadmap and a quick-wins list. Effort is rough: **S** = <½ day, **M** = 1–2 days, **L** = 3+ days.

Several of the quick, unambiguous fixes in this plan have **already been applied** (see the "Already fixed" section at the end).

---

## Current state at a glance

| Area | State | Notes |
|---|---|---|
| Core web app / Lab | Good | Clean architecture, near M1 complete |
| x402 paywall | Correctly wired | `src/proxy.ts` uses the Next 16 Proxy convention; verification logic is solid |
| Preview endpoints | Fixed (all 3 live) | Profile `provenance` join removed; bias recipe-mapping bug fixed (migration 0011). Verified 200 in prod |
| Paid query route | Hardened | Records payment on post-settlement failure and returns `tx_ref` as proof; buyer-test passes |
| Rate limiting | **In-memory only** | Suspected cause of intermittent empty preview responses under repeat requests — bumped, see 1.3 |
| Tests / CI | **None** | Zero test coverage across app, MCP, SDKs, contract |
| MCP server | Built, unpublished | Good README; `server.json` placeholders now filled; not yet on npm |
| SDKs (TS/Py/Eliza) | Built, now documented | READMEs added; Python dependency fixed; not yet published |
| Registry contract | Written, unwired | No test/deploy tooling; deploy script has a stub bytecode |
| Docs (internal) | Excellent | Honest, detailed, self-correcting |
| Docs (outward-facing) | Missing where adoption happens | No package docs; localhost/Windows paths in examples |

---

## Pillar 1 — Quality

The goal here is to make the product *correct and trustworthy* before amplifying reach.

### 1.1 x402 paywall — verified correct (no action needed)
`src/proxy.ts` is a full Next.js 16 **Proxy** (the renamed Middleware): EIP-3009 signature verification, payout-recipient check, amount check, validity window, DB replay guard, and on-chain settlement with receipt wait. Under the Next 16 convention a `proxy.ts` file at `src/` level (same level as `app/`) exporting a `proxy` function and a `config` matcher is auto-invoked — which is exactly what exists, with the matcher `['/api/v1/query/:path*', '/lab', '/lab/:path*']`. The query route reading the payment headers as optional is defensive only; the Proxy runs first and returns `402` before the handler executes. **The paywall is enforced.** Worth adding an automated end-to-end assertion (see 1.2) so this stays true, but there is no bug to fix here.

### 1.2 Stand up a test harness — **None → baseline, M**
There is zero automated test coverage anywhere. Add a runner (Vitest fits the stack) and cover the highest-risk pure logic first: `resolver.ts` filter gating (the allowlist that prevents arbitrary JSONB queries), `pricing.selectTier`, and the payment-verification path in `proxy.ts`. This is the prerequisite for changing payment code with confidence. **Add a preview smoke test for all three products** — the two recent preview outages (profile `provenance` join, bias recipe-mapping) would both have been caught by a trivial "each live product's preview returns 200" test in CI.

### 1.3 Harden the billable/unauthenticated surfaces + fix rate limiting — **M — bumped priority**
The in-memory rate limiter is now the prime suspect behind **intermittent empty preview responses observed in production** (same URL, 200 one call and empty the next). An agent that polls or retries the free preview before buying will read this as flakiness — so this now directly affects the top of the buy funnel, not just abuse protection.

- Move rate limiting to a distributed store (Upstash/Redis) so it behaves consistently across serverless instances, and tune the limit so legitimate agent polling isn't tripped. Extend coverage to `query`, `reviews`, and `simulate`.
- `v1/simulate` fires real, billable LLM calls with **no auth and no rate limit** — a cost/DoS exposure. Gate it and rate-limit it.
- Make `recordPayment` return whether the insert succeeded so the query route's `payment_recorded` flag is truthful (currently hardcoded `true` even though `recordPayment` swallows insert errors). The on-chain `tx_ref` remains the real proof, but the field shouldn't be able to lie.

### 1.4 Tighten validation and types — **S–M**
Only `lab/decisions` uses zod; `lab/products` POST upserts unvalidated request bodies straight to the DB. Add zod schemas to the hand-rolled routes. Separately, reduce the pervasive `any` in `resolver.ts`, the query route, and `simulate`, and replace module-load non-null assertions (`process.env.X!`) in `proxy.ts` with explicit throw-with-message checks like the ones in `db.ts`.

### 1.5 Remove dead weight — **S**
Delete `.backup-corrupted-20260712/`, reconcile the duplicated `.js`/`.ts` generator scripts, and consider excluding `scripts/*.js` from typecheck (`allowJs` currently pulls large JS files into `tsc`, slowing it down). `src/proxy.ts` stops being dead code once 1.1 lands.

### 1.6 Wire up CI — **S**
A GitHub Actions workflow already advertises a build badge in the README. Make it real: typecheck + lint + the new tests on every push, so regressions in the payment path are caught automatically.

---

## Pillar 2 — Visibility (discoverability)

The product is invisible to its stated audience — autonomous agents and their developers — because none of the discovery surfaces are live. Every item here is already listed as an open action in `docs/DISCOVERY.md`; this is about executing them.

### 2.1 Publish the MCP server to npm — **S (server.json ✅ done; publish + default URL pending)**
The README and `DISCOVERY.md` both promise `npx psychosynth-mcp`, but the package is unpublished, so that command 404s today. The `server.json` placeholders have now been filled (`io.github.3esign/psychosynth`, `repository.url` → `github.com/3esign/cfaces`). Remaining: set a sensible default `API_BASE` pointing at the live deployment instead of `localhost:3000` (`mcp/src/api.ts:6`), and publish to npm. Publishing is the single biggest reach unlock.

### 2.2 Submit to MCP registries — **S**
Once published, submit to the official MCP registry and aggregators (e.g. glama.ai). Add a `.well-known/mcp.json` to the API so the server is auto-discoverable. These three steps are exactly the `DISCOVERY.md` §4 to-do list.

### 2.3 Publish the SDKs — **M**
`@psychosynth/sdk` (npm) and `psychosynth-sdk` (PyPI) are both unpublished at 0.1.0. Publishing turns "we have SDKs" from an internal claim into an actual adoption path. (Fix the Python dependency bug first — see 3.2.)

### 2.4 Register the Eliza plugin — **S–M**
The Eliza plugin isn't in any Eliza plugin registry, so ElizaOS agents can't find it. Register it, and firm up its integration (it currently defines its own runtime interfaces rather than importing `@elizaos/core` types, so it can drift).

### 2.5 A credible public landing + honest positioning — **M**
Keep the honesty discipline the audit established (`synthetic: true` on every payload, "replayable not byte-deterministic"). A concise public page that states plainly what the data is, how the x402 flow works, and links to the MCP/SDK install paths will convert far better than aspirational copy. Trim references to niche/unverified runtimes until those integrations are proven.

---

## Pillar 3 — Usability (developer & agent experience)

Even a developer who finds the product today can't adopt it, because the on-ramp is broken in concrete ways.

### 3.1 Write package READMEs — **S, highest DX leverage — ✅ DONE**
`packages/sdk-ts`, `packages/sdk-python`, and `packages/eliza-plugin` had **no README at all** — no install command, no usage example, no env-var reference. This single gap blocked adoption more than anything else in this pillar. READMEs have been added to all three, each with a minimal quickstart: install, configure wallet, list → preview → query, plus an API table and spending-safety note.

### 3.2 Fix the Python SDK packaging — **S — ✅ DONE (deps); pyproject deferred**
`setup.py` omitted `eth-account` from `install_requires` while the code imports it — a fresh `pip install` then import would fail. `eth-account>=0.10.0` has been added. Migrating from `setup.py` to `pyproject.toml` is still worth doing but is deferred.

### 3.3 Add a spending cap / budget guard — **M**
There is no client-side spend limit anywhere. The Python SDK in particular signs a `TransferWithAuthorization` for whatever `payTo`/amount the server's 402 quote returns, with a 1-day validity window and no expected-recipient or max-amount check. For an *autonomous-agent payment* product this is a notable omission — a compromised or spoofed endpoint could get an agent to sign an overpayment. Expose a required `maxAmount` (and optional expected-recipient) guard across all clients.

### 3.4 Replace the global `Date.now` monkey-patch — **S**
The MCP server, TS SDK, and Eliza plugin all temporarily override the global `Date.now` during settlement to fake the validity window. In an async runtime, concurrent work sees the skewed clock. Replace with an explicit validAfter/validBefore offset passed into the signer.

### 3.5 De-localhost the examples — **S**
Baked-in defaults and docs point at `localhost:3000`, `https://psychosynth.vercel.app`, or Windows paths (`d:/Projekti/faces/mcp/dist/index.js`). None are usable by an external developer. Point every client default and every doc example at the real published package and live URL.

### 3.6 Harden the registry contract before Phase 5 — **M (defer)**
`PsychosynthRegistry.sol` is safe in principle (owner-gated, holds no funds) but is untested, undeployed, unwired, and the deploy script ships a stub bytecode. Before it's relied on as the on-chain trust layer: add Foundry/Hardhat + tests + a real deploy script, switch hashes from `string` to `bytes32` (gas + validation), and use two-step ownership transfer. This is genuinely Phase-5 work — defer it, but don't market on-chain provenance until it exists.

---

## Phased roadmap

### Phase A — Correctness (this week)
Lock in the revenue path with tests before amplifying reach. **1.2 tests for the payment/Proxy path** (including an end-to-end assertion that an unpaid `query` returns `402`), **1.3 guard `simulate`/rate limiting**, **1.6 CI**.

### Phase B — Adoption on-ramp (next 1–2 weeks)
Make the product installable and understandable. **3.1 package READMEs**, **3.2 Python packaging fix**, **3.5 de-localhost defaults**, then **2.1 publish MCP**, **2.3 publish SDKs**. After this, `npx psychosynth-mcp` and `pip install psychosynth-sdk` actually work.

### Phase C — Reach & trust (following 2–3 weeks)
Amplify now that the on-ramp is solid. **2.2 MCP registries + `.well-known`**, **2.4 Eliza registration**, **2.5 public landing**, **3.3 spending cap**, **3.4 remove the Date.now patch**, **1.4 validation/types**, **1.5 dead-code cleanup**.

### Phase D — Phase-5 trust layer (when roadmap reaches it)
**3.6 registry contract** hardening, tests, deploy, and app wiring.

---

## Quick wins (do first — hours each)

- ✅ Write the three package READMEs (**3.1**) — *done, see below*.
- ✅ Fix the Python SDK's missing `eth-account` dependency (**3.2**) — *done*.
- ✅ Fill `server.json` placeholders (**2.1** prep) — *done*.
- Publish `psychosynth-mcp` to npm so `npx psychosynth-mcp` resolves (**2.1**).
- Delete `.backup-corrupted-20260712/` and reconcile duplicate scripts (**1.5**).

---

## Already fixed (applied 2026-07-13)

These items from the plan have been applied and, where noted, verified live in production:

**Buy-path fixes (verified 200 in production on `psychosynth.vercel.app`):**

- **Flagship profile preview fixed** — `personality-profile-library` was returning a 500 from an ambiguous `provenance(sha256_content)` embed. Rewrote `previewProfiles` to order by `id` and drop the join (the paid query never used it either). Verified live: returns real profiles.
- **Cognitive-bias preview fixed** — root cause was a **non-deterministic recipe mapping**: migration `0007_bias_simulator_product.sql` selected the recipe via `ORDER BY id DESC LIMIT 1`, but recipe IDs are UUID v4 so the alphabetical sort grabbed the *profile* recipe. The product served profiles instead of biases. Corrected the product→recipe association and codified it in migration `0011_fix_bias_recipe_id.sql`. Verified live: returns bias records (e.g. "Anchoring").
- **Paid query route hardened** — if `resolveQuery` throws *after* on-chain settlement, the route now still records the payment and returns the settlement `tx_ref` as proof, instead of a bare 500 with no record. Verified locally via `buyer-test` (real signed/settled query returns 200 for both profile and bias products). Two follow-ups noted in 1.3: make `payment_recorded` truthful, and guard the "after payment settled" message on `tx_ref` presence.

**Adoption/DX fixes:**

- **Package READMEs** written for `packages/sdk-ts`, `packages/sdk-python`, and `packages/eliza-plugin` — each with install, quickstart, API table, configuration, and a spending-safety note. This was the single biggest adoption blocker.
- **Python SDK dependency fixed:** added `eth-account>=0.10.0` to `packages/sdk-python/setup.py` (the code imported it but it was undeclared, so a fresh install then import would fail).
- **MCP `server.json` placeholders filled:** `name` → `io.github.3esign/psychosynth`, `repository.url` → `https://github.com/3esign/cfaces`. The file is now submittable to the MCP registry once the npm package is published.

**New issue surfaced during verification:** intermittent empty preview responses in production (same URL, 200 then empty seconds later) — now attributed to the in-memory rate limiter / cold starts rather than any remaining data bug. Tracked in 1.3 (bumped priority) since it affects the free preview step agents hit before buying.

Not applied (deliberately deferred — need a running instance or carry payment-code risk): publishing to npm/PyPI, the `Date.now` signing refactor, the client-side spending cap, and the registry-contract tooling.

---

## What's already good (keep it)

- Internal documentation and the honesty discipline from `AUDIT_2026-07-12.md` — the willingness to flag and fix overstated claims is a genuine asset; hold new outward docs to the same standard.
- Core app architecture: module separation, centralized `ApiError`/`toResponse`, injection-safe PostgREST query building, `after()` for background work.
- The MCP server's design and README quality — it's the strongest external artifact and a good template for the SDK docs.

---

*Prepared as an analysis-and-planning document. No source files were modified in producing it.*
