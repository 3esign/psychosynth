#!/usr/bin/env bash
# Paid x402 query. Without X_PAYMENT set, prints the 402 quote (accepts[],
# tiers) so your wallet layer can sign; with X_PAYMENT set, executes the paid
# call.
# Usage: ./query.sh behavioral-response-library "category=trading&limit=20"
set -euo pipefail
: "${PSYCHOSYNTH_BASE_URL:=https://psychosynth.vercel.app}"

# Requires the curl and jq CLIs (NOT the node-jq npm package).
for _b in curl jq; do command -v "$_b" >/dev/null 2>&1 || { echo "psychosynth: '$_b' CLI not found. Install it (Debian/Ubuntu: apt-get install -y $_b | Alpine: apk add $_b | macOS: brew install $_b). These scripts call the curl/jq CLIs directly — node-jq is not used." >&2; exit 127; }; done
SLUG="${1:?usage: query.sh <product-slug> [query-string]}"
QS="${2:-}"
URL="$PSYCHOSYNTH_BASE_URL/api/v1/query/$SLUG${QS:+?$QS}"
if [ -n "${X_PAYMENT:-}" ]; then
  curl -sS -H "X-PAYMENT: $X_PAYMENT" "$URL" | jq .
else
  echo "No X_PAYMENT set — fetching the 402 quote:" >&2
  curl -sS "$URL" | jq .
fi
