-- Fixes stale auto-generated share-card images after a news article is
-- tagged (or re-tagged) to a politician post-publish.
--
-- Root cause: generate-news-og-image (Edge Function) is idempotent by
-- design -- it derives the "spotlight" politician from
-- news_article_politicians at render time, bakes it into a static PNG, and
-- from then on just serves that cached file (news_articles.hero_image_url)
-- without ever re-deriving anything, on purpose (see that function's own
-- comment: repeat calls must stay cheap for social-crawler traffic). If an
-- article's OG card was generated *before* any politician was tagged (or
-- before the specific one now tagged), the cached PNG permanently shows the
-- generic "Civic Leaders" placeholder even after news_article_politicians
-- gains a real row -- exactly the mismatch between the live "Rate the
-- people mentioned" strip (always queries fresh) and the baked share-card
-- image (never does).
--
-- Fix: whenever admin_sync_news_article_tags() is called with an explicit
-- tag list (p_politician_ids IS NOT NULL -- i.e. an actual tag edit, not
-- the p_politician_ids-omitted resync-after-publish/unpublish call), clear
-- hero_image_url back to NULL *if and only if* it's still pointing at an
-- auto-generated composite (path contains "/og-cards/", the fixed upload
-- path both uploadNewsOgImage and the Edge Function use -- see
-- src/lib/services/news.ts and generate-news-og-image/index.ts). A real
-- editorial photo an admin uploaded goes through uploadNewsHeroImage
-- instead, to a "heroes/..." path, so this never touches a genuine hero
-- photo -- only the auto-generated fallback.
--
-- Clearing it is enough to self-heal: every read path that falls back to
-- the auto-generated image when hero_image_url is null
-- (NewsArticleCard/NewsInfiniteFeed's `hero_image_url || .../opengraph-image`,
-- the opengraph-image route itself) hits generate-news-og-image, which
-- regenerates with the now-current tags and re-persists hero_image_url --
-- no separate regeneration trigger needed here.
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

    -- Invalidate a stale auto-generated share-card so it re-renders with
    -- the tag set just written above -- see this migration's header.
    IF v_article.hero_image_url LIKE '%/og-cards/%' THEN
      UPDATE public.news_articles
         SET hero_image_url = NULL
       WHERE id = p_article_id;
      v_article.hero_image_url := NULL;
    END IF;
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
