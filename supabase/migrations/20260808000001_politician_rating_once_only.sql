-- Ratings are cast once, like a vote — no editing after submission. Replaces
-- the ON CONFLICT DO UPDATE upsert with a hard reject if a rating already
-- exists for (politician_id, rater_id): the unique constraint from
-- 20260808000000 still backstops this at the DB level, but this gives a
-- clean error message instead of a raw constraint-violation exception.
CREATE OR REPLACE FUNCTION public.upsert_politician_rating(
  p_politician_id UUID,
  p_rating SMALLINT,
  p_comment TEXT DEFAULT NULL,
  p_is_test BOOLEAN DEFAULT false
)
RETURNS public.politician_ratings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ghost_id UUID;
  v_is_politician BOOLEAN;
  v_already_rated BOOLEAN;
  v_row public.politician_ratings;
BEGIN
  IF p_politician_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot rate yourself';
  END IF;

  SELECT current_ghost_id INTO v_ghost_id FROM public.profiles WHERE id = auth.uid();
  IF v_ghost_id IS NULL THEN
    RAISE EXCEPTION 'Ghost identity not found';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.politician_ratings
    WHERE politician_id = p_politician_id AND rater_id = auth.uid()
  ) INTO v_already_rated;
  IF v_already_rated THEN
    RAISE EXCEPTION 'You have already rated this politician';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.politician_profiles WHERE id = p_politician_id
  ) INTO v_is_politician;
  IF NOT v_is_politician THEN
    RAISE EXCEPTION 'Target is not a politician profile';
  END IF;

  INSERT INTO public.politician_ratings (politician_id, rater_id, ghost_id, rating, comment, is_test)
  VALUES (p_politician_id, auth.uid(), v_ghost_id, p_rating, NULLIF(TRIM(p_comment), ''), p_is_test)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_politician_rating(UUID, SMALLINT, TEXT, BOOLEAN) TO authenticated;
