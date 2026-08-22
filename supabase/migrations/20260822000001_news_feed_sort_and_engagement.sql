-- Backs the /news infinite feed's Sort dropdown (Recent / Engagement /
-- Interesting Stories) and its Last-2-days/week/month time filter.
--
-- "Recent" and the time-range filter need nothing new -- event_date/
-- published_at already exist and are indexed by the existing default
-- ordering. This migration adds the two pieces that don't:
--
--   1. news_articles.viral_score -- a real, sortable/indexable column
--      generated from content->>'viral_score' (already written by the news
--      pipeline, see NewsArticleContent.viral_score in lib/services/news.ts)
--      so "Interesting Stories" can ORDER BY it directly via PostgREST
--      instead of needing an unsupported ORDER BY on a raw JSONB expression.
--      Uses a small IMMUTABLE safe-cast helper, not a bare `::numeric`,
--      because content is free-form AI-pipeline JSONB -- a single malformed
--      or missing viral_score must not fail every insert/update to this
--      table (a plain STORED-generated `(content->>'viral_score')::numeric`
--      would throw on any row where that string isn't valid numeric text).
--
--   2. get_news_article_engagement_rank() -- "Engagement" (real citizen
--      discussion volume) needs a COUNT(*) over posts per article, which
--      isn't a per-row column and can't be a generated column (those can't
--      contain subqueries). A STABLE SQL function computes it, applies the
--      feed's own filters (published, time range, country, category) and
--      pagination, and returns just article ids in engagement order --
--      the service layer (getPublishedNewsArticlesByEngagement in
--      lib/services/news.ts) re-fetches the full rows (with the politician
--      join PostgREST can't reliably auto-detect through a view) via
--      `.in('id', ...)` and re-sorts them client-side to match.
--      SECURITY INVOKER (the default) is enough here -- both news_articles
--      (published rows) and posts are already public-SELECT per their own
--      RLS policies, same reasoning as every other public news query.

CREATE OR REPLACE FUNCTION public._safe_numeric(input text) RETURNS numeric
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  RETURN input::numeric;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS viral_score numeric GENERATED ALWAYS AS (public._safe_numeric(content->>'viral_score')) STORED;

CREATE INDEX IF NOT EXISTS news_articles_viral_score_idx ON public.news_articles (viral_score DESC NULLS LAST);

-- Same "engagement" definition getNewsArticleComments() already uses for
-- the article's own comment section: posts tagged to this article that are
-- real citizen posts, not the auto-mirrored wall-post copy (wall_ghost_id
-- IS NULL) and not authored by the news-system sentinel ghost.
CREATE OR REPLACE FUNCTION public.get_news_article_engagement_rank(
  p_limit int,
  p_offset int,
  p_event_date_after timestamptz DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_category text DEFAULT NULL
) RETURNS TABLE(id uuid, engagement_count bigint, total_count bigint)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH counts AS (
    SELECT news_article_id, count(*) AS engagement_count
    FROM public.posts
    WHERE news_article_id IS NOT NULL
      AND wall_ghost_id IS NULL
      AND ghost_id <> '00000000-0000-0000-0000-000000000001'
    GROUP BY news_article_id
  ),
  base AS (
    SELECT na.id, COALESCE(c.engagement_count, 0) AS engagement_count
    FROM public.news_articles na
    LEFT JOIN counts c ON c.news_article_id = na.id
    WHERE na.status = 'published'
      AND na.published_at <= now()
      AND (p_event_date_after IS NULL OR COALESCE(na.event_date, na.published_at) >= p_event_date_after)
      AND (p_country IS NULL OR na.country = p_country)
      AND (p_category IS NULL OR na.category = p_category)
  )
  SELECT base.id, base.engagement_count, count(*) OVER() AS total_count
  FROM base
  ORDER BY base.engagement_count DESC, base.id
  LIMIT p_limit OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.get_news_article_engagement_rank(int, int, timestamptz, text, text) TO anon, authenticated;
