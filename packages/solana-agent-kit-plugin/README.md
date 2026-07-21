# @psychosynth/solana-agent-kit-plugin

This plugin enables autonomous agents built with the [Solana Agent Kit](https://github.com/sendaifun/solana-agent-kit) to query and pay for synthetic psychometric profiles and behavioral responses from the Psychosynth marketplace.

Payments are routed on-chain via Solana USDC (SPL Token) and cryptographically bound to the agent's wallet to prevent front-running.

## Installation

```bash
npm install @psychosynth/solana-agent-kit-plugin
```

## Usage

```typescript
import { SolanaAgentKit } from 'solana-agent-kit';
import { PsychosynthPlugin } from '@psychosynth/solana-agent-kit-plugin';

// 1. Initialize your Solana Agent
const agent = new SolanaAgentKit(
  process.env.SOLANA_PRIVATE_KEY!,
  process.env.SOLANA_RPC_URL!,
  process.env.OPENAI_API_KEY!
);

// 2. Register the Psychosynth plugin
const psychosynthPlugin = new PsychosynthPlugin();
// If you are using a tool factory, you can map the actions in psychosynthPlugin.actions to your agent's tool layer.

// The agent now has access to:
// - psychosynth_list_products
// - psychosynth_preview_records
// - psychosynth_get_quote
// - psychosynth_query_records (Executes paid queries via Solana USDC)
```

## How it works

When the agent decides to execute `psychosynth_query_records`:
1. The plugin fetches an `x402` quote from the Psychosynth API.
2. The agent executes a standard SPL Token transfer (USDC) to the `payTo` address for the `maxAmountRequired`.
3. The plugin cryptographically signs an `x402-payment-binding` challenge with the agent's Ed25519 keypair.
4. The plugin submits the `txHash` and `signature` to the API to receive the paid data.

## Configuration

By default, the plugin connects to `https://psychosynth.vercel.app`. To override this (e.g. for local testing), pass the API URL to the constructor:

```typescript
const plugin = new PsychosynthPlugin("http://localhost:3000");
```
