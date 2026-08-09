-- Combined supporter-count + rating-avg + rating-count + comment-count per
-- politician, batched for however many a widget needs at once (candidate
-- rosters, office-holder lists, sidebars) — one round trip instead of
-- querying politician_supporters and politician_ratings separately per
-- card. Driven by unnest() + LEFT JOIN so every input id gets a row back
-- even with zero engagement, instead of the GROUP BY-only approach in
-- get_politician_rating_summaries silently omitting unrated politicians —
-- widgets need the zero row to render "0 supporters, no ratings yet"
-- instead of hiding the stats line entirely.
CREATE OR REPLACE FUNCTION public.get_politician_engagement_summaries(
  p_politician_ids UUID[],
  p_include_test BOOLEAN DEFAULT false
)
RETURNS TABLE(
  politician_id UUID,
  supporter_count INT,
  avg_rating NUMERIC,
  rating_count INT,
  comment_count INT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    ids.id AS politician_id,
    COALESCE(s.supporter_count, 0)::int AS supporter_count,
    COALESCE(r.avg_rating, 0) AS avg_rating,
    COALESCE(r.rating_count, 0)::int AS rating_count,
    COALESCE(r.comment_count, 0)::int AS comment_count
  FROM unnest(p_politician_ids) AS ids(id)
  LEFT JOIN (
    SELECT politician_id, count(*) AS supporter_count
    FROM public.politician_supporters
    WHERE politician_id = ANY(p_politician_ids) AND (p_include_test OR is_test = false)
    GROUP BY politician_id
  ) s ON s.politician_id = ids.id
  LEFT JOIN (
    SELECT politician_id,
           round(avg(rating)::numeric, 2) AS avg_rating,
           count(*) AS rating_count,
           count(comment) AS comment_count
    FROM public.politician_ratings
    WHERE politician_id = ANY(p_politician_ids) AND (p_include_test OR is_test = false)
    GROUP BY politician_id
  ) r ON r.politician_id = ids.id;
$$;

GRANT EXECUTE ON FUNCTION public.get_politician_engagement_summaries(UUID[], BOOLEAN) TO authenticated, anon;
