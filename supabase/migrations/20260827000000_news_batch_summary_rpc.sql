-- Admin > News Distribution page (AdminNewsDistributionClient.tsx) was slow
-- to load: listDistinctBatches() in src/lib/services/news.ts paged through
-- EVERY published news_articles row (2026 rows / ~4MB of `content` JSONB as
-- of 2026-08-27) on every page load and every Refresh click, just to
-- GROUP BY content->>'batch_number' in JS for a ~140-entry dropdown. The
-- article table itself was already paginated correctly at the DB level
-- (.range() + count:"exact" in listNewsArticlesForDistribution) -- this was
-- the one unbounded query on the page.
--
-- Fix: do the aggregation in Postgres and return only the (batch, count)
-- pairs. No SECURITY DEFINER needed -- "Public can read published news
-- articles" (20260804000001_news_platform.sql) already lets this run as a
-- normal RLS-respecting function for anon/authenticated callers.
CREATE OR REPLACE FUNCTION public.get_news_batch_summary()
RETURNS TABLE (batch text, count bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE(
      NULLIF(trim(content->>'batch_number'), ''),
      to_char(COALESCE(published_at, created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI')
    ) AS batch,
    count(*) AS count
  FROM public.news_articles
  WHERE status = 'published'
  GROUP BY 1
  ORDER BY 1 DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_news_batch_summary() TO anon, authenticated;
