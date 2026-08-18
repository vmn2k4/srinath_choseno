-- Three indexes for query patterns that were already running unindexed on
-- one side of their filter, found by reading the actual service-layer
-- calls (not a blanket "index everything" pass -- extra indexes cost write
-- overhead and storage on every future insert, so only columns a real
-- query filters/joins on earned one here). All three tables are tiny today,
-- so this costs near-nothing in storage now and avoids an expensive
-- add-index-under-load moment later once posts/profiles/supporters grow.

-- politician_supporters has PRIMARY KEY (politician_id, supporter_id), which
-- only serves lookups led by politician_id (getSupportStatus,
-- getSupporterCount). getMySupportedPoliticianIds -- "which of these
-- candidates does the viewer already support", added for the election
-- Results poll -- filters by supporter_id first with politician_id as a
-- small IN-list, which the composite PK can't serve as an index-only scan.
CREATE INDEX IF NOT EXISTS idx_politician_supporters_supporter
  ON public.politician_supporters(supporter_id);

-- profiles.current_ghost_id has never been indexed despite being the
-- lookup key for every politician-wall page view (getWallOwnerProfile /
-- getWallOwnerProfileBySlug's .eq("current_ghost_id", ghostId) fallback,
-- office-holder-to-profile linking). Partial index: only profiles that have
-- claimed a wall/ghost identity ever get looked up this way, so excluding
-- NULLs keeps the index a fraction of the full profiles table.
CREATE INDEX IF NOT EXISTS idx_profiles_current_ghost_id
  ON public.profiles(current_ghost_id)
  WHERE current_ghost_id IS NOT NULL;

-- posts.ghost_id is already indexed (idx_posts_ghost_id), but every wall
-- page's getWallPosts() queries `.or(ghost_id.eq.X, wall_ghost_id.eq.X)` --
-- an OR across two columns only avoids a sequential scan when both sides
-- have a supporting index. wall_ghost_id was the unindexed half, on what is
-- likely the single highest-traffic read query in the app.
CREATE INDEX IF NOT EXISTS idx_posts_wall_ghost_id
  ON public.posts(wall_ghost_id);
