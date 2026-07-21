#!/usr/bin/env bash
# One-click launch for the Robinhood push (Counterparty Pack + Stress Battery).
# Applies DB migrations, builds, and prints post-deploy smoke tests.
#
# Usage:   bash scripts/launch.sh
# Deploy step is intentionally left to you (vercel --prod / git push / etc.).

set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> 1/4  Checking required env"
missing=0
for v in NEXT_PUBLIC_SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY X402_PAYOUT_ADDRESS; do
  if ! grep -qsE "^${v}=" .env .env.local 2>/dev/null && [ -z "${!v:-}" ]; then
    echo "    MISSING: $v"; missing=1
  fi
done
[ "$missing" = 0 ] && echo "    ok" || { echo "    Set the missing vars (in .env locally AND in your host dashboard) and re-run."; exit 1; }

echo "==> 2/4  Applying database migrations (products, starter data, security lockdown)"
npx supabase db push

echo "==> 3/4  Typecheck + build"
npm run typecheck
npm run build

echo "==> 4/4  Done. Deploy however you normally do, then smoke-test:"
cat <<'SMOKE'
    BASE=https://your-deployment.example.com
    # Catalog + evaluations should list the new products:
    curl -s "$BASE/api/v1/discovery" | jq '.products[].slug, .evaluations[].battery'
    # Free preview of the counterparty pack (should return retail personas):
    curl -s "$BASE/api/v1/preview/robinhood-counterparty-pack" | jq '.count'
    # Free battery questions (should list 6 scenarios + rubric):
    curl -s "$BASE/api/v1/eval/robinhood-stress-battery" | jq '.scenarios | length'
    # Paid endpoints return HTTP 402 with a quote when called without payment:
    curl -s -o /dev/null -w "counterparty query -> %{http_code}\n" "$BASE/api/v1/query/robinhood-counterparty-pack"
    curl -s -X POST -H 'content-type: application/json' \
      -d '{"responses":[{"scenario_slug":"rh-flash-crash","response":"cut risk, keep sizing"}]}' \
      -o /dev/null -w "eval submit -> %{http_code}\n" "$BASE/api/v1/eval/robinhood-stress-battery"
SMOKE
