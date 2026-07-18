# psychosynth-sdk (Python)

Python SDK for the [Psychosynth](https://github.com/3esign/cfaces) agent-native psychometric data marketplace. Discover the catalog, fetch free deterministic previews, and run paid queries that settle in USDC on **Base** via the [x402](https://modelcontextprotocol.io) micro-payment protocol.

> All records are clearly marked `synthetic: true`. Psychosynth sells synthetic, psychometrically-grounded profiles and profile-conditioned behavioral responses, not data about real people.

## Install

```bash
pip install psychosynth-sdk
```

Or from source:

```bash
cd packages/sdk-python
pip install -e .
```

Dependencies: `web3`, `eth-account`, `requests`.

## Quick start

```python
import os
from psychosynth import PsychosynthClient, PsychosynthConfig

client = PsychosynthClient(PsychosynthConfig(
    # A Base (EVM) wallet private key funded with a little USDC.
    private_key=os.environ["BUYER_PRIVATE_KEY"],
    # Optional overrides:
    api_url="https://psychosynth.vercel.app",  # default
    rpc_url="https://mainnet.base.org",         # default Base mainnet RPC
))

# 1. Discover products (free)
products = client.list_products()

# 2. Fetch a free, deterministic sample (free)
preview = client.preview_records("personality-profile-library", {"mbti_label": "INTJ", "limit": "3"})

# 3. Run a paid query — signs an x402 payment and settles on Base
records = client.query_records("personality-profile-library", {"limit": "10"})
```

## API

| Method | Cost | Description |
|---|---|---|
| `list_products()` | free | List available products, schemas, and pricing. |
| `preview_records(slug, filters=None)` | free | Deterministic sample records for a product. |
| `query_records(slug, filters=None)` | **paid** | Full query. Signs an EIP-3009 `TransferWithAuthorization` and settles USDC on Base, then returns records. |

`filters` is a flat `dict[str, str]` appended as query-string parameters. `query_records` first tries the endpoint unpaid — if the product is free it returns immediately; otherwise it handles the `402` quote, signs, and re-requests.

## Configuration

| Option | Required | Default | Notes |
|---|---|---|---|
| `private_key` | for paid calls | — | Base (EVM) wallet key. `0x`-prefixed or bare hex. |
| `api_url` | no | `https://psychosynth.vercel.app` | Psychosynth API base URL. |
| `rpc_url` | no | `https://mainnet.base.org` | Base mainnet RPC endpoint. |

> **Spending note:** the client signs for the amount and recipient the server quotes (with a 1-day authorization window). Fund the buyer wallet with only what you intend to spend, and only point `api_url` at a Psychosynth endpoint you trust. A client-side max-amount / expected-recipient guard is on the roadmap.

## License

MIT
