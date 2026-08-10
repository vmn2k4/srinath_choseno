-- News → Politician/Party tagging.
--
-- Lets an admin tag a news article to N politicians (news_article_politicians,
-- new join table) and optionally one political party (news_articles.
-- political_party_id). Tagging a politician makes the article show up on
-- that politician's wall, reusing the existing posts/PostCard pipeline
-- instead of a parallel rendering path: admin_sync_news_article_tags()
-- mirrors each live tag into a public.posts row with wall_ghost_id set to
-- the politician's current ghost id (so it's picked up by the existing
-- getWallPosts() `.or(ghost_id.eq,wall_ghost_id.eq)` query unchanged) and
-- ghost_id set to a fixed sentinel identity reserved for news-authored
-- posts (never a real user's ghost id, so it can never collide with a
-- politician's own "owner post" / spotlight-comment logic in PostCard).
--
-- Deliberately wall-only: these synced posts don't set is_country/
-- is_international/post_boundaries, so they never appear in the main
-- country/international feed, only on the tagged politician's wall(s).

-- ── 1. political_party_id on news_articles (optional, single) ────────────
ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS political_party_id bigint REFERENCES public.political_parties(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS news_articles_political_party_id_idx
  ON public.news_articles (political_party_id);

-- ── 2. news_article_politicians (optional, many) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.news_article_politicians (
  news_article_id uuid NOT NULL REFERENCES public.news_articles(id) ON DELETE CASCADE,
  politician_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (news_article_id, politician_id)
);

CREATE INDEX IF NOT EXISTS news_article_politicians_politician_idx
  ON public.news_article_politicians (politician_id);

ALTER TABLE public.news_article_politicians ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read news article politician tags"
  ON public.news_article_politicians FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage news article politician tags"
  ON public.news_article_politicians FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── 3. admin_sync_news_article_tags() ──────────────────────────────────────
-- p_politician_ids = NULL   -> leave the tag set untouched, just resync
--                              wall posts against the article's current
--                              status (used by quick publish/unpublish,
--                              which don't touch tags).
-- p_politician_ids = array  -> replace the tag set with exactly this
--                              (including [] to untag everyone), then sync.
CREATE OR REPLACE FUNCTION public.admin_sync_news_article_tags(
  p_article_id uuid,
  p_politician_ids uuid[] DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_article public.news_articles;
  v_is_live boolean;
  v_rec record;
  v_news_ghost_id CONSTANT uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT * INTO v_article FROM public.news_articles WHERE id = p_article_id;
  IF v_article.id IS NULL THEN
    RAISE EXCEPTION 'Article not found';
  END IF;

  IF p_politician_ids IS NOT NULL THEN
    DELETE FROM public.news_article_politicians
     WHERE news_article_id = p_article_id
       AND politician_id <> ALL (p_politician_ids);

    INSERT INTO public.news_article_politicians (news_article_id, politician_id)
    SELECT p_article_id, pid FROM unnest(p_politician_ids) AS pid
    ON CONFLICT (news_article_id, politician_id) DO NOTHING;
  END IF;

  v_is_live := v_article.status = 'published'
    AND (v_article.published_at IS NULL OR v_article.published_at <= now());

  -- Drop synced wall posts for politicians no longer tagged, or entirely
  -- if the article isn't (or is no longer) live.
  DELETE FROM public.posts
   WHERE news_article_id = p_article_id
     AND ghost_id = v_news_ghost_id
     AND (
       NOT v_is_live
       OR wall_ghost_id NOT IN (
         SELECT p.current_ghost_id::text
           FROM public.news_article_politicians nap
           JOIN public.profiles p ON p.id = nap.politician_id
          WHERE nap.news_article_id = p_article_id
            AND p.current_ghost_id IS NOT NULL
       )
     );

  IF v_is_live THEN
    FOR v_rec IN
      SELECT p.current_ghost_id AS ghost_id
        FROM public.news_article_politicians nap
        JOIN public.profiles p ON p.id = nap.politician_id
       WHERE nap.news_article_id = p_article_id
         AND p.current_ghost_id IS NOT NULL
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.posts
         WHERE news_article_id = p_article_id
           AND wall_ghost_id = v_rec.ghost_id::text
           AND ghost_id = v_news_ghost_id
      ) THEN
        INSERT INTO public.posts (
          ghost_id, content, image_url, wall_ghost_id, news_article_id, country
        ) VALUES (
          v_news_ghost_id,
          v_article.headline || COALESCE(chr(10) || chr(10) || v_article.summary, ''),
          v_article.hero_image_url,
          v_rec.ghost_id::text,
          p_article_id,
          v_article.country
        );
      END IF;
    END LOOP;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_sync_news_article_tags(uuid, uuid[]) TO authenticated;
