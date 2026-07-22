#!/usr/bin/env bash
# check-trading-guardrails.sh — Screen a trade setup against cognitive-bias
# models from the (free) cognitive-bias-simulator preview.
set -euo pipefail
: "${PSYCHOSYNTH_BASE_URL:=https://psychosynth.vercel.app}"

# Requires the curl and jq CLIs (NOT the node-jq npm package).
for _b in curl jq; do command -v "$_b" >/dev/null 2>&1 || { echo "psychosynth: '$_b' CLI not found. Install it (Debian/Ubuntu: apt-get install -y $_b | Alpine: apk add $_b | macOS: brew install $_b). These scripts call the curl/jq CLIs directly — node-jq is not used." >&2; exit 127; }; done

SETUP_INFO="${1:-Long position on leverage following a recent price surge}"

echo "=== Trading Guardrails Check ==="
echo "Analyzing trade setup: \"$SETUP_INFO\""
echo "Fetching cognitive bias models from Psychosynth..."

BIASES=$(curl -sS "$PSYCHOSYNTH_BASE_URL/api/v1/preview/cognitive-bias-simulator")

COUNT=$(echo "$BIASES" | jq -r '.count // 0')
if [ "$COUNT" = "0" ]; then
  echo "No bias records returned (check the endpoint/product status)."
  exit 0
fi

echo ""
echo "=== Guardrails Report ($COUNT bias models) ==="
# Fields per record: name, slug, description, examples[], mitigations[]
echo "$BIASES" | jq -r '.records[]? |
  "Bias: \(.name) (\(.slug))\n  What it is: \(.description)\n  Example: \((.examples // [])[0] // "n/a")\n  Guardrail: \((.mitigations // [])[0] // "n/a")\n---"'

echo "Guardrails evaluation finished. Tip: pass your setup as arg 1 for the header."
