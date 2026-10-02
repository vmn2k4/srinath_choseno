-- Same bug as 20261002000000, for the 72 politician_profiles that are neither
-- a candidate nor a linked office holder (orphaned import stubs). With no
-- stored slug, /wall/<ghost-id> redirects to a computed name slug that
-- /wall/[slug] can't resolve, and the sitemap lists those dead URLs. Name-only
-- slug (no role is known); ensure_candidate_wall_slug adds a short-id suffix
-- on collision.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT pp.id FROM public.politician_profiles pp
    JOIN public.profiles pr ON pr.id = pp.id
    WHERE pp.wall_slug IS NULL AND pr.current_ghost_id IS NOT NULL
  LOOP
    PERFORM public.ensure_candidate_wall_slug(r.id, NULL);
  END LOOP;
END $$;
