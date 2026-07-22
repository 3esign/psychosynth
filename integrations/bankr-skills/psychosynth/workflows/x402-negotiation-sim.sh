#!/usr/bin/env bash
# x402-negotiation-sim.sh — Preview how synthetic counterparties react in
# high-stakes scenarios, as priors for x402 service-price negotiation.
#
# Uses the free behavioral-response-library preview. Optional arg 1 filters the
# displayed category (trading|negotiation|social|crisis) client-side.
set -euo pipefail
: "${PSYCHOSYNTH_BASE_URL:=https://psychosynth.vercel.app}"

# Requires the curl and jq CLIs (NOT the node-jq npm package).
for _b in curl jq; do command -v "$_b" >/dev/null 2>&1 || { echo "psychosynth: '$_b' CLI not found. Install it (Debian/Ubuntu: apt-get install -y $_b | Alpine: apk add $_b | macOS: brew install $_b). These scripts call the curl/jq CLIs directly — node-jq is not used." >&2; exit 127; }; done

CATEGORY="${1:-}"

echo "=== x402 Counterparty Negotiation Simulation ==="
echo "Fetching behavioral responses${CATEGORY:+ (category: $CATEGORY)}..."

RESPONSES=$(curl -sS "$PSYCHOSYNTH_BASE_URL/api/v1/preview/behavioral-response-library")

echo ""
echo "=== Counterparty Reactions ==="
# Record shape: response, reasoning_chain, emotional_arc, confidence,
# scenarios{slug,category,title,description}, profiles{id,mbti_label,decision_style,big_five}
echo "$RESPONSES" | jq -r --arg cat "$CATEGORY" '
  .records[]?
  | select($cat == "" or (.scenarios.category == $cat))
  | "Scenario: \(.scenarios.title // "n/a") [\(.scenarios.category // "")]\n  Counterparty: \(.profiles.mbti_label // "?") / \(.profiles.decision_style // "?")\n  Reaction: \(.response)\n  Reasoning: \(.reasoning_chain)\n  Confidence: \(.confidence)\n---"'

echo "Negotiation simulation complete."
