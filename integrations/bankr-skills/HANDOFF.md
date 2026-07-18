# Bankr integration — finalization handoff

Everything below is staged and committed. What remains needs either a deploy,
a funded wallet, or a GitHub account — none of which an offline agent can do
safely. Follow in order; each step gates the next.

## What already shipped in this branch

1. **Standard x402 payments (Rail 1)** — `src/modules/commerce/facilitator.ts`
   (new) + `payment-verify.ts` + `proxy.ts`: the API now accepts the standard
   `exact`-scheme EIP-3009 payload Bankr wallets sign automatically, settled
   server-side via facilitator (default: PayAI's free public facilitator —
   `https://facilitator.payai.network`, no API key, Base mainnet, facilitator
   pays gas). Self-settled txHash flow (Base + Solana + binding) unchanged.
   38/38 unit tests pass; `tsc --noEmit` clean.
2. **Free agent preflight (conversion funnel)** — new
   `GET /api/v1/discovery`: products, live prices, tiers, payTo, settlement
   methods. Free previews already existed (`/api/v1/preview/{slug}`).
3. **Bankr skill submission package (Rail 2)** —
   `integrations/bankr-skills/psychosynth/` (SKILL.md, catalog.json, logo.svg,
   references/, scripts/) matching the BankrBot/skills repo schema exactly.
4. **Homepage** — new "Built for autonomous agents" section (screenshot-ready).
5. **Docs** — README + docs/DISCOVERY.md Bankr sections;
   `integrations/bankr-skills/X-THREAD.md` ready to post.

## Rail 3 decision (taken, not deferred to you)

Do NOT deploy an x402 Cloud proxy yet. The skills catalog is the
higher-traffic surface and costs nothing; two deployment paths before the
first dollar is overhead without signal. Revisit only if merged-skill traffic
shows agents discovering via registry search.

## Step 1 — Deploy & smoke-test (required before the PR)

1. Deploy this branch to Vercel (project `psychosynth`). No new env vars are
   required — facilitator settlement is ON by default. Optional overrides:
   `X402_FACILITATOR_URL`, `X402_FACILITATOR_ENABLED=false`.
2. Verify, in a browser or curl:
   - `https://psychosynth.vercel.app/api/v1/discovery` → 200, all three
     products with correct prices ($0.01 / $0.03 / $0.02, packs $19 / $49).
   - `https://psychosynth.vercel.app/api/v1/preview/personality-profile-library`
     → 200 with records. **ATTENTION: at handoff time the preview endpoints
     could not be confirmed from this environment (fetches returned empty —
     possibly an error status). If previews 500, fix before the PR — the
     SKILL.md promises them and they are the conversion funnel.**
   - `https://psychosynth.vercel.app/api/v1/query/personality-profile-library`
     → 402 whose JSON includes `settlement.methods: ["eip3009","txhash"]` and
     the Base accepts[] entry with `extra.assetTransferMethod: "eip3009"`.

## Step 2 — One real paid call (strongly recommended)

With a wallet holding ≥ $0.01 USDC on Base, run an end-to-end x402 purchase
using `x402-fetch` (already a dependency) against
`/api/v1/query/personality-profile-library?limit=1`. Expect: 402 → auto-sign →
200 with 1 record; the settlement tx appears on Basescan paying the payout
address. Capacitr's SKILL.md links proof transactions — doing the same in our
PR description materially helps review.

## Step 3 — Open the PR to BankrBot/skills

1. Fork `https://github.com/BankrBot/skills`, branch `add-psychosynth`.
2. Copy `integrations/bankr-skills/psychosynth/` to the fork ROOT as
   `psychosynth/` (folder name MUST equal catalog.json `slug`, or the skill is
   silently skipped from the Discover catalog).
3. Ensure `scripts/*.sh` are executable (`git update-index --chmod=+x`).
4. PR title: `Add psychosynth — synthetic behavioral data over x402`.
   Body template:

   > **What**: Synthetic psychometric data for agent simulations — Big Five /
   > Dark Triad / prospect-theory profiles, profile-conditioned scenario
   > responses, cognitive-bias models. Free deterministic previews; paid
   > queries settle per-call in USDC on Base via standard x402 (EIP-3009).
   > From $0.01/query. No API key, no signup.
   >
   > **Why it's different**: existing intelligence skills analyze tokens;
   > psychosynth sells behavioral priors — how market participants act — for
   > trading sims, counterparty modeling, and stress-testing agents against
   > realistic populations.
   >
   > **Proof**: discovery: https://psychosynth.vercel.app/api/v1/discovery ·
   > settlement tx: <basescan link from Step 2>
   >
   > Tested end-to-end against <facilitator> on Base mainnet.

5. After merge: skill surfaces on skills.bankr.bot; install command is
   `install the psychosynth skill from https://github.com/BankrBot/skills/tree/main/psychosynth`.

## Step 4 — Announce

Post `integrations/bankr-skills/X-THREAD.md` (thread version recommended) and
attach screenshots of: the new homepage agent section, the discovery JSON, and
(ideally) the Basescan settlement tx from Step 2.

## Known constraints for reviewers

- Skill-scanning meta-skills audit SKILL.md files for injection/obfuscation:
  ours is deliberately literal, no encoded content, and includes an
  untrusted-content section. Keep it that way in future edits.
- Never hard-code prices anywhere agent-facing; everything reads from
  discovery or the 402 quote.
