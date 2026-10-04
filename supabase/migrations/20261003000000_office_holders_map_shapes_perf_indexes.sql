-- Perf pass #2, driven by pg_stat_statements + EXPLAIN ANALYZE (2026-10-03).
-- Applied with psql -f (CREATE INDEX CONCURRENTLY cannot run inside a
-- transaction block, so don't wrap this file in BEGIN/COMMIT).
--
-- 1. getFeaturedOfficeHolders (news article / politician sidebars):
--    WHERE is_current ORDER BY updated_at DESC LIMIT 10 had no index on
--    updated_at, so every call seq-scanned and sorted all ~14K current office
--    holders before joining map_shapes for the country filter. For Canada that
--    took ~3s and hit the anon role's 3s statement_timeout, returning no rows.
--    A partial index lets Postgres walk newest-first and stop after 10 matches.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_office_holders_current_updated
  ON public.office_holders (updated_at DESC)
  WHERE is_current;

-- 2. Boundary-upload admin pages count live and retired shapes per upload_id.
--    idx_map_shapes_upload only covers upload_id, so counting retired_at IS
--    NULL still visited every heap row of a wide (geometry) table: 16.8s for
--    the largest upload (63K rows), ~14K calls, peaking at the 8s timeout.
--    One partial index per side makes both counts index-only.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_map_shapes_upload_live
  ON public.map_shapes (upload_id)
  WHERE retired_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_map_shapes_upload_retired
  ON public.map_shapes (upload_id)
  WHERE retired_at IS NOT NULL;
