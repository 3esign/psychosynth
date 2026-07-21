#!/usr/bin/env bash
# personalize-app.sh — Turn personality profiles into per-user UX configuration.
#
# Free mode (default): personality-profile-library PREVIEW; the free preview has
# no prospect-theory, so UX tiers key off neuroticism (a loss-aversion proxy).
# Set X_PAYMENT to run the PAID query and key off the real loss-aversion lambda.
set -euo pipefail
: "${PSYCHOSYNTH_BASE_URL:=https://psychosynth.vercel.app}"

echo "=== App Personalization Engine ==="

if [ -n "${X_PAYMENT:-}" ]; then
  echo "Paid mode: tailoring UX from prospect-theory lambda."
  DATA=$(curl -sS -H "X-PAYMENT: $X_PAYMENT" "$PSYCHOSYNTH_BASE_URL/api/v1/query/personality-profile-library?limit=25")
  echo "$DATA" | jq -r '.records[]? | {
    user: .id[0:8], mbti: .mbti_label, loss_aversion_lambda: .content.prospect_theory.lambda,
    ux_config: (if (.content.prospect_theory.lambda > 2.0)
      then { risk_style: "conservative", warning_banner: "high_prominence", signal_style: "detailed_risk" }
      else { risk_style: "aggressive", warning_banner: "subtle", signal_style: "action_oriented" } end)
  }'
else
  echo "Free preview mode (neuroticism as loss-aversion proxy; set X_PAYMENT for real lambda)."
  DATA=$(curl -sS "$PSYCHOSYNTH_BASE_URL/api/v1/preview/personality-profile-library")
  echo "$DATA" | jq -r '.records[]? | {
    user: .id[0:8], mbti: .mbti_label, neuroticism: .big_five.neuroticism,
    ux_config: (if (.big_five.neuroticism > 0.55)
      then { risk_style: "conservative", warning_banner: "high_prominence", signal_style: "detailed_risk" }
      else { risk_style: "aggressive", warning_banner: "subtle", signal_style: "action_oriented" } end)
  }'
fi
echo "Personalization profiles generated."
