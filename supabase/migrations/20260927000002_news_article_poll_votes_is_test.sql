-- is_test parity for poll votes -- caught live while verifying anonymous
-- voting: get_news_article_poll_results had no is_test filter at all, so a
-- dev-environment test vote (anon votes already carry is_test, set by
-- castAnonymousNewsArticlePollVote) would silently count toward the real
-- public tally shown to every reader, exactly like every other engagement
-- RPC in this app (get_politician_engagement_summaries,
-- get_politician_rating_summaries) already guards against via
-- p_include_test. news_article_poll_votes (the signed-in path) didn't even
-- have the column to filter on.

ALTER TABLE public.news_article_poll_votes
  ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;

DROP FUNCTION IF EXISTS public.cast_news_article_poll_vote(UUID);

CREATE OR REPLACE FUNCTION public.cast_news_article_poll_vote(
  p_option_id UUID,
  p_is_test BOOLEAN DEFAULT false
)
RETURNS public.news_article_poll_votes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_poll_id UUID;
  v_row     public.news_article_poll_votes;
BEGIN
  SELECT poll_id INTO v_poll_id FROM public.news_article_poll_options WHERE id = p_option_id;
  IF v_poll_id IS NULL THEN
    RAISE EXCEPTION 'Unknown poll option';
  END IF;

  INSERT INTO public.news_article_poll_votes (poll_id, option_id, voter_id, is_test)
  VALUES (v_poll_id, p_option_id, auth.uid(), p_is_test)
  ON CONFLICT (poll_id, voter_id) DO UPDATE
    SET option_id = EXCLUDED.option_id,
        is_test = EXCLUDED.is_test,
        updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cast_news_article_poll_vote(UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_news_article_poll_results(
  p_poll_ids UUID[],
  p_include_test BOOLEAN DEFAULT false
)
RETURNS TABLE(poll_id UUID, option_id UUID, vote_count INT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT poll_id, option_id, SUM(vote_count)::int AS vote_count
  FROM (
    SELECT poll_id, option_id, COUNT(*) AS vote_count
    FROM public.news_article_poll_votes
    WHERE poll_id = ANY(p_poll_ids) AND (p_include_test OR is_test = false)
    GROUP BY poll_id, option_id
    UNION ALL
    SELECT poll_id, option_id, COUNT(*) AS vote_count
    FROM public.news_article_anon_poll_votes
    WHERE poll_id = ANY(p_poll_ids) AND (p_include_test OR is_test = false)
    GROUP BY poll_id, option_id
  ) combined
  GROUP BY poll_id, option_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_news_article_poll_results(UUID[], BOOLEAN) TO authenticated, anon;
