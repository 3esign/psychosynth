#!/usr/bin/env bash
# publish.sh — one-command publish for psychosynth.
#
# Runs the quality gates Vercel will run, commits, and pushes. Your Vercel
# project is Git-integrated, so the push triggers the production deploy.
#
# It deliberately does NOT touch the database — Vercel does not run migrations.
# The Supabase/Postgres steps are printed at the end (and in PUBLISH.md).
#
# Usage:
#   bash scripts/publish.sh -m "feat: v4 enrichment + bankr skill fixes"
#   bash scripts/publish.sh --skip-checks      # commit+push only
#   bash scripts/publish.sh --no-push           # commit only
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MSG="chore: publish psychosynth update"
SKIP_CHECKS=0
NO_PUSH=0
while [ $# -gt 0 ]; do
  case "$1" in
    -m) MSG="${2:?message required}"; shift 2;;
    --skip-checks) SKIP_CHECKS=1; shift;;
    --no-push) NO_PUSH=1; shift;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
    *) echo "unknown arg: $1" >&2; exit 2;;
  esac
done

echo "== psychosynth publish =="
echo "repo   : $ROOT"
echo "branch : $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '(no git)')"

if [ "$SKIP_CHECKS" = "0" ]; then
  echo "-- installing dependencies --"
  npm install --no-audit --no-fund
  echo "-- typecheck --";  npm run typecheck
  echo "-- lint --";       npm run lint
  echo "-- tests --";      npm run test
  echo "-- production build (same as Vercel) --"; npm run build
  echo "   all gates passed."
else
  echo "!! skipping checks (--skip-checks)"
fi

echo "-- git commit --"
git add -A

# Check staged changes for strict two-lane separation (src/** vs outputs/**, docs exempt)
STAGED_FILES="$(git diff --cached --name-only)"
TOUCHES_SRC="$(echo "$STAGED_FILES" | grep '^src/' || true)"
TOUCHES_OUTPUTS="$(echo "$STAGED_FILES" | grep '^outputs/' || true)"
if [ -n "$TOUCHES_SRC" ] && [ -n "$TOUCHES_OUTPUTS" ]; then
  echo "ERROR: Change set touches both src/** and outputs/**." >&2
  echo "Per AGENTS.md & docs/DATA_CONTRIBUTION.md, methodology changes (Lane 2) and data batches (Lane 1) MUST be committed as separate change sets." >&2
  exit 1
fi

if git diff --cached --quiet; then
  echo "   nothing to commit."
else
  git commit -m "$MSG"
  echo "   committed: $MSG"
fi

if [ "$NO_PUSH" = "0" ]; then
  echo "-- git push --"
  git push
  echo "   pushed. Vercel will build and deploy the production branch automatically."
  echo "   watch: https://vercel.com  (or: npx vercel ls)"
else
  echo "!! skipping push (--no-push)"
fi

cat <<'NOTE'

────────────────────────────────────────────────────────────────────────────
 DATABASE — not automated (Vercel does not run migrations). Apply in order:

   # 1) schema fix + bias content — fixes the cognitive-bias-simulator 500
   psql "$DATABASE_URL" -f supabase/migrations/0021_bias_examples_mitigations.sql
   #    (or, if you use the CLI:  npx supabase db push )

   # 2) v4 enrichment data — 4k profiles / 4k responses / scenarios / provenance
   psql "$DATABASE_URL" -f outputs/enrich-v4/APPLY_ALL.sql

   # 3) v3 cleanup — REVIEW FIRST; deletes the old batch-tagged rows in place
   psql "$DATABASE_URL" -f outputs/enrich-v4/05_repair_v3.sql

 All three are idempotent / re-runnable. See PUBLISH.md for the full checklist.
────────────────────────────────────────────────────────────────────────────
NOTE
echo "done."
