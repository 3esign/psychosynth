#!/usr/bin/env bash
# Free preflight: products, live prices, tiers, payment surface.
set -euo pipefail
: "${PSYCHOSYNTH_BASE_URL:=https://psychosynth.vercel.app}"

# Requires curl + a WORKING jq CLI. If jq is missing or broken (e.g. a bun/npm
# 'jq' shim that errors on 'commander'), run the zero-dependency Node version:
#   node psychosynth.mjs <command>
command -v curl >/dev/null 2>&1 || { echo "psychosynth: 'curl' CLI not found (apt-get install -y curl | apk add curl | brew install curl)." >&2; exit 127; }
if ! command -v jq >/dev/null 2>&1 || ! printf '{}' | jq -e . >/dev/null 2>&1; then
  echo "psychosynth: a working 'jq' CLI is required, but it is missing or broken (a bun/npm 'jq' shim will not work). Install real jq (apt-get install -y jq | apk add jq | brew install jq), OR use the zero-dependency Node runner: node psychosynth.mjs <command>" >&2
  exit 127
fi
curl -sS "$PSYCHOSYNTH_BASE_URL/api/v1/discovery" | jq .
