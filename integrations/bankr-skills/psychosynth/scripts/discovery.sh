#!/usr/bin/env bash
# Free preflight: products, live prices, tiers, payment surface.
set -euo pipefail
: "${PSYCHOSYNTH_BASE_URL:=https://psychosynth.vercel.app}"

# Requires the curl and jq CLIs (NOT the node-jq npm package).
for _b in curl jq; do command -v "$_b" >/dev/null 2>&1 || { echo "psychosynth: '$_b' CLI not found. Install it (Debian/Ubuntu: apt-get install -y $_b | Alpine: apk add $_b | macOS: brew install $_b). These scripts call the curl/jq CLIs directly — node-jq is not used." >&2; exit 127; }; done
curl -sS "$PSYCHOSYNTH_BASE_URL/api/v1/discovery" | jq .
