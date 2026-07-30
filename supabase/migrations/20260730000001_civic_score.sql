-- Civic score: 10 pts/post, 5 pts/comment, +1 per like and -1 per dislike
-- received on your own posts. Deliberately NOT implemented as a stored list
-- of a profile's post/comment ids anywhere (table, file, or otherwise) --
-- any profile_id -> post_id mapping doubles as a profile_id -> ghost_id
-- deanonymization index, since post.ghost_id is already public on every
-- post. Instead civic_score is a single running total on profiles, folded
-- in from a live calculation of the *current* ghost's activity, computed
-- only at the moment it burns -- the last point a live link between the
-- profile and that ghost legitimately exists. After that, only the number
-- survives; which specific old posts contributed is not reconstructable.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS civic_score BIGINT NOT NULL DEFAULT 0;

-- Live total = banked civic_score + whatever the current (still-live) ghost
-- has earned so far. Read-only, nothing persisted -- safe to call anytime.
CREATE OR REPLACE FUNCTION public.calculate_my_score()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ghost_id UUID;
  v_banked BIGINT;
  v_live BIGINT;
BEGIN
  SELECT current_ghost_id, civic_score INTO v_ghost_id, v_banked
  FROM public.profiles WHERE id = auth.uid();

  IF v_ghost_id IS NULL THEN
    RETURN COALESCE(v_banked, 0);
  END IF;

  SELECT
    (SELECT count(*) FROM public.posts WHERE ghost_id = v_ghost_id) * 10
    + (SELECT count(*) FROM public.comments WHERE ghost_id = v_ghost_id) * 5
    + COALESCE((SELECT sum(likes_count) - sum(dislikes_count) FROM public.posts WHERE ghost_id = v_ghost_id), 0)
  INTO v_live;

  RETURN COALESCE(v_banked, 0) + COALESCE(v_live, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_my_score() TO authenticated;

-- Bank the outgoing ghost's contribution before rotating it away.
CREATE OR REPLACE FUNCTION public.burn_ghost_identity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ghost_id UUID;
  v_contribution BIGINT;
BEGIN
  SELECT current_ghost_id INTO v_ghost_id FROM public.profiles WHERE id = auth.uid();

  SELECT
    (SELECT count(*) FROM public.posts WHERE ghost_id = v_ghost_id) * 10
    + (SELECT count(*) FROM public.comments WHERE ghost_id = v_ghost_id) * 5
    + COALESCE((SELECT sum(likes_count) - sum(dislikes_count) FROM public.posts WHERE ghost_id = v_ghost_id), 0)
  INTO v_contribution;

  UPDATE public.profiles
  SET civic_score = civic_score + COALESCE(v_contribution, 0),
      current_ghost_id = gen_random_uuid(),
      updated_at = timezone('utc'::text, now())
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.burn_ghost_identity() TO authenticated;
