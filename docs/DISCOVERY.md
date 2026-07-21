# Agent-Native Discovery & Integration Roadmap

This document outlines the developer integration standards to make Psychosynth's synthetic psychometric datasets discoverable and usable by autonomous agents across major runtimes (**ElizaOS, OpenClaw, Hermes, Virtuals Protocol**) prior to the initial release.

---

## 1. Standard Model Context Protocol (MCP) Setup

Psychosynth exposes an MCP server located in [mcp/](../mcp) that translates our catalog, previews, quotes, and x402 paid queries into standard LLM tools.

### Claude Desktop & Generic MCP Clients
To connect the server locally, add this block to the client's configuration file (e.g., `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "psychosynth": {
      "command": "node",
      "args": ["/absolute/path/to/psychosynth/mcp/dist/index.js"],
      "env": {
        "PSYCHOSYNTH_API_URL": "https://your-deployment.vercel.app",
        "BUYER_PRIVATE_KEY": "0xYourBuyerWalletPrivateKey",
        "BASE_RPC_URL": "https://mainnet.base.org"
      }
    }
  }
}
```

---

## 2. Framework-Specific Runtimes

### 2.1 OpenClaw Integration
OpenClaw manages MCP servers via **MCPorter**. Connect the Psychosynth MCP server using one of the following methods:

#### CLI Configuration
Run this command from your OpenClaw runtime directory:
```bash
openclaw mcp add psychosynth node /absolute/path/to/psychosynth/mcp/dist/index.js --env PSYCHOSYNTH_API_URL="https://your-deployment.vercel.app" BUYER_PRIVATE_KEY="0xYourPrivateKey"
```

#### Manual JSON Config (`mcporter.json`):
```json
{
  "mcp": {
    "servers": {
      "psychosynth": {
        "command": "node",
        "args": ["/absolute/path/to/psychosynth/mcp/dist/index.js"],
        "env": {
          "PSYCHOSYNTH_API_URL": "https://your-deployment.vercel.app",
          "BUYER_PRIVATE_KEY": "0xYourPrivateKey"
        }
      }
    }
  }
}
```
Verify the installation by running `openclaw mcp status`.

---

### 2.2 ElizaOS Integration
ElizaOS connects to MCP servers using `eliza-plugin-mcp`.

1. **Add Plugin**: Ensure `@elizaos/plugin-mcp` is added to your agent's dependencies.
2. **Character Configuration**: Reference the server inside your agent's `character.json` file:

```json
{
  "name": "TraderAgent",
  "plugins": ["@elizaos/plugin-mcp"],
  "settings": {
    "mcp": {
      "servers": {
        "psychosynth": {
          "command": "node",
          "args": ["/absolute/path/to/psychosynth/mcp/dist/index.js"],
          "env": {
            "PSYCHOSYNTH_API_URL": "https://your-deployment.vercel.app",
            "BUYER_PRIVATE_KEY": "0xYourPrivateKey"
          }
        }
      }
    }
  }
}
```

---

### 2.3 Hermes Agent (Nous Research)
Hermes Agents consume MCP servers via direct stdio bindings in their Elixir/Node.js orchestration layers.

1. Add the server execution command to the Hermes `config/config.exs` or the JSON agent environment definition:
```json
{
  "agent": {
    "mcp_servers": [
      {
        "name": "psychosynth",
        "command": "node",
        "args": ["/absolute/path/to/psychosynth/mcp/dist/index.js"],
        "env": {
          "PSYCHOSYNTH_API_URL": "https://your-deployment.vercel.app",
          "BUYER_PRIVATE_KEY": "0xYourPrivateKey"
        }
      }
    ]
  }
}
```
2. The Hermes agent will automatically register `list_products`, `preview_records`, `get_quote`, and `query_records` into its dynamic skill list.

---

## 3. Virtuals Protocol & G.A.M.E. Framework

Virtuals Protocol agents execute tasks on-chain using the **G.A.M.E. Framework** decision engine. To register Psychosynth as a G.A.M.E. tool:

1. **Tool Definition**: Map the `query_records` MCP tool parameters to the G.A.M.E. custom action payload:
```json
{
  "name": "query_psychosynth_data",
  "description": "Queries detailed psychometric profiles or behavioral responses. Settles dynamically in USDC on Base.",
  "parameters": {
    "type": "object",
    "properties": {
      "slug": {
        "type": "string",
        "description": "Product slug, e.g. 'personality-profile-library'"
      },
      "filters": {
        "type": "object",
        "description": "Filters, e.g. { \"decision_style\": \"analytical\" }"
      }
    },
    "required": ["slug"]
  }
}
```

2. **Autonomous Execution Logic**:
   - The G.A.M.E. agent signs a gasless EVM transaction (EIP-3009 TransferWithAuthorization) using its on-chain wallet.
   - The payload is sent to the Vercel proxy middleware (`proxy.ts`), which settles the authorization on-chain and delivers the records in the same request loop.

---

## 4. Pre-Release Action Items

To ensure seamless day-one discoverability, complete the following items prior to shipping the first public release:

1. **Publish to npm**: 
   - Compile [psychosynth-mcp](../mcp) and publish it to the npm registry.
   - This allows developers to run the server instantly using `npx`:
     ```bash
     npx psychosynth-mcp
     ```
2. **Submit to MCP Server Directories**:
   - Register our package in the official **Model Context Protocol Servers Registry** (`github.com/modelcontextprotocol/servers`) and the **glama.ai** community registry.
3. **Expose `.well-known` Config**:
   - Add a public JSON description file at `https://your-app.vercel.app/.well-known/mcp.json` detailing the stdio and SSE connections for remote agents.

