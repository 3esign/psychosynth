# Psychosynth × Virtuals — ACP Provider Integration Plan

Status: proposal / design. Targets Virtuals **Agent Commerce Protocol (ACP) v2**
(production on Base mainnet since Apr 2026). Nothing here is wired yet.

---

## TL;DR

Register Psychosynth as an ACP **Provider** so the ~2,000+ agents in the
Virtuals economy can discover and buy our data via on-chain USDC escrow — on the
same Base rails we already settle on. This is **additive to x402, not a
replacement**: x402 stays the cheap inline pay-per-call path; ACP is the
job-based, escrowed, evaluator-verified path that gives unfamiliar buyer agents
a trust guarantee (funds refund on SLA miss). We reuse the recipe resolver,
pricing, products table, provenance, and Base payout wallet almost verbatim; the
net-new work is a small **long-running ACP worker** plus a **delivery endpoint**.

---

## Why ACP complements x402 (keep both)

| | x402 (have) | ACP (add) |
|---|---|---|
| Model | Inline HTTP 402 pay-per-call | Job: request → negotiate → escrow → deliver → evaluate |
| Trust | Buyer pays then gets data | Funds held in on-chain escrow; refunded if we miss SLA |
| Best for | Cheap, high-frequency single queries | Higher-value pack jobs; buyers who don't know us yet |
| Discovery | MCP / Bankr skill / our discovery endpoint | Virtuals **Service Registry** (native agent marketplace) |
| Chain / asset | Base + Solana, USDC | Base mainnet, USDC |

Same wallet, same asset, same data — a second storefront in the largest agent
marketplace. Buyers choose their rail; we serve the same `resolveQuery` output.

---

## How ACP works (provider view)

Four phases, escrow-backed, using `@virtuals-protocol/acp-node` (TypeScript — fits our stack):

1. **Request** — a buyer agent opens a job against one of our **job offerings**.
2. **Negotiation** — buyer sends a `requirement` (JSON matching the offering's
   schema); we respond with a **budget** (price). A signed Proof of Agreement is created.
3. **Transaction** — buyer **funds** USDC into on-chain escrow; we **submit** the
   deliverable.
4. **Evaluation** — an evaluator (self-eval for us initially) checks the delivery
   against the agreed terms; on approval, **escrow releases USDC to our wallet**;
   on failure/expiry it **refunds the buyer**.

Roles: **Client** (buyer) · **Provider** (us) · **Evaluator**.

---

## What we already have that maps 1:1

| ACP concept | Psychosynth asset (reused as-is) |
|---|---|
| Job offering | A row in `products` (`slug`, `name`, `price_model`, `recipe_id`) |
| Requirement schema | The recipe's `allow_request_filters` (tags, decision_style, dark_triad, prospect_theory, …) |
| Budget / price | `selectTier(price_model, params)` + `listTiers` in `modules/commerce/pricing.ts` |
| Deliverable content | `resolveQuery(rules, params)` in `modules/recipes/resolver.ts` — already produces the records |
| Verifiable delivery | `provenance` (`sha256_content`, model, hashes) — feeds the evaluator |
| Settlement wallet | Our Base payout wallet (`X402_PAYOUT_ADDRESS`) as the release destination |

The core insight: **`resolveQuery` is the whole product**. ACP is just a second
transport in front of it. We are not rebuilding the marketplace — we are adding a
listener and a delivery route.

---

## Target architecture

```
Virtuals Service Registry  ──discovers──▶  Psychosynth ACP Provider
                                                 │
   (buyer agent opens job) ─────────────────────▶│  ACP worker  (long-running Node process)
                                                 │   • @virtuals-protocol/acp-node
   requirement (filters JSON) ───negotiate──────▶│   • setBudget = selectTier(price_model, req)
   fund USDC → escrow (Base) ───────────────────▶│   • on "job.funded":
                                                 │        resolveQuery(recipe, req)  ← REUSE
                                                 │        write payload → Supabase Storage (signed, short TTL)
                                                 │        session.submit(signedUrl)
   evaluator.complete() ── releases USDC ───────▶│        → our Base wallet
                                                 │
                                     shares Supabase DB + resolver with the Next app
```

