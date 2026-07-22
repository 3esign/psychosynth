# scratch/ — throwaway tooling. Read this before running anything here.

Nothing in this directory is a canonical apply path. The ONLY sanctioned way to
apply pending data to production is:

```bash
DATABASE_URL='postgresql://…' bash scripts/apply-data.sh
```

which applies the reviewed, quality-gated SQL committed under
`supabase/migrations/` and `outputs/<batch>/` in the documented order.

## Superseded / hazardous files

- `load-data-batches.mjs` — ⚠️ regenerates "v4" data from seed
  `enrich-v4-prod-2026-07-22`, which is NOT the seed of the committed
  `outputs/enrich-v4` batch (`psychosynth-v4-2026-07-21`). Running it alongside
  the canonical SQL produces a second, divergent 4,000-profile population with
  different UUIDs. Do not use.
- `load-sql-batches.mjs` — abandoned half-implementation (its loader body is a
  stub); parses SQL with a regex. Do not use.
- `apply-db-updates.mjs` — bias/battery content now lives canonically in
  migrations `0021`–`0023`; this script predates them. Do not use.
- `publish-mcp.fixed.yml` — already copied into `.github/workflows/`; kept only
  as reference.
- `test-live-402.mjs` — ad-hoc live 402 poke; harmless.
