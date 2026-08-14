-- News: event date vs. posted date, geolocation, impact-area classification,
-- and boundary auto-tagging from that geolocation.
--
-- Problem this fixes:
-- 1. news_articles only had `published_at`, overloaded to mean both "when
--    the real-world event happened" AND "when this went live on Choseno".
--    An admin backfilling an old story had no way to record the former
--    without lying about the latter, and `published_at` was only ever set
--    by whatever the admin form happened to hold at save time -- nothing
--    guaranteed it actually reflected the moment the article went live.
-- 2. No geolocation on articles, so there was no way to determine which
--    electoral boundaries a "local" story is local *to*.
-- 3. No structured way to say how far a story's relevance reaches (a Surrey
--    council story vs. a federal budget story) for feed/notification
--    targeting.
--
-- Fix:
-- - `event_date`: when the news event actually happened (admin/AI-supplied,
--   optional -- old backfilled stories can set this without touching
--   `published_at`).
-- - `published_at` keeps its existing meaning ("posted" / goes-live date)
--   but now self-heals: a trigger stamps it with `now()` the moment status
--   flips to 'published' with no published_at set, instead of relying on
--   every call site to remember to do that.
-- - `latitude`/`longitude`: where the event happened.
-- - `impact_area`: enum-like CHECK constraint (local/state/country/
--   international) -- the "how far should this travel" classification.
-- - `news_article_boundaries` + `admin_sync_news_article_boundaries()`:
--   mirrors the existing post_boundaries / sync_user_boundary_memberships
--   pattern so a lat/lng resolves to actual map_shapes rows an admin (or
--   AI-assisted paste) can't get wrong, since spatial correctness belongs
--   in Postgres, not client JS.

-- ── 1. New columns ─────────────────────────────────────────────────────────
ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS event_date timestamptz,
  ADD COLUMN IF NOT EXISTS latitude   double precision,
  ADD COLUMN IF NOT EXISTS longitude  double precision,
  ADD COLUMN IF NOT EXISTS impact_area text
    CHECK (impact_area IN ('local', 'state', 'country', 'international'));

COMMENT ON COLUMN public.news_articles.event_date IS
  'When the real-world news event happened. Distinct from published_at (when this article went live on Choseno).';
COMMENT ON COLUMN public.news_articles.latitude IS
  'Where the event happened. Paired with longitude; used to auto-tag matching electoral boundaries via admin_sync_news_article_boundaries().';
COMMENT ON COLUMN public.news_articles.longitude IS
  'See latitude.';
COMMENT ON COLUMN public.news_articles.impact_area IS
  'Enum-like (CHECK constraint): local | state | country | international. How far the story''s relevance reaches, for feed/notification targeting.';

CREATE INDEX IF NOT EXISTS news_articles_impact_area_idx ON public.news_articles (impact_area);
CREATE INDEX IF NOT EXISTS news_articles_event_date_idx ON public.news_articles (event_date);

-- ── 2. published_at self-heals on publish ─────────────────────────────────
-- Belt-and-suspenders alongside the client's existing "published_at ||
-- now()" logic in handleQuickPublish -- this guarantees it at the DB layer
-- too, for any future write path (batch import, direct SQL, etc.) that
-- forgets to.
CREATE OR REPLACE FUNCTION public._news_articles_stamp_published_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'published' AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS news_articles_stamp_published_at ON public.news_articles;
CREATE TRIGGER news_articles_stamp_published_at
  BEFORE INSERT OR UPDATE ON public.news_articles
  FOR EACH ROW EXECUTE FUNCTION public._news_articles_stamp_published_at();

-- ── 3. news_article_boundaries (mirrors post_boundaries) ──────────────────
CREATE TABLE IF NOT EXISTS public.news_article_boundaries (
  news_article_id uuid NOT NULL REFERENCES public.news_articles(id) ON DELETE CASCADE,
  map_shape_id    bigint NOT NULL REFERENCES public.map_shapes(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (news_article_id, map_shape_id)
);

CREATE INDEX IF NOT EXISTS news_article_boundaries_map_shape_idx
  ON public.news_article_boundaries (map_shape_id);

ALTER TABLE public.news_article_boundaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read news article boundary tags"
  ON public.news_article_boundaries FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage news article boundary tags"
  ON public.news_article_boundaries FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── 4. admin_sync_news_article_boundaries() ────────────────────────────────
-- Re-derives news_article_boundaries from the article's current lat/lng,
-- same ST_Contains + admin_only exclusion as find_boundaries_by_point /
-- sync_user_boundary_memberships. Call after any save that touches
-- latitude/longitude (including clearing them, which just empties the set).
CREATE OR REPLACE FUNCTION public.admin_sync_news_article_boundaries(p_article_id uuid)
RETURNS SETOF public.news_article_boundaries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lat double precision;
  v_lng double precision;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT latitude, longitude INTO v_lat, v_lng
    FROM public.news_articles WHERE id = p_article_id;

  DELETE FROM public.news_article_boundaries WHERE news_article_id = p_article_id;

  IF v_lat IS NOT NULL AND v_lng IS NOT NULL THEN
    INSERT INTO public.news_article_boundaries (news_article_id, map_shape_id)
    SELECT p_article_id, ms.id
      FROM public.map_shapes ms
      JOIN public.country_boundary_types cbt
        ON cbt.country = ms.country AND cbt.type_name = ms.boundary_type
     WHERE ms.retired_at IS NULL
       AND NOT cbt.admin_only
       AND ST_Contains(ms.geom, ST_SetSRID(ST_Point(v_lng, v_lat), 4326));
  END IF;

  RETURN QUERY SELECT * FROM public.news_article_boundaries WHERE news_article_id = p_article_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_sync_news_article_boundaries(uuid) TO authenticated;
