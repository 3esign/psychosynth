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

# Requires the curl and jq CLIs (NOT the node-jq npm package).
for _b in curl jq; do command -v "$_b" >/dev/null 2>&1 || { echo "psychosynth: '$_b' CLI not found. Install it (Debian/Ubuntu: apt-get install -y $_b | Alpine: apk add $_b | macOS: brew install $_b). These scripts call the curl/jq CLIs directly — node-jq is not used." >&2; exit 127; }; done

FAIL=0
CODE=000
BODY_FILE="$(mktemp)"
trap 'rm -f "$BODY_FILE"' EXIT

# http <url> -> sets global CODE, writes response body to $BODY_FILE.
# Called directly (never in a $() subshell) so CODE propagates to the caller.
http() {
  local url="$1"; shift
  CODE="$(curl -sS -o "$BODY_FILE" -w '%{http_code}' "$@" "$url" 2>/dev/null || echo 000)"
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

# Eval battery (GET is free: scenarios + rubric). Lenient shape check.
check "eval/robinhood-stress-battery" "$PSYCHOSYNTH_BASE_URL/api/v1/eval/robinhood-stress-battery" \
  '(.scenarios? // .battery? // .title? // .rubric?) != null'

echo "----------------------------------------------------------------"
if [ "$FAIL" = 0 ]; then
  echo "ALL CHECKS PASSED"
else
  echo "SOME CHECKS FAILED (see above)"
fi
exit "$FAIL"
