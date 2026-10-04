-- enrichOfficeHolders (src/lib/services/elections.ts) looks up profiles with
-- `.in("full_name", names)` -- exact equality -- on every office-holder fetch
-- (~13K calls, 132ms mean, 2.9s peak in pg_stat_statements). The only
-- full_name index was the GIN trigram one, which serves equality but is slow
-- (~100ms for 10 names). A plain btree makes exact matches near-instant;
-- the trigram index stays for fuzzy search.
-- Applied with psql -f (CONCURRENTLY can't run inside a transaction block).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_full_name
  ON public.profiles (full_name);
