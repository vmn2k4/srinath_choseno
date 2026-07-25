-- get_active_elections_for_user() returned one aggregated row per election
-- (election_id, election_name, election_date, seat_count) -- but the Feed's
-- election pills need one row PER SEAT (e.g. "Mayor" and "Councillor" render
-- as separate pills even when they share the same election day). Return type
-- is changing, so this must be dropped and recreated (Postgres can't
-- CREATE OR REPLACE across a return-type change) -- same precedent as
-- 20260728000006_narrow_find_shapes_within.sql.
--
-- Also widens the status filter from just 'active' to 'nominations_open' and
-- 'active', matching getOpenSeatsNearShapeIds' existing shape (elections.js)
-- -- apply_for_seat already accepts nominations through both statuses
-- (20260729000003_nominations_open_through_election_date.sql), so citizens
-- should be able to discover a seat, and a politician self-nominate for it,
-- before an admin flips the election fully 'active'.
DROP FUNCTION public.get_active_elections_for_user();

CREATE FUNCTION public.get_active_elections_for_user()
RETURNS TABLE(seat_id uuid, election_id uuid, election_name text, election_date date, role_title text)
LANGUAGE sql STABLE AS $$
  SELECT es.id, e.id, e.name, e.election_date, es.role_title
  FROM public.elections e
  JOIN public.election_seats es ON es.election_id = e.id
  JOIN public.user_boundary_memberships ubm
    ON ubm.map_shape_id = es.map_shape_id AND ubm.profile_id = auth.uid()
  WHERE e.status IN ('nominations_open', 'active')
    AND NOT EXISTS (
      SELECT 1 FROM public.election_notification_dismissals d
      WHERE d.profile_id = auth.uid() AND d.election_id = e.id
    )
  ORDER BY e.election_date, es.role_title;
$$;
