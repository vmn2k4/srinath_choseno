-- Comment rate limiting: one comment per (real user, post) per rolling 7
-- days, to stop the feed from being spammed with repeat comments while
-- keeping ghost-id anonymity intact toward other users.
--
-- Must key off auth.uid() rather than the caller's current_ghost_id --
-- burn_ghost_identity() rotates current_ghost_id, and a ghost-keyed limit
-- would let a user reset their own cooldown by burning. Only this
-- SECURITY DEFINER function ever reads/writes comment_rate_limits, so the
-- real user id never leaks to anyone else -- same trust boundary already
-- used by burn_ghost_identity().
--
-- comments previously allowed any authenticated insert directly (see
-- init_schema.sql); that policy is dropped below so create_comment() is the
-- only path in -- mirrors the precedent in fix_answer_comment_rls.sql.

CREATE TABLE IF NOT EXISTS public.comment_rate_limits (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  last_commented_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

ALTER TABLE public.comment_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies for `authenticated` -- only SECURITY DEFINER functions (which
-- bypass RLS) may read or write this table.

CREATE OR REPLACE FUNCTION public.create_comment(p_post_id UUID, p_content TEXT)
RETURNS public.comments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ghost_id UUID;
  v_last_commented_at TIMESTAMPTZ;
  v_days_remaining NUMERIC;
  v_comment public.comments;
BEGIN
  SELECT current_ghost_id INTO v_ghost_id FROM public.profiles WHERE id = auth.uid();

  IF v_ghost_id IS NULL THEN
    RAISE EXCEPTION 'Ghost identity not found';
  END IF;

  SELECT last_commented_at INTO v_last_commented_at
  FROM public.comment_rate_limits
  WHERE user_id = auth.uid() AND post_id = p_post_id;

  IF v_last_commented_at IS NOT NULL AND v_last_commented_at > now() - INTERVAL '7 days' THEN
    v_days_remaining := CEIL(EXTRACT(EPOCH FROM (v_last_commented_at + INTERVAL '7 days' - now())) / 86400.0);
    RAISE EXCEPTION 'You can comment on this again in % day(s).', v_days_remaining;
  END IF;

  INSERT INTO public.comments (post_id, ghost_id, content)
  VALUES (p_post_id, v_ghost_id, p_content)
  RETURNING * INTO v_comment;

  INSERT INTO public.comment_rate_limits (user_id, post_id, last_commented_at)
  VALUES (auth.uid(), p_post_id, now())
  ON CONFLICT (user_id, post_id) DO UPDATE SET last_commented_at = now();

  RETURN v_comment;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_comment(UUID, TEXT) TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can insert comments" ON public.comments;
