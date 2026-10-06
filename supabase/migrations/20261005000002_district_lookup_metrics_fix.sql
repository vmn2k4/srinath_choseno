-- Fix for 20261005000001: the unqualified `found` column in the bySource
-- subquery collided with PL/pgSQL's built-in FOUND variable ("column reference
-- "found" is ambiguous"), so the admin metrics call always errored and the
-- Districts Found card never rendered. Qualified with a table alias.

CREATE OR REPLACE FUNCTION public.get_admin_district_lookup_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT jsonb_build_object(
    'windows', (
      SELECT jsonb_object_agg(w.key, jsonb_build_object(
        'lookups', (SELECT count(*) FROM public.district_lookups d WHERE NOT d.is_test AND d.found AND d.created_at >= w.since),
        'people',  (SELECT count(DISTINCT d.visitor_id) FROM public.district_lookups d WHERE NOT d.is_test AND d.found AND d.created_at >= w.since),
        'notFound', (SELECT count(*) FROM public.district_lookups d WHERE NOT d.is_test AND NOT d.found AND d.created_at >= w.since)
      ))
      FROM (VALUES
        ('today',   date_trunc('day', now())),
        ('d7',      now() - interval '7 days'),
        ('d30',     now() - interval '30 days'),
        ('allTime', '-infinity'::timestamptz)
      ) AS w(key, since)
    ),
    'bySource', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('source', s.source, 'lookups', s.lookups, 'people', s.people) ORDER BY s.people DESC)
      FROM (
        SELECT dl.source, count(*) AS lookups, count(DISTINCT dl.visitor_id) AS people
        FROM public.district_lookups dl
        WHERE NOT dl.is_test AND dl.found
        GROUP BY dl.source
      ) s
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_district_lookup_metrics() TO authenticated;
