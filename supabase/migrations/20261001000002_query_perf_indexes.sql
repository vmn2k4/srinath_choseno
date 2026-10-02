-- Perf pass driven by pg_stat_statements (stats since 2026-09-12).
--
-- 1. News feed (/news, home, article "related"): ORDER BY event_date DESC
--    NULLS LAST, published_at DESC had no matching index, so every call
--    seq-scanned + sorted all ~5.5K articles (41K seq scans, 191M rows read).
--    Partial indexes let Postgres walk the index and stop after LIMIT rows.
CREATE INDEX IF NOT EXISTS idx_news_articles_feed
  ON public.news_articles (event_date DESC NULLS LAST, published_at DESC)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_news_articles_category_feed
  ON public.news_articles (category, event_date DESC NULLS LAST, published_at DESC)
  WHERE status = 'published';

-- 2. Wall feeds filter `ghost_id = X OR wall_ghost_id = X`; only ghost_id was
--    indexed, so the OR forced a seq scan of posts (25K seq scans).
CREATE INDEX IF NOT EXISTS idx_posts_wall_ghost_id
  ON public.posts (wall_ghost_id)
  WHERE wall_ghost_id IS NOT NULL;

-- 3. sync_election_status() is called ~32K times (mobile elections list) and
--    rewrote every non-draft/closed election row each time even when nothing
--    changed -- dead tuples, WAL and row-lock contention. Only touch rows whose
--    computed status actually differs.
CREATE OR REPLACE FUNCTION public.sync_election_status(p_election_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.elections
  SET status = public.compute_election_status(status, nomination_close_date, election_date)
  WHERE (p_election_id IS NULL OR id = p_election_id)
    AND status NOT IN ('draft', 'closed')
    AND status IS DISTINCT FROM public.compute_election_status(status, nomination_close_date, election_date);
END;
$function$;
