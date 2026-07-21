-- Security lockdown — closes the three launch-blocking findings from
-- docs/DB_AUDIT_2026-07-18.md (F1 paywall bypass, F2 unprotected reviews,
-- F3 anon-callable SECURITY DEFINER RPCs).
--
-- Safe to apply: every legitimate read/write in the app goes through the
-- service role (dbAdmin) in server API routes, which BYPASSES RLS and retains
-- EXECUTE. The browser client (supabaseBrowser) is used ONLY for admin login
-- auth, never to read these tables — verified before writing this migration.

-- ---------------------------------------------------------------------------
-- F1 — stop the paid data + prompts leaking to the public anon key.
-- Migration 0006 added `TO public USING(true)` SELECT policies; since the anon
-- key ships to the browser, those let anyone dump the paid Behavioral Response
-- Library (and scenarios) straight from PostgREST, bypassing x402. Drop them.
-- RLS stays ENABLED with no policy => anon denied, service role unaffected.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "public read profile_scenario_responses" ON profile_scenario_responses;
DROP POLICY IF EXISTS "public read scenarios"                  ON scenarios;
DROP POLICY IF EXISTS "public read scenario_bias_applications" ON scenario_bias_applications;
DROP POLICY IF EXISTS "public read emotional_patterns"         ON emotional_patterns;

-- Redundant + misleading (service_role bypasses RLS regardless). Remove.
DROP POLICY IF EXISTS "service role all profile_scenario_responses" ON profile_scenario_responses;
DROP POLICY IF EXISTS "service role all scenarios"                  ON scenarios;
DROP POLICY IF EXISTS "service role all scenario_bias_applications" ON scenario_bias_applications;
DROP POLICY IF EXISTS "service role all emotional_patterns"         ON emotional_patterns;

-- ---------------------------------------------------------------------------
-- F2 — the reviews table never had RLS enabled (migration 0010), so the anon
-- key could likely read raw signatures and forge reviews directly. Enable RLS;
-- leave it policy-free so only the service role (the reviews API route) touches
-- it. That route already selects reviews without the signature column.
-- ---------------------------------------------------------------------------
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- F3 — SECURITY DEFINER / helper functions are EXECUTE-granted to PUBLIC by
-- Postgres default, so anon could call decide_curation over PostgREST RPC and
-- approve or overwrite pending profiles. Revoke from PUBLIC/anon/authenticated;
-- grant only to service_role. Uses regprocedure so the exact signatures are
-- matched without hand-typing argument lists.
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('decide_curation', 'increment_run_counter', 'similar_profile')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- F5 (belt-and-suspenders) — make sure EVERY table created so far in the public
-- schema has RLS on, so any table that slipped through the blanket enable in
-- 0004 (like reviews did) is caught now. New tables in 0014 already enable RLS
-- explicitly; this is a safety net, not a substitute for doing it per-migration.
-- ---------------------------------------------------------------------------
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;
END $$;
