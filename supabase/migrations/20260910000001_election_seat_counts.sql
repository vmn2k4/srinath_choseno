-- Add election_seat_counts JSONB column to map_shapes for lightweight
-- "how many seats, how many nominated" election enrichment -- same pattern
-- as census_data (20260823000000_add_census_data_jsonb.sql), just a
-- different snapshot of facts about the shape.
--
-- First populated 2026-09-10 for BC municipalities + school districts:
--   - "seats" per multi-seat role is NOT tracked anywhere else in this
--     schema (election_seats is one row per (election, shape, role_title)
--     regardless of how many people that role elects), so it's inferred
--     from the current office_holders count for that (map_shape_id,
--     role_title) -- office_holders' real unique constraint is 3-column
--     (map_shape_id, election_role_type_id, full_name), so multi-seat
--     roles do have one row per sitting seat-holder. This is a proxy
--     (council/board size can change between elections) and known to be
--     wrong at least once at initial load -- see the migration's own
--     data-load notes / CANDIDATE_DATA_PULL_LOG.md 2026-09-10 BC seat
--     count entry for the City of North Vancouver councillor-count
--     anomaly (12 current rows, casing suggests an unmerged duplicate
--     import; real council size is 6) left un-fixed as a known caveat.
--   - "nominated" counts are a point-in-time snapshot from CivicInfo BC
--     (localelections.ca), sourced via
--     scripts/sync_bc_civicinfo_candidates.py fetch -- NOT kept in sync
--     automatically as more candidates file before nominations close.
ALTER TABLE public.map_shapes
ADD COLUMN IF NOT EXISTS election_seat_counts JSONB DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_map_shapes_election_seat_counts
  ON public.map_shapes USING GIN (election_seat_counts);

COMMENT ON COLUMN public.map_shapes.election_seat_counts IS
'Per-role seat counts + nomination snapshot as JSONB, keyed by role_title.
Structure: { "<role_title>": { "seats": int|null, "nominated": int, "as_of": "YYYY-MM-DD", "source": text } }
"seats" is null when no reliable count was available at population time.
Mayor rows only carry "nominated" (seats is always 1, not worth storing).
Currently populated for BC (Municipal: Mayor + Councillor; School District:
School Trustee) from the 2026 general local election cycle. Re-run
scripts/sync_bc_civicinfo_candidates.py fetch + the seat-count query in
this migration''s own notes to refresh.';
