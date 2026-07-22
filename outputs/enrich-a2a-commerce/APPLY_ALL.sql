-- enrich-a2a-commerce batch. Run in order.
\set ON_ERROR_STOP on
\i 00_generation_run.sql
\i 01_scenarios.sql
\i 02_profiles.sql
\i 03_responses.sql
\i 04_provenance.sql
