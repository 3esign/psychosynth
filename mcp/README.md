# psychosynth-mcp

An [MCP](https://modelcontextprotocol.io) server that makes the **Psychosynth**
synthetic psychometric data marketplace discoverable and usable by AI agents
(Claude, OpenAI, and any MCP-compatible client).

It exposes the public API as four tools: browse the catalog, fetch a free
deterministic preview, get an x402 price quote, and run a paid query. Discovery
tools are free and need no wallet; paid queries settle in USDC on Base using a
wallet **you** configure.

## Tools

| Tool | Cost | Description |
| --- | --- | --- |
| `list_products` | free | List available data products with slugs, per-query prices, and bulk pack tiers. |
| `preview_records` | free | Deterministic sample of a product's records — same rows every time, so you can verify quality before paying. |
| `get_quote` | free | The x402 payment quote (price + accepted tiers) for a paid query, without paying. |
| `query_records` | paid | Full records. Pays automatically over x402 using `BUYER_PRIVATE_KEY`; if unset, returns the quote instead. Add `tier` for a bulk pack. |

## Install & configure

The server is distributed on npm and run with `npx`. Add it to your MCP client.

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "psychosynth": {
      "command": "npx",
      "args": ["-y", "psychosynth-mcp"],
      "env": {
        "PSYCHOSYNTH_API_URL": "https://your-deployment.example.com",
        "BUYER_PRIVATE_KEY": "0xYOUR_BASE_WALLET_KEY"
      }
    }
  }
}
```

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `PSYCHOSYNTH_API_URL` | no | Base URL of the Psychosynth deployment. Defaults to `http://localhost:3000`. |
| `BUYER_PRIVATE_KEY` | no | Base (EVM) wallet key used to pay for queries. **Omit to use only the free tools.** |
| `BASE_RPC_URL` | no | Custom Base RPC. Defaults to `https://mainnet.base.org`. |

## Payment & safety

- `list_products`, `preview_records`, and `get_quote` never touch a wallet.
- `query_records` pays **only** with the key in `BUYER_PRIVATE_KEY`, which you
  set. The server holds no other key and never moves funds on its own — if no
  wallet is configured, a paid query returns the quote instead of paying.
- Only keep enough USDC/ETH on the buyer wallet for expected spend. Treat the
  key as a secret; never commit it.

## How payment works

`query_records` performs the standard x402 handshake: it requests the paid
endpoint, receives a `402` quote, signs an EIP-3009 `TransferWithAuthorization`
with your wallet (no gas on your side — the seller settles), and retries with
the signed authorization. Base mainnet clock drift is compensated automatically
so the authorization window is accepted.

## Local development

```bash
npm install
npm run build
PSYCHOSYNTH_API_URL=http://localhost:3000 node dist/index.js
```

The server speaks MCP over stdio; run it from an MCP client rather than
interacting directly.

## Registry

`server.json` is an [MCP registry](https://github.com/modelcontextprotocol/registry)
manifest. Before publishing, replace `OWNER` with your GitHub namespace and
publish `psychosynth-mcp` to npm.
