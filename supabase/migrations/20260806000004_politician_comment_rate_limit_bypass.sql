-- Remove comment rate limit restrictions for politicians (and admins), allowing politicians unlimited comments on wall and feed posts.

CREATE OR REPLACE FUNCTION public.create_comment(p_post_id UUID, p_content TEXT)
RETURNS public.comments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ghost_id UUID;
  v_role TEXT;
  v_last_commented_at TIMESTAMPTZ;
  v_days_remaining NUMERIC;
  v_comment public.comments;
BEGIN
  SELECT current_ghost_id, role INTO v_ghost_id, v_role
  FROM public.profiles WHERE id = auth.uid();

  IF v_ghost_id IS NULL THEN
    RAISE EXCEPTION 'Ghost identity not found';
  END IF;

  -- Bypass 7-day comment rate limit for politicians and admins
  IF v_role NOT IN ('politician', 'admin') THEN
    SELECT last_commented_at INTO v_last_commented_at
    FROM public.comment_rate_limits
    WHERE user_id = auth.uid() AND post_id = p_post_id;

    IF v_last_commented_at IS NOT NULL AND v_last_commented_at > now() - INTERVAL '7 days' THEN
      v_days_remaining := CEIL(EXTRACT(EPOCH FROM (v_last_commented_at + INTERVAL '7 days' - now())) / 86400.0);
      RAISE EXCEPTION 'You can comment on this again in % day(s).', v_days_remaining;
    END IF;
  END IF;

  INSERT INTO public.comments (post_id, ghost_id, content)
  VALUES (p_post_id, v_ghost_id, p_content)
  RETURNING * INTO v_comment;

  -- Only log rate limits for regular constituents
  IF v_role NOT IN ('politician', 'admin') THEN
    INSERT INTO public.comment_rate_limits (user_id, post_id, last_commented_at)
    VALUES (auth.uid(), p_post_id, now())
    ON CONFLICT (user_id, post_id) DO UPDATE SET last_commented_at = now();
  END IF;

  RETURN v_comment;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_comment(UUID, TEXT) TO authenticated;
