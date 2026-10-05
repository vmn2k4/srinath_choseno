-- District lookup tracking: how many people actually found their district,
-- site-wide. GA4's find_district_completed event (events.ts) only covers the
-- /find-my-district page, is subject to the same client-side loss that made
-- GA4's sign_up event unreliable, and can't count distinct people. This table
-- is the source of truth the admin Platform Analytics panel reads, covering
-- every surface that resolves a location: the auto-locate banner on election
-- pages / news, the homepage widget, and /find-my-district.
--
-- Same public-write / admin-read shape as client_error_logs and
-- signup_funnel_events: a lookup is mostly a signed-out visitor, so there is
-- no auth.uid() to gate inserts on. The only identity is visitor_id -- the
-- random per-browser id from anonSupporter.ts, never linked to a profile --
-- so "unique people" can be counted without breaking the anonymity model.

CREATE TABLE IF NOT EXISTS public.district_lookups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT,
  -- Which surface resolved the location.
  source TEXT NOT NULL CHECK (source IN ('district_banner', 'home_widget', 'find_my_district')),
  -- 'gps' = browser geolocation (auto or button), 'address' = typed address, 'unknown' = map picker (GPS or pin, indistinguishable).
  method TEXT NOT NULL CHECK (method IN ('gps', 'address', 'unknown')),
  -- True when at least one (non-polling) boundary matched the point.
  found BOOLEAN NOT NULL,
  boundary_count INT NOT NULL DEFAULT 0,
  page TEXT,
  is_test BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_district_lookups_created_at ON public.district_lookups (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_district_lookups_visitor ON public.district_lookups (visitor_id) WHERE found;

ALTER TABLE public.district_lookups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage district lookups" ON public.district_lookups
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));

-- log_district_lookup(): the only write path (SECURITY DEFINER to get past
-- the admin-only RLS above).
CREATE OR REPLACE FUNCTION public.log_district_lookup(
  p_source TEXT,
  p_method TEXT,
  p_found BOOLEAN,
  p_boundary_count INT DEFAULT 0,
  p_visitor_id TEXT DEFAULT NULL,
  p_page TEXT DEFAULT NULL,
  p_is_test BOOLEAN DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.district_lookups (visitor_id, source, method, found, boundary_count, page, is_test)
  VALUES (LEFT(p_visitor_id, 64), p_source, p_method, p_found, GREATEST(COALESCE(p_boundary_count, 0), 0), LEFT(p_page, 500), p_is_test);
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_district_lookup(TEXT, TEXT, BOOLEAN, INT, TEXT, TEXT, BOOLEAN) TO anon, authenticated;

-- get_admin_district_lookup_metrics(): aggregates server-side so the admin
-- panel never pulls raw rows. Admin-only (checked inside, since SECURITY
-- DEFINER bypasses the table's RLS). Excludes is_test, like the rest of the
-- admin analytics.
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
        SELECT source, count(*) AS lookups, count(DISTINCT visitor_id) AS people
        FROM public.district_lookups
        WHERE NOT is_test AND found
        GROUP BY source
      ) s
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_district_lookup_metrics() TO authenticated;
