#!/usr/bin/env bash
# smoke.sh — read-only post-deploy smoke test for the psychosynth API.
# Hits every public surface and asserts HTTP 200 + a minimal shape. No payment,
# no writes. Exit 0 = all pass, 1 = something is wrong.
#
# Usage:
#   bash scripts/smoke.sh
#   PSYCHOSYNTH_BASE_URL=https://your-preview.vercel.app bash scripts/smoke.sh
set -uo pipefail   # NOT -e: run every check even if one fails
: "${PSYCHOSYNTH_BASE_URL:=https://psychosynth.vercel.app}"

# Requires curl + a WORKING jq CLI (a bun/npm 'jq' shim will not work).
command -v curl >/dev/null 2>&1 || { echo "smoke: 'curl' CLI not found (apt-get install -y curl | apk add curl | brew install curl)." >&2; exit 127; }
if ! command -v jq >/dev/null 2>&1 || ! printf '{}' | jq -e . >/dev/null 2>&1; then
  echo "smoke: a working 'jq' CLI is required (install: apt-get install -y jq | apk add jq | brew install jq)." >&2
  exit 127
fi

FAIL=0
CODE=000
BODY_FILE="$(mktemp)"
trap 'rm -f "$BODY_FILE"' EXIT

# http <url> -> sets global CODE, writes response body to $BODY_FILE.
# Called directly (never in a $() subshell) so CODE propagates to the caller.
# One automatic retry on transient failure (network error / 5xx) so a cold
# start or an upstream blip doesn't fail the whole smoke run; a persistent
# 5xx still fails the check.
http() {
  local url="$1"; shift
  local try
  for try in 1 2; do
    CODE="$(curl -sS -o "$BODY_FILE" -w '%{http_code}' "$@" "$url" 2>/dev/null || echo 000)"
    case "$CODE" in
      000|5*) [ "$try" = 1 ] && sleep 2 ;;
      *) return 0 ;;
    esac
  done
}

# check <name> <url> <jq-boolean-filter>
check() {
  local name="$1" url="$2" filter="$3"
  http "$url"
  if [ "$CODE" != "200" ]; then
    printf 'FAIL  %-42s HTTP %s\n' "$name" "$CODE"; FAIL=1; return
  fi
  if jq -e "$filter" "$BODY_FILE" >/dev/null 2>&1; then
    printf 'PASS  %-42s HTTP 200\n' "$name"
  else
    printf 'FAIL  %-42s 200 but assertion failed\n' "$name"; FAIL=1
  fi
}

echo "psychosynth smoke test → $PSYCHOSYNTH_BASE_URL"
echo "----------------------------------------------------------------"

check "discovery"        "$PSYCHOSYNTH_BASE_URL/api/v1/discovery" '(.products|length)>=5'
check "products catalog" "$PSYCHOSYNTH_BASE_URL/api/v1/products"  '(.|length)>=5'

for slug in \
  personality-profile-library \
  robinhood-counterparty-pack \
  solana-trading-pack \
  behavioral-response-library \
  cognitive-bias-simulator
do
  check "preview/$slug" "$PSYCHOSYNTH_BASE_URL/api/v1/preview/$slug" '(.count>0) and ((.records|length)>0)'
done

# The cognitive-bias content must be populated (this is the 500-regression guard).
check "bias examples+mitigations" "$PSYCHOSYNTH_BASE_URL/api/v1/preview/cognitive-bias-simulator" \
  '.records[0] | ((.examples|length)>0) and ((.mitigations|length)>0)'

# Tag hygiene: no internal batch-* tags may ever reach a buyer-facing surface.
# (Regression guard for the v3 tag pollution — 05_repair_v3.sql removes it;
#  this catches it coming back OR the repair never having been applied.)
for slug in \
  personality-profile-library \
  robinhood-counterparty-pack \
  solana-trading-pack
do
  check "tag-hygiene/$slug" "$PSYCHOSYNTH_BASE_URL/api/v1/preview/$slug" \
    '[.records[]? | (.tags // [])[] | select(startswith("batch-"))] | length == 0'
done

# Renderer contract: the shapes the bankr skill scripts + node runner key on.
# If a server-side join or column change alters these, every workflow breaks.
check "shape/profiles(big_five+mbti)" "$PSYCHOSYNTH_BASE_URL/api/v1/preview/personality-profile-library" \
  '.records[0] | (has("big_five")) and (has("mbti_label")) and (has("decision_style")) and (.big_five|has("neuroticism"))'
check "shape/responses(embeds are objects)" "$PSYCHOSYNTH_BASE_URL/api/v1/preview/behavioral-response-library" \
  '.records[0] | ((.scenarios|type)=="object") and ((.profiles|type)=="object") and (has("response")) and (has("reasoning_chain")) and (has("confidence"))'

# The canonical zero-dep runner must stay served (SKILL.md + discovery point
# agents at it as the jq-free fallback; if it 404s, every no-jq runtime breaks).
http "$PSYCHOSYNTH_BASE_URL/psychosynth.mjs"
if [ "$CODE" = "200" ] && head -c 200 "$BODY_FILE" | grep -q 'zero-dependency' && grep -q 'const COMMANDS' "$BODY_FILE"; then
  printf 'PASS  %-42s HTTP 200\n' "hosted runner /psychosynth.mjs"
else
  printf 'FAIL  %-42s HTTP %s (missing or not the runner)\n' "hosted runner /psychosynth.mjs" "$CODE"; FAIL=1
fi

# Eval battery (GET is free: scenarios + rubric). Lenient shape check.
check "eval/robinhood-stress-battery" "$PSYCHOSYNTH_BASE_URL/api/v1/eval/robinhood-stress-battery" \
  '(.scenarios? // .battery? // .title? // .rubric?) != null'
check "eval/a2a-commerce-battery" "$PSYCHOSYNTH_BASE_URL/api/v1/eval/a2a-commerce-battery" \
  '(.scenarios? // .battery? // .title? // .rubric?) != null'

echo "----------------------------------------------------------------"
if [ "$FAIL" = 0 ]; then
  echo "ALL CHECKS PASSED"
else
  echo "SOME CHECKS FAILED (see above)"
fi
exit "$FAIL"
