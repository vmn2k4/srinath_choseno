-- Unify a politician's permanent wall with their election candidacy walls.
-- Until now these were two disjoint post sets: PoliticianWall's getWallPosts
-- matches posts.ghost_id/wall_ghost_id = the wall owner's ghost, while
-- CandidacyWall's getCandidatePosts matched posts.election_candidate_id =
-- the candidacy row instead. Same person, two unrelated feeds depending on
-- which URL you viewed them from -- any discussion happening on a candidacy
-- (reviews, video pitches) never showed up on the person's permanent wall,
-- and vice versa.
--
-- Backfill: existing candidacy posts never got wall_ghost_id set at
-- creation time. Tag them with the candidate's current ghost id so
-- getWallPosts picks them up too. (Going forward, CandidacyWall's post
-- composer sets wall_ghost_id directly -- see CandidacyWall.jsx.)
UPDATE public.posts p
SET wall_ghost_id = pr.current_ghost_id::text
FROM public.election_candidates ec
JOIN public.profiles pr ON pr.id = ec.politician_id
WHERE p.election_candidate_id = ec.id
  AND p.wall_ghost_id IS NULL;
