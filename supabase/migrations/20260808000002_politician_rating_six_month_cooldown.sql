-- Relax "rate once forever" to "rate once per 6 months" — a constituent's
-- opinion of a politician can genuinely change, so instead of a permanent
-- lock we gate re-rating on how recently they last rated (updated_at, which
-- this migration starts bumping on every successful (re-)rate). created_at
-- stays fixed at the first-ever cast so "how long have they been rated"
-- stays queryable; updated_at is "how fresh is their current opinion" and is
-- what both the cooldown check and the reviews list's recency sort use.
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

  INSERT INTO public.politician_ratings (politician_id, rater_id, ghost_id, rating, comment, is_test)
  VALUES (p_politician_id, auth.uid(), v_ghost_id, p_rating, NULLIF(TRIM(p_comment), ''), p_is_test)
  ON CONFLICT (politician_id, rater_id) DO UPDATE
    SET rating = EXCLUDED.rating,
        comment = EXCLUDED.comment,
        ghost_id = EXCLUDED.ghost_id,
        updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_politician_rating(UUID, SMALLINT, TEXT, BOOLEAN) TO authenticated;
