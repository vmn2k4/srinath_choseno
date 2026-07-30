-- burn_ghost_identity() was called by the client (src/services/feed.js) but
-- never actually existed in the database — the "Burn Identity" button on
-- FeedPage silently failed (RPC-not-found error caught and only
-- console.error'd, no user-facing message), so current_ghost_id never
-- changed. This adds the RPC the client already expects: regenerate the
-- caller's current_ghost_id, leaving all existing posts/comments untouched
-- (they keep the old, now-orphaned ghost_id forever, per the core
-- anonymity model in ARCHITECTURE.md §3).
CREATE OR REPLACE FUNCTION public.burn_ghost_identity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET current_ghost_id = gen_random_uuid(),
      updated_at = timezone('utc'::text, now())
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.burn_ghost_identity() TO authenticated;
