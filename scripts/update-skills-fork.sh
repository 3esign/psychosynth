#!/usr/bin/env bash
# update-skills-fork.sh — sync integrations/bankr-skills/psychosynth/ into your
# BankrBot/skills fork (the branch your PR is opened from), so the published
# skill NEVER lags the repo again. Bankrbot's failed verification was exactly
# this lag: the fork's add-psychosynth branch was missing psychosynth.mjs and
# still carried the old (null-printing) workflow scripts.
#
# Usage (from the repo root, needs your GitHub push credentials):
#   bash scripts/update-skills-fork.sh
#   FORK_URL=https://github.com/3esign/skills.git BRANCH=add-psychosynth bash scripts/update-skills-fork.sh
set -euo pipefail

FORK_URL="${FORK_URL:-https://github.com/3esign/skills.git}"
BRANCH="${BRANCH:-add-psychosynth}"
SRC="$(cd "$(dirname "$0")/.." && pwd)/integrations/bankr-skills/psychosynth"

[ -f "$SRC/psychosynth.mjs" ] || { echo "ERROR: $SRC/psychosynth.mjs not found — run from the psychosynth repo." >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Cloning $FORK_URL ($BRANCH)..."
git clone --depth 1 -b "$BRANCH" "$FORK_URL" "$TMP/skills"

echo "Syncing skill package..."
rm -rf "$TMP/skills/psychosynth"
mkdir -p "$TMP/skills/psychosynth"
cp -r "$SRC/." "$TMP/skills/psychosynth/"

cd "$TMP/skills"
git add -A psychosynth
# Bankr's runtime executes these directly — the +x bit must be in the git index.
git update-index --chmod=+x psychosynth/scripts/*.sh psychosynth/workflows/*.sh

if git diff --cached --quiet; then
  echo "Fork already up to date — nothing to push."
  exit 0
fi

git commit -m "psychosynth: sync skill package — add zero-dep Node runner (psychosynth.mjs), fixed workflow scripts, updated SKILL.md/catalog"
git push origin "$BRANCH"

echo
echo "Pushed. Verify the runner is now pullable (should print 200):"
echo "  curl -s -o /dev/null -w '%{http_code}\\n' https://raw.githubusercontent.com/${FORK_URL#https://github.com/}"
echo "  (path: /${BRANCH}/psychosynth/psychosynth.mjs)"
echo "  curl -fsSL https://raw.githubusercontent.com/3esign/skills/$BRANCH/psychosynth/psychosynth.mjs | head -3"
