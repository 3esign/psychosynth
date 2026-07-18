# @psychosynth/eliza-plugin

An [ElizaOS](https://github.com/elizaOS/eliza) plugin for the [Psychosynth](https://github.com/3esign/cfaces) agent-native psychometric data marketplace. It gives an Eliza agent two capabilities:

1. **Provider** — injects a synthetic psychometric identity profile (Big Five / OCEAN traits, decision style, cosmetic MBTI label) into the agent's context, so the agent can role-play with a consistent, grounded personality.
2. **Action** (`QUERY_PSYCHOMETRIC_DATA`) — lets the agent autonomously query and pay for psychometric datasets or scenario responses on **Base** in USDC via the [x402](https://modelcontextprotocol.io) protocol.

> All records are clearly marked `synthetic: true`. Psychosynth sells synthetic, psychometrically-grounded data, not data about real people.

## Install

```bash
npm install @psychosynth/eliza-plugin
```

Requires `@elizaos/core` as a peer dependency (provided by your Eliza runtime).

## Usage

Register the plugin with your Eliza character/runtime:

```ts
import psychosynthPlugin from '@psychosynth/eliza-plugin';

export const character = {
  name: 'MyAgent',
  plugins: [psychosynthPlugin],
  // ...
};
```

You can also import the pieces individually:

```ts
import { psychosynthProvider, psychosynthQueryAction } from '@psychosynth/eliza-plugin';
```

## Configuration

Set these via your Eliza runtime settings / environment:

| Setting | Required | Default | Notes |
|---|---|---|---|
| `PSYCHOSYNTH_BUYER_PRIVATE_KEY` (or `BUYER_PRIVATE_KEY`) | for paid queries | — | Base (EVM) wallet key. Without it, the provider and action are inert (free tools only). |
| `PSYCHOSYNTH_API_URL` | no | `https://psychosynth.vercel.app` | Psychosynth API base URL. |
| `PSYCHOSYNTH_PROFILE_SLUG` | no | `personality-profile-library` | Product the provider pulls the agent's identity profile from. |
| `BASE_RPC_URL` | no | `https://mainnet.base.org` | Base mainnet RPC endpoint. |

## How the action parses requests

`QUERY_PSYCHOMETRIC_DATA` expects the agent's planner to include a JSON object in the message describing what to buy, e.g.:

```json
{ "slug": "behavioral-response-library", "filters": { "category": "crisis" } }
```

If no JSON is present it falls back to the default profile library. On success it returns the fetched records to the Eliza callback.

> **Spending note:** the action signs an x402 payment for the amount the server quotes. Fund the buyer wallet with only what you intend to spend, and point `PSYCHOSYNTH_API_URL` only at a Psychosynth endpoint you trust.

## License

MIT
