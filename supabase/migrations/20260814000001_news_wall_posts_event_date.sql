-- ── Set created_at on mirrored news wall posts to event_date/published_at ──
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
          ghost_id, content, image_url, wall_ghost_id, news_article_id, country, created_at
        ) VALUES (
          v_news_ghost_id,
          v_article.headline || COALESCE(chr(10) || chr(10) || v_article.summary, ''),
          v_article.hero_image_url,
          v_rec.ghost_id::text,
          p_article_id,
          v_article.country,
          COALESCE(v_article.event_date, v_article.published_at, now())
        );
      ELSE
        -- Update existing post content / created_at in case the article was updated
        UPDATE public.posts
           SET content = v_article.headline || COALESCE(chr(10) || chr(10) || v_article.summary, ''),
               image_url = v_article.hero_image_url,
               created_at = COALESCE(v_article.event_date, v_article.published_at, created_at)
         WHERE news_article_id = p_article_id
           AND wall_ghost_id = v_rec.ghost_id::text
           AND ghost_id = v_news_ghost_id;
      END IF;
    END LOOP;
  END IF;
END;
$$;
