-- Google Play launch requirements: user-initiated account deletion and
-- blocking other users' content.
--
-- Ghost model recap: posts / comments / votes store only `ghost_id`, never a
-- profile id (ARCHITECTURE.md §3). burn_ghost_identity() therefore orphans
-- everything written under the old id — nothing records which ghost ids a
-- profile once had. Account deletion can only remove content under the
-- caller's CURRENT ghost id; content under burned ids stays, permanently
-- unattributable to any person (the privacy policy / Data safety form say so).

-- ── Blocking ────────────────────────────────────────────────────────────
-- Keyed by the author's ghost id: the caller never learns who that is, and
-- the block lapses if the author burns their identity (disclosed in the UI).
CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_ghost_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_ghost_id)
);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
-- No client policies: everything goes through the RPCs below.
REVOKE ALL ON public.user_blocks FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.block_author(p_target_type TEXT, p_target_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ghost UUID;
  v_own_ghost UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_target_type = 'post' THEN
    SELECT ghost_id INTO v_ghost FROM public.posts WHERE id = p_target_id;
  ELSIF p_target_type = 'comment' THEN
    SELECT ghost_id INTO v_ghost FROM public.comments WHERE id = p_target_id;
  ELSE
    RAISE EXCEPTION 'Unknown target type: %', p_target_type;
  END IF;

  IF v_ghost IS NULL THEN
    RAISE EXCEPTION 'Content not found';
  END IF;

  SELECT current_ghost_id INTO v_own_ghost FROM public.profiles WHERE id = auth.uid();
  IF v_ghost = v_own_ghost THEN
    RAISE EXCEPTION 'You cannot block yourself';
  END IF;

  INSERT INTO public.user_blocks (blocker_id, blocked_ghost_id)
  VALUES (auth.uid(), v_ghost)
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.unblock_all_authors()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.user_blocks WHERE blocker_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.my_blocked_ghost_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT blocked_ghost_id FROM public.user_blocks WHERE blocker_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.block_author(TEXT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unblock_all_authors() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_blocked_ghost_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.block_author(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unblock_all_authors() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_blocked_ghost_ids() TO authenticated;

-- ── Account deletion ────────────────────────────────────────────────────
-- Removes the caller's content under their current ghost id, then the auth
-- user; profiles and everything referencing it ON DELETE CASCADE go with it.
-- Accounts that other records RESTRICT on (claims, admin work) and admins
-- are refused with a message pointing at support rather than half-deleted.
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_ghost UUID;
  v_role TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT current_ghost_id, role::text INTO v_ghost, v_role
  FROM public.profiles WHERE id = v_uid;

  IF v_role = 'admin' THEN
    RAISE EXCEPTION 'Admin accounts must be deleted by support. Email chosenopolicyvoices@gmail.com.';
  END IF;

  IF v_ghost IS NOT NULL THEN
    DELETE FROM public.post_votes WHERE ghost_id = v_ghost;
    DELETE FROM public.comments WHERE ghost_id = v_ghost;
    DELETE FROM public.posts WHERE ghost_id = v_ghost;
  END IF;

  BEGIN
    DELETE FROM auth.users WHERE id = v_uid;
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE EXCEPTION 'This account has linked records that need manual review. Email chosenopolicyvoices@gmail.com and we will finish the deletion.';
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