The Next.js app on Vercel is unchanged for x402. The ACP worker is a **separate,
always-on process** (see Hosting note) that imports the same resolver/pricing
modules and talks to the same Supabase.

---

## Product → Job Offering mapping

Create one offering per live product; the requirement schema mirrors each
recipe's `allow_request_filters`.

| Product (`products.slug`) | Offering | Requirement fields | Price source |
|---|---|---|---|
| `personality-profile-library` | Big Five / Dark Triad / prospect-theory profiles | tags, decision_style, mbti_label, big_five_{min,max}, {mach,narc,psych}_{min,max}, lambda/alpha/beta, system_preference, crt, limit | `price_model` |
| `behavioral-response-library` | Profile-conditioned scenario responses | category, scenario_slug, profile_id, confidence_min, limit | `price_model` |
| `cognitive-bias-simulator` | Cognitive-bias taxonomy | slug(s), limit | `price_model` |
| `robinhood-counterparty-pack` | Retail-trader counterparties | (pinned `tags_include=[retail-trading]`) + trait filters | pack tiers |
| `solana-trading-pack` | Solana-tagged trader personas | (pinned tags) + trait filters | pack tiers |

Because pricing and filtering already live in the recipe, a new product
automatically becomes an ACP offering with no new code — same "new behavior =
new row, not new code path" principle the resolver was built on.

---

## Implementation sketch

### 1. The ACP worker (new: `acp/worker.ts`, run standalone)

```ts
import { AcpAgent, PrivyAlchemyEvmProviderAdapter, AssetToken } from "@virtuals-protocol/acp-node";
import { base } from "viem/chains";
import { resolveOfferingToRecipe, priceFor, resolveRecords } from "./bridge"; // thin reuse layer

const seller = await AcpAgent.create({
  provider: await PrivyAlchemyEvmProviderAdapter.create({
    walletAddress: process.env.ACP_WALLET_ADDRESS!,
    walletId:      process.env.ACP_WALLET_ID!,
    signerPrivateKey: process.env.ACP_SIGNER_KEY!,   // ⚠️ secret — never commit
    chains: [base],
  }),
});

seller.on("entry", async (session, entry) => {
  // Negotiation: buyer sent a requirement → quote a budget from our pricing
  if (entry.kind === "message" && entry.contentType === "requirement" && session.status === "open") {
    const req = JSON.parse(entry.content);                    // {slug, filters, limit}
    const usdc = priceFor(req);                               // = selectTier(price_model, filters)
    await session.setBudget(AssetToken.usdc(usdc, session.chainId));
    return;
  }
  // Transaction: buyer funded escrow → resolve + deliver
  if (entry.kind === "system" && entry.type === "job.funded") {
    const req = session.requirement;                          // agreed requirement
    const records = await resolveRecords(req);                // REUSE resolveQuery(recipe, params)
    const url = await putSignedDeliverable(session.jobId, records); // Supabase Storage, short TTL
    await session.submit(url);
  }
});

await seller.start(() => console.log("Psychosynth ACP provider listening…"));
```

### 2. `acp/bridge.ts` (thin adapter over existing code — the only real glue)

```ts
// Reuses the SAME modules the /api/v1/query route uses. No duplicated logic.
import { dbAdmin } from "@/modules/core/db";
import { resolveQuery } from "@/modules/recipes/resolver";
import { selectTier } from "@/modules/commerce/pricing";

export async function priceFor(req) {
  const { data: p } = await dbAdmin.from("products")
    .select("price_model").eq("slug", req.slug).single();
  return selectTier(p.price_model, new URLSearchParams(req.filters)).amountUsdc;
}
export async function resolveRecords(req) {
  const { data: p } = await dbAdmin.from("products")
    .select("recipe:recipes(query_rules)").eq("slug", req.slug).single();
  return resolveQuery(p.recipe.query_rules, new URLSearchParams({ ...req.filters, limit: req.limit }));
}
```

### 3. Delivery: signed, short-lived (no data leaks pre-payment)

- Write the resolved JSON to Supabase Storage under `acp/{jobId}.json`, return a
  signed URL with a short TTL, and `submit()` that URL. The buyer fetches it after
  escrow completes. (Free-preview parity: we can still gate a % like the x402 path.)