---

## 5. Bankr Ecosystem (x402 skills catalog)

Three rails make Psychosynth discoverable and payable by Bankr agents:

### Rail 1 — Payment compatibility (SHIPPED)
The 402 quote's `accepts[]` leads with USDC on Base, and the server now accepts the **standard x402 `exact`-scheme payload** — a gasless EIP-3009 `TransferWithAuthorization` signed by the agent, settled server-side through an x402 facilitator (`X402_FACILITATOR_URL`, default PayAI's free public facilitator; the facilitator broadcasts and pays gas). Bankr wallets sign this shape automatically. The legacy self-settled `txHash` path (Base + Solana, with payer binding) is unchanged. See `src/modules/commerce/facilitator.ts`.

### Rail 2 — Skills catalog (READY TO SUBMIT)
The complete submission folder for [BankrBot/skills](https://github.com/BankrBot/skills) is staged at `integrations/bankr-skills/psychosynth/`:
- `SKILL.md` — written as an agent-facing prompt with explicit "use when" triggers (trading-sim priors, counterparty simulation, panic-seller stress-testing), the full endpoint map, filters, payment flow, and an untrusted-content notice (their ecosystem runs security-scan meta-skills over SKILL.md files — keep it clean and literal).
- `catalog.json` — matches the repo schema (`schemaVersion: 1`, `slug: psychosynth` = folder name; a folder without valid catalog.json is silently skipped from the Discover catalog).
- `logo.svg`, `references/x402-flow.md`, `scripts/*.sh`.

Submit by forking BankrBot/skills, copying the folder to the repo root as `psychosynth/`, and opening a PR. See `integrations/bankr-skills/HANDOFF.md` for the exact steps.

### Rail 3 — Registry indexing (DEFERRED, deliberate)
x402 Cloud deployment (auto-indexing in the Bankr registry, Bankr as gas-covering facilitator) is deferred until the skill PR proves demand: the skills catalog is the higher-traffic surface, it costs nothing, and maintaining two deployment paths before the first dollar arrives is overhead without signal. The free `/api/v1/discovery` endpoint plus the skill give registry crawlers and web-searching agents everything they need in the meantime. Revisit after merge if agents start arriving via registry search.

### Future Integration Ideas

The following concepts are experimental integration patterns worth exploring within the Bankr ecosystem:

- **Doppler token launches**: The `robinhood-counterparty-pack` could plausibly be used to simulate retail personas against bonding curve parameters for launches on Robinhood chain and Base — worth testing before treating it as a real workflow.
- **Trading guardrails**: The `cognitive-bias-simulator`'s bias models could in theory be checked against Avantis or Hyperliquid trade setups to flag risky patterns, though this isn't a built integration today.
- **x402 pricing**: The `behavioral-response-library`'s profile-conditioned responses could inform how agents approach counterparty negotiation for x402 services, but there's no confirmed mechanism for dynamic pricing based on reliability/risk profiles yet.
- **App personalization**: For apps built via `create_app`, the `personality-profile-library`'s prospect-theory vectors could be used to tailor UX — e.g. different signal styles for different risk profiles — as a design direction rather than a shipped feature.
