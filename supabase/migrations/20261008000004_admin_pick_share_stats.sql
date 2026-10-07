-- Admin analytics: how many "Share my picks" links have been generated.
-- Counts rows in race_pick_shares (every generated link, including ones later
-- hidden by reports), excluding is_test rows like the rest of admin analytics.
-- creator_id / anon_id / is_test are not readable by anon/authenticated
-- (column grants in 20261008000000), so this is a SECURITY DEFINER RPC that
-- checks the caller is an admin.
CREATE OR REPLACE FUNCTION public.get_admin_pick_share_stats(p_today_start TIMESTAMPTZ DEFAULT date_trunc('day', now()))
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  WITH s AS (
    SELECT created_at, creator_id, seat_id
    FROM public.race_pick_shares
    WHERE is_test = false
  ),
  win AS (
    SELECT * FROM (VALUES
      ('today', p_today_start),
      ('d7', now() - INTERVAL '7 days'),
      ('d30', now() - INTERVAL '30 days'),
      ('allTime', NULL::timestamptz)
    ) AS w(k, since)
  ),
  agg AS (
    SELECT
      win.k,
      count(s.*) AS total,
      count(s.*) FILTER (WHERE s.creator_id IS NOT NULL) AS signed_in
    FROM win
    LEFT JOIN s ON win.since IS NULL OR s.created_at >= win.since
    GROUP BY win.k
  ),
  top_races AS (
    SELECT es.role_title, ms.name AS place, count(*) AS shares
    FROM s
    JOIN public.election_seats es ON es.id = s.seat_id
    LEFT JOIN public.map_shapes ms ON ms.id = es.map_shape_id
    GROUP BY es.role_title, ms.name
    ORDER BY count(*) DESC
    LIMIT 5
  )
  SELECT json_build_object(
    'windows', (
      SELECT json_object_agg(k, json_build_object(
        'total', total,
        'signed_in', signed_in,
        'logged_out', total - signed_in
      )) FROM agg
    ),
    'top_races', COALESCE((
      SELECT json_agg(json_build_object('role_title', role_title, 'place', place, 'shares', shares)) FROM top_races
    ), '[]'::json)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_pick_share_stats(TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_pick_share_stats(TIMESTAMPTZ) TO authenticated;
