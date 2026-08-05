-- create_wall_post(): replaces politicianWall.ts's createWallPost raw
-- insert, which (a) let a client set any ghost_id/wall_ghost_id it wanted
-- with no server-side check, and (b) never set is_country/is_international/
-- country/post_boundaries, so a post made from the Wall composer never
-- showed up in the main feed. This RPC fixes both: it resolves the poster's
-- ghost_id from auth.uid() like create_post() does, and sets the same
-- feed-visibility fields create_post() sets, so a Wall post now appears on
-- both the Wall and the main feed.
--
-- Deliberately does NOT enforce the politician daily-post-limit from
-- create_post() -- Wall/Candidacy posting stays a separate, unlimited flow
-- (confirmed scope decision). createCandidatePost/CandidacyWall.tsx is a
-- distinct, unrelated function and is not touched by this migration.
CREATE OR REPLACE FUNCTION public.create_wall_post(
  p_content        TEXT,
  p_image_url      TEXT DEFAULT NULL,
  p_video_url      TEXT DEFAULT NULL,
  p_link_metadata  JSONB DEFAULT NULL,
  p_wall_ghost_id  TEXT DEFAULT NULL
) RETURNS public.posts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ghost_id UUID;
  v_country TEXT;
  v_banked BIGINT;
  v_live BIGINT;
  v_post public.posts;
BEGIN
  SELECT current_ghost_id, country, civic_score
    INTO v_ghost_id, v_country, v_banked
    FROM public.profiles WHERE id = auth.uid();

  IF v_ghost_id IS NULL THEN
    RAISE EXCEPTION 'Ghost identity not found';
  END IF;

  SELECT
    (SELECT count(*) FROM public.posts WHERE ghost_id = v_ghost_id) * 10
    + (SELECT count(*) FROM public.comments WHERE ghost_id = v_ghost_id) * 5
    + COALESCE((SELECT sum(likes_count) - sum(dislikes_count) FROM public.posts WHERE ghost_id = v_ghost_id), 0)
  INTO v_live;

  INSERT INTO public.posts (
    ghost_id, content, image_url, video_url, link_metadata,
    country, is_country, is_international, wall_ghost_id, civic_score_snapshot
  ) VALUES (
    v_ghost_id, p_content, p_image_url, p_video_url, p_link_metadata,
    v_country, true, true,
    COALESCE(p_wall_ghost_id, v_ghost_id::text),
    COALESCE(v_banked, 0) + COALESCE(v_live, 0)
  ) RETURNING * INTO v_post;

  INSERT INTO public.post_boundaries (post_id, map_shape_id)
  SELECT v_post.id, map_shape_id FROM public.user_boundary_memberships WHERE profile_id = auth.uid();

  RETURN v_post;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_wall_post(TEXT, TEXT, TEXT, JSONB, TEXT) TO authenticated;
