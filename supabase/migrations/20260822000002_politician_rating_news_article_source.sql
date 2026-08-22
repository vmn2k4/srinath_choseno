-- Records which news article (if any) prompted a politician rating, so a
-- reader looking at a politician's past reviews can see what each one was
-- actually reacting to -- a rating cast from within a news article links
-- back to it; one cast directly from the politician's own profile/wall (or
-- anywhere else with no article in context) has no link, same as before.
--
-- Nullable, ON DELETE SET NULL: deleting the source article must never
-- delete or orphan the rating itself (that's real community feedback,
-- independent of whether the article that prompted it still exists) --
-- it just loses its "why" link.
ALTER TABLE public.politician_ratings
  ADD COLUMN IF NOT EXISTS source_news_article_id uuid REFERENCES public.news_articles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS politician_ratings_source_news_article_id_idx
  ON public.politician_ratings (source_news_article_id)
  WHERE source_news_article_id IS NOT NULL;

-- Same function, one new optional param. Set on both first INSERT and every
-- re-rate (ON CONFLICT DO UPDATE) -- a re-rate through a different article
-- six months later is a new "why", and re-rating directly from the profile
-- after previously rating via an article correctly clears the old link
-- (EXCLUDED.source_news_article_id is NULL in that case), matching every
-- other column here (rating/comment) already being "whatever this cast
-- says now", not an accumulating history.
--
-- Adding a parameter changes the function's signature, so CREATE OR REPLACE
-- alone would leave the old 4-arg version behind as a separate overload
-- (Postgres only replaces an exact signature match) -- every call from here
-- on would then be ambiguous between the two. Drop the old signature first.
DROP FUNCTION IF EXISTS public.upsert_politician_rating(UUID, SMALLINT, TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION public.upsert_politician_rating(
  p_politician_id UUID,
  p_rating SMALLINT,
  p_comment TEXT DEFAULT NULL,
  p_is_test BOOLEAN DEFAULT false,
  p_news_article_id UUID DEFAULT NULL
)
RETURNS public.politician_ratings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ghost_id UUID;
  v_is_politician BOOLEAN;
  v_existing public.politician_ratings;
  v_row public.politician_ratings;
BEGIN
  IF p_politician_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot rate yourself';
  END IF;

  SELECT current_ghost_id INTO v_ghost_id FROM public.profiles WHERE id = auth.uid();
  IF v_ghost_id IS NULL THEN
    RAISE EXCEPTION 'Ghost identity not found';
  END IF;

  SELECT * INTO v_existing FROM public.politician_ratings
  WHERE politician_id = p_politician_id AND rater_id = auth.uid();

  IF FOUND AND v_existing.updated_at > now() - INTERVAL '6 months' THEN
    RAISE EXCEPTION 'You can rate this politician again on %',
      to_char(v_existing.updated_at + INTERVAL '6 months', 'YYYY-MM-DD');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.politician_profiles WHERE id = p_politician_id
  ) INTO v_is_politician;
  IF NOT v_is_politician THEN
    RAISE EXCEPTION 'Target is not a politician profile';
  END IF;

  -- A caller-supplied article id is only ever trusted if it's a real,
  -- published article that actually tags this politician -- otherwise the
  -- link is silently dropped rather than trusting arbitrary client input
  -- to attach any article to any rating.
  IF p_news_article_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.news_article_politicians
     WHERE news_article_id = p_news_article_id AND politician_id = p_politician_id
  ) THEN
    p_news_article_id := NULL;
  END IF;

  INSERT INTO public.politician_ratings (politician_id, rater_id, ghost_id, rating, comment, is_test, source_news_article_id)
  VALUES (p_politician_id, auth.uid(), v_ghost_id, p_rating, NULLIF(TRIM(p_comment), ''), p_is_test, p_news_article_id)
  ON CONFLICT (politician_id, rater_id) DO UPDATE
    SET rating = EXCLUDED.rating,
        comment = EXCLUDED.comment,
        ghost_id = EXCLUDED.ghost_id,
        source_news_article_id = EXCLUDED.source_news_article_id,
        updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_politician_rating(UUID, SMALLINT, TEXT, BOOLEAN, UUID) TO authenticated;
