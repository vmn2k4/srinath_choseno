-- Engagement after finding a district: which race cards / district chips in the
-- auto-locate banner people actually click. Same public-write / admin-read shape
-- as district_lookups (visitor_id is the random per-browser id, never a profile).

CREATE TABLE IF NOT EXISTS public.district_banner_clicks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT,
  target_type TEXT NOT NULL CHECK (target_type IN ('seat', 'boundary')),
  target_id TEXT NOT NULL,
  page TEXT,
  is_test BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_district_banner_clicks_created_at ON public.district_banner_clicks (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_district_banner_clicks_visitor ON public.district_banner_clicks (visitor_id);

ALTER TABLE public.district_banner_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage district banner clicks" ON public.district_banner_clicks
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));

CREATE OR REPLACE FUNCTION public.log_district_banner_click(
  p_target_type TEXT,
  p_target_id TEXT,
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
  INSERT INTO public.district_banner_clicks (visitor_id, target_type, target_id, page, is_test)
  VALUES (LEFT(p_visitor_id, 64), p_target_type, LEFT(p_target_id, 100), LEFT(p_page, 500), p_is_test);
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_district_banner_click(TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO anon, authenticated;

-- Adds an 'engagement' block to the admin metrics. "People who found" = distinct
-- visitors with a found lookup. A click / support counts only if it happened
-- AFTER that visitor's first found lookup. Supports come from the existing
-- anonymous_supporters table (same visitor id as anon_id).
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

  WITH first_found AS (
    SELECT dl.visitor_id, min(dl.created_at) AS found_at
    FROM public.district_lookups dl
    WHERE NOT dl.is_test AND dl.found AND dl.visitor_id IS NOT NULL
    GROUP BY dl.visitor_id
  ),
  clicks AS (
    SELECT c.visitor_id, c.target_type
    FROM public.district_banner_clicks c
    JOIN first_found f ON f.visitor_id = c.visitor_id AND c.created_at >= f.found_at
    WHERE NOT c.is_test
  ),
  supports AS (
    SELECT DISTINCT f.visitor_id
    FROM public.anonymous_supporters s
    JOIN first_found f ON f.visitor_id = s.anon_id::text AND s.created_at >= f.found_at
    WHERE NOT s.is_test
  )
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
    ), '[]'::jsonb),
    'engagement', jsonb_build_object(
      'peopleFound', (SELECT count(*) FROM first_found),
      'peopleClicked', (SELECT count(DISTINCT visitor_id) FROM clicks),
      'raceClicks', (SELECT count(*) FROM clicks WHERE target_type = 'seat'),
      'districtClicks', (SELECT count(*) FROM clicks WHERE target_type = 'boundary'),
      'peopleSupported', (SELECT count(*) FROM supports)
    )
  ) INTO result;

  RETURN result;
END;
$$;