- Alternative for small payloads: submit the JSON inline as the deliverable string.

No new payment code — ACP owns escrow. We only produce records + a URL.

---

## Evaluation & verifiable delivery

This is where our positioning pays off. Our data is already **provenance-stamped
(`sha256_content`), reproducible by seed, and preview-verifiable**. Evaluation
criteria we can commit to in the SLA:

- deliverable is valid JSON matching the offering's output schema,
- row count ≥ requested `limit` (or the max available, disclosed),
- every record carries a provenance hash resolvable via our public API.

Start with the **self-evaluation flow** (SDK supports it) to exercise the full
lifecycle on testnet, then move to a third-party evaluator for buyer trust.

---

## Wallets, keys & security ⚠️

- Register the agent on **app.virtuals.io**; retrieve the **signer private key**
  from the agent's *Signers* tab; **whitelist the developer wallet** (required or
  buyers can't transact with us).
- `ACP_SIGNER_KEY` is a **real private key controlling a hot wallet**. Store it in
  the worker host's secret manager / env — **never** in the repo, never in a
  migration, never pasted into a shell or chat. (Same discipline as the DB
  password: treat it as compromised the instant it leaves a secret store.)
- Keep the ACP agent wallet a **thin hot wallet**; sweep received USDC to the
  main treasury (or set the release **destination** to `X402_PAYOUT_ADDRESS`
  directly if the SDK's fund-forwarding supports it for job payouts).
- The signer key is **separate** from `X402_PAYOUT_ADDRESS`'s key and from the
  Supabase keys — one compromise shouldn't cascade.

---

## Hosting note (important)

`seller.start()` is a **persistent listener** — it holds a long-lived connection.
That does **not** fit Vercel's short-lived serverless functions. Run the worker as
a standalone always-on process: a small container on **Railway / Fly / Render**, a
tiny VM, or a Supabase Edge Function with a durable runtime. It shares the repo
(monorepo import of the resolver) and the Supabase project; Vercel keeps serving
x402 unchanged. Budget one small always-on dyno.

---

## Phased rollout

- **Phase 0 — Setup (½ day).** Register the agent + whitelist wallet on Virtuals;
  install `@virtuals-protocol/acp-node`; stand up the worker skeleton on testnet.
- **Phase 1 — One offering, self-eval (1–2 days).** Wire `personality-profile-library`
  end to end via the `bridge.ts` reuse layer; run the self-evaluation lifecycle on
  testnet; confirm escrow → submit → release.
- **Phase 2 — All products (1 day).** Loop the offering registration over live
  `products` rows; each becomes an offering with zero new logic.
- **Phase 3 — Mainnet + trust (ongoing).** Move to Base mainnet, integrate a
  third-party evaluator, complete **agent graduation** for discovery, and list in
  the Service Registry. Cross-link from the Bankr skill / discovery endpoint.

---

## Open questions — verify against the current SDK before building

- Exact **job-offering schema** format and how requirement JSON schema validation
  is declared (docs reference a "Job Offering Data Schema Validation" page).
- Whether `submit()` prefers a **URL vs inline** deliverable, and size limits.
- Whether job payout can **forward directly** to `X402_PAYOUT_ADDRESS` or must
  land in the agent wallet first (`setBudgetWithFundRequest` destination semantics).
- Evaluator options: self-eval vs marketplace evaluators, and their fees.
- **Agent graduation** requirements/latency for Service Registry discovery.
- Any **VIRTUAL token** / staking requirement to list (confirm current policy).

---

## References

- ACP whitepaper: https://whitepaper.virtuals.io/about-virtuals/agent-commerce-protocol-acp
- ACP tech playbook: https://whitepaper.virtuals.io/builders-hub/acp-tech-playbook
- Provider onboarding (register agent, whitelist wallet, create job offering): https://whitepaper.virtuals.io/get-started-with-acp/setup-agent-profile/create-job-offering
- ACP node SDK (v2): https://github.com/Virtual-Protocol/acp-node-v2 · npm `@virtuals-protocol/acp-node`
- Python SDK (alt): https://pypi.org/project/virtuals-acp/
- G.A.M.E. SDK (lighter custom-function path): https://docs.game.virtuals.io/
