-- Master apply script for Psychosynth v4 enrichment.
-- Run with:  psql "$DATABASE_URL" -f outputs/enrich-v4/APPLY_ALL.sql
-- Or run each numbered file in order in the Supabase SQL editor.
\set ON_ERROR_STOP on
\i 00_generation_run.sql
\i 01_scenarios.sql
\i 02_profiles.sql
\i 03_responses.sql
\i 04_provenance.sql
-- Review 05_repair_v3.sql before running — it DELETES the old v3 batch rows:
-- \i 05_repair_v3.sql
