#!/usr/bin/env bash
# ONE-COMMAND production data apply — everything generated-but-unapplied, in the
# only safe order, idempotent end to end (every statement is ON CONFLICT DO
# NOTHING / IF NOT EXISTS, and 05_repair_v3.sql carries its own abort guard),
# so re-running after a partial failure is always safe.
#
# Usage (from your own terminal — needs network access to Supabase):
#   DATABASE_URL='postgresql://…' bash scripts/apply-data.sh
# Get the URL from Supabase Dashboard → Connect → URI (use the session pooler
# URI on IPv4-only networks). NEVER commit or paste the URL anywhere.
#
# Order rationale:
#   0021/0022 first  — vocabulary-first rule (bias slugs are a closed set;
#                      batches may reference them).
#   enrich-v4 BEFORE 05_repair_v3 — the repair deletes every batch-* profile
#                      (that IS the old polluted solana data); the 871 clean
#                      chain:solana replacements must land first or the live
#                      pack empties. 05_repair_v3's precheck enforces this.
#   0023 + remaining batches — purely additive, any order; kept deterministic.
#
# APPLY_ALL.sql files use \i (cwd-relative includes) — they MUST run from
# inside their own directory, which is why this script cd's per batch.
# Running `psql -f outputs/<batch>/APPLY_ALL.sql` from the repo root FAILS.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${DATABASE_URL:?Set DATABASE_URL to the Supabase Postgres connection string (Dashboard → Connect → URI)}"

run() { psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q "$@"; }
banner() { printf '\n=== %s ===\n' "$*"; }

polluted() {
  run -tAc "SELECT count(*) FROM profiles WHERE EXISTS (SELECT 1 FROM unnest(tags) t WHERE t LIKE 'batch-%')"
}

banner "Preflight"
run -tAc "SELECT 'profiles total:          '||count(*) FROM profiles"
echo "batch-* polluted profiles: $(polluted)"

banner "Migrations (idempotent): 0021 bias content, 0025 bias taxonomy, 0022 crypto-native biases, 0023 a2a battery, 0024 productize segments"
run -f supabase/migrations/0021_bias_examples_mitigations.sql
run -f supabase/migrations/0025_bias_taxonomy.sql
run -f supabase/migrations/0022_crypto_native_biases.sql
run -f supabase/migrations/0023_a2a_commerce_battery.sql
run -f supabase/migrations/0024_productize_new_segments.sql

apply_batch() {
  banner "outputs/$1/APPLY_ALL.sql"
  ( cd "outputs/$1" && psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f APPLY_ALL.sql )
}

apply_batch enrich-v4

banner "outputs/enrich-v4/05_repair_v3.sql (guarded DELETE of polluted batch-* rows)"
( cd outputs/enrich-v4 && psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f 05_repair_v3.sql )

apply_batch doppler-a2a-v1
apply_batch enrich-a2a-commerce
apply_batch enrich-launch-day
apply_batch enrich-social-cascades

banner "Post-apply verification"
LEFT=$(polluted)
echo "batch-* polluted profiles: ${LEFT}   (MUST be 0)"
[ "${LEFT}" = "0" ] || { echo "FAIL: polluted rows remain"; exit 1; }
run -tAc "SELECT 'approved profiles:        '||count(*) FROM profiles WHERE status='approved'"
run -tAc "SELECT 'clean chain:solana:       '||count(*) FROM profiles WHERE status='approved' AND 'chain:solana' = ANY(tags)"
run -tAc "SELECT 'scenarios:                '||count(*) FROM scenarios"
run -tAc "SELECT 'conditioned responses:    '||count(*) FROM profile_scenario_responses"
run -tAc "SELECT 'live eval batteries:      '||count(*) FROM eval_batteries WHERE status='live'"
run -tAc "SELECT 'biases with examples:     '||count(*) FROM biases WHERE jsonb_array_length(examples) > 0"

banner "DONE — now verify the live surface"
echo "  bash scripts/smoke.sh    # must print ALL CHECKS PASSED (includes tag-hygiene/*)"
