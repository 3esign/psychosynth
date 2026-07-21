#!/usr/bin/env bash
# simulate-doppler-launch.sh — Simulate retail counterparty resistance against
# Doppler bonding-curve parameters, using synthetic retail personas.
#
# Free mode (default): pulls the robinhood-counterparty-pack PREVIEW (retail
# personas) and uses neuroticism as a loss-aversion proxy — the free preview
# does not expose prospect-theory. Set X_PAYMENT (a signed x402 header) to run
# the PAID query instead and get the real loss-aversion lambda.
set -euo pipefail
: "${PSYCHOSYNTH_BASE_URL:=https://psychosynth.vercel.app}"
PRODUCT="robinhood-counterparty-pack"

echo "=== Doppler Launch Simulation — retail counterparty resistance ==="

if [ -n "${X_PAYMENT:-}" ]; then
  echo "Paid mode: retail personas with prospect-theory posture (loss aversion lambda)."
  DATA=$(curl -sS -H "X-PAYMENT: $X_PAYMENT" "$PSYCHOSYNTH_BASE_URL/api/v1/query/$PRODUCT?lambda_min=2.0&limit=25")
  echo "$DATA" | jq -r '.records[]? | "persona \(.id[0:8]) | \(.mbti_label) \(.decision_style) | loss-aversion lambda=\(.content.prospect_theory.lambda) | neuroticism=\(.big_five.neuroticism)"'
  echo "$DATA" | jq -r '([.records[]?]|length) as $t | ([.records[]? | select(.content.prospect_theory.lambda >= 2.5)]|length) as $h | "High-resistance personas (lambda>=2.5): \($h)/\($t) — these fight the curve on the way down (panic-sell pressure)."'
else
  echo "Free preview mode (neuroticism as loss-aversion proxy; set X_PAYMENT for real lambda)."
  DATA=$(curl -sS "$PSYCHOSYNTH_BASE_URL/api/v1/preview/$PRODUCT")
  echo "Loaded $(echo "$DATA" | jq -r '.count // 0') retail personas."
  echo "$DATA" | jq -r '.records[]? | "persona \(.id[0:8]) | \(.mbti_label) \(.decision_style) | neuroticism=\(.big_five.neuroticism) | \((.tags // []) | join(","))"'
  echo "$DATA" | jq -r '([.records[]?]|length) as $t | ([.records[]? | select(.big_five.neuroticism >= 0.6)]|length) as $h | "High-resistance personas (neuroticism>=0.6): \($h)/\($t) — proxy for panic-sell pressure into the bonding curve."'
fi
echo "Simulation complete."
