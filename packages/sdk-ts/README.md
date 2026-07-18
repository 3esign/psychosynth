# @psychosynth/sdk

TypeScript SDK for the [Psychosynth](https://github.com/3esign/cfaces) agent-native psychometric data marketplace. Discover the catalog, fetch free deterministic previews, and run paid queries that settle in USDC on **Base** via the [x402](https://modelcontextprotocol.io) micro-payment protocol — no accounts, no API keys, just a wallet.

> All records are clearly marked `synthetic: true`. Psychosynth sells synthetic, psychometrically-grounded profiles and profile-conditioned behavioral responses, not data about real people.

## Install

```bash
npm install @psychosynth/sdk
```

## Quick start

```ts
import { PsychosynthClient } from '@psychosynth/sdk';

const client = new PsychosynthClient({
  // A Base (EVM) wallet private key funded with a little USDC.
  // Omit paid calls entirely if you only need the free catalog/preview.
  privateKey: process.env.BUYER_PRIVATE_KEY!,
  // Optional overrides:
  apiUrl: 'https://psychosynth.vercel.app', // default
  rpcUrl: 'https://mainnet.base.org',       // default Base mainnet RPC
});

// 1. Discover products (free)
const products = await client.listProducts();

// 2. Fetch a free, deterministic sample to verify schema shape (free)
const preview = await client.previewRecords('personality-profile-library', {
  mbti_label: 'INTJ',
  limit: '3',
});

// 3. Run a paid query — signs an x402 payment and settles on Base
const records = await client.queryRecords('personality-profile-library', {
  limit: '10',
});
```

## API

| Method | Cost | Description |
|---|---|---|
| `listProducts()` | free | List available products, schemas, and pricing. |
| `previewRecords(slug, filters?)` | free | Deterministic sample records for a product. |
| `queryRecords(slug, filters?)` | **paid** | Full query. Signs an EIP-3009 `TransferWithAuthorization` and settles USDC on Base, then returns records. |

`filters` is a flat `Record<string, string>` appended as query-string parameters. Available filters and pricing tiers are described by each product's row from `listProducts()`. To buy a bulk pack instead of a single per-query charge, pass a `tier` filter (e.g. `{ tier: 'pack_100' }`).

## Configuration

| Option | Required | Default | Notes |
|---|---|---|---|
| `privateKey` | for paid calls | — | Base (EVM) wallet key. `0x`-prefixed or bare hex. |
| `apiUrl` | no | `https://psychosynth.vercel.app` | Psychosynth API base URL. |
| `rpcUrl` | no | `https://mainnet.base.org` | Base mainnet RPC endpoint. |

## Payment flow

`queryRecords` performs the standard x402 loop: it hits the endpoint, receives a `402` quote, signs a gasless EIP-3009 USDC authorization for the quoted amount and recipient, and re-sends the request with an `X-PAYMENT` header. The server verifies the signature, settles on-chain, and returns the data in the same request loop.

> **Spending note:** the client currently signs for the amount the server quotes. Fund the buyer wallet with only what you intend to spend, and treat the `apiUrl` you point at as trusted. A client-side max-amount guard is on the roadmap.

## License

MIT
