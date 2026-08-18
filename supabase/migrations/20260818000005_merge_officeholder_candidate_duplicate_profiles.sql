-- One-time backfill: merges every "Rick Larsen"-shaped duplicate profile
-- pair found across the platform -- same person, same electoral seat,
-- split across two independent creation pipelines that never
-- cross-referenced each other:
--   1. Bulk officeholder import (office_holders row, linked_profile_id ->
--      a freshly-minted profiles row) -- runs whenever a sitting
--      officeholder is scraped/imported.
--   2. scripts/sync_us_federal_candidates.py (and its Canadian siblings)
--      creating a fresh profiles row per 2026 candidate, including
--      incumbents running for their own seat -- with no check for an
--      existing officeholder-linked profile of the same person first.
--
-- Detection signal (deliberately NOT "same full_name" alone -- verified
-- unsafe: grouping 31,685 politician profiles by name+country alone
-- produces 547 groups, including two genuinely different real people
-- both named "Adam Smith" holding different offices in different
-- districts). The signal used here is structural instead: same full_name
-- AND the same underlying map_shape_id (the actual electoral boundary),
-- with one profile reached via office_holders and a *different* profile
-- reached via election_candidates -> election_seats for that identical
-- shape. Two different real people cannot both be "the current
-- officeholder for seat X" and "a different candidate for seat X" under
-- this signal -- narrowed to 179 pairs.
--
-- Verified before writing this migration: cross-checked political_party_id
-- between both sides of all 179 pairs. 178 matched exactly. The one
-- apparent mismatch (Ilhan Omar: "Democratic Party" vs "Democratic-Farmer-
-- Labor") is Minnesota's real, official state-affiliate party name, not a
-- different person -- both rows are the same sitting incumbent.
--
-- Direction: officeholder-linked profile is merged INTO the
-- election-candidate profile (candidate profile becomes canonical going
-- forward) -- matches how the app's current election-cycle UI already
-- resolves politicians (election_candidates.politician_id), and mirrors
-- the already-verified, already-shipped Rick Larsen fix.
--
-- Reuses the app's own officeholder-wall-claim merge machinery
-- (_execute_officeholder_wall_claim_merge) instead of hand-rolling merge
-- logic -- it already handles the old wall_slug -> redirect, moving any
-- posts/comments/supporters/ratings/news article tags (dedup-safe), and
-- repointing office_holders.linked_profile_id, exactly like a
-- human-initiated claim would. The claim/audit-trail row this creates
-- doubles as a record of what this migration did and preserves the
-- system's existing reversal path (merge_officeholder_wall_claim has a
-- documented reversal RPC) if any single merge ever needs undoing.
--
-- Each pair is merged in its own sub-transaction (BEGIN/EXCEPTION below
-- creates an implicit savepoint) so one unexpected failure logs a NOTICE
-- and is skipped, rather than rolling back every other already-succeeded
-- merge in the batch.
DO $$
DECLARE
  r RECORD;
  v_admin_id UUID;
  v_claim_id UUID;
  v_success_count INTEGER := 0;
  v_failed_count INTEGER := 0;
BEGIN
  SELECT id INTO v_admin_id FROM public.profiles WHERE role = 'admin' ORDER BY updated_at ASC LIMIT 1;
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'no admin profile found to attribute this data-fix merge to';
  END IF;

  FOR r IN
    WITH oh_side AS (
      SELECT p.id AS profile_id, p.full_name, oh.id AS office_holder_id, oh.map_shape_id, p.current_ghost_id AS ghost_id
      FROM public.profiles p
      JOIN public.office_holders oh ON oh.linked_profile_id = p.id
      WHERE p.role = 'politician'
    ),
    cand_side AS (
      SELECT p.id AS profile_id, p.full_name, es.map_shape_id, p.current_ghost_id AS ghost_id
      FROM public.profiles p
      JOIN public.election_candidates ec ON ec.politician_id = p.id
      JOIN public.election_seats es ON es.id = ec.seat_id
      WHERE p.role = 'politician'
    )
    SELECT
      o.office_holder_id,
      o.profile_id AS source_profile_id,
      o.ghost_id AS source_ghost_id,
      c.profile_id AS target_profile_id,
      c.ghost_id AS target_ghost_id,
      o.full_name
    FROM oh_side o
    JOIN cand_side c
      ON o.full_name = c.full_name
      AND o.map_shape_id = c.map_shape_id
      AND o.profile_id <> c.profile_id
  LOOP
    BEGIN
      -- Re-check the officeholder link is still what the outer query saw --
      -- defensive against a name appearing twice on the office_holders side
      -- (already merged by an earlier loop iteration for this same person).
      IF NOT EXISTS (
        SELECT 1 FROM public.office_holders
        WHERE id = r.office_holder_id AND linked_profile_id = r.source_profile_id
      ) THEN
        CONTINUE;
      END IF;

      INSERT INTO public.office_holder_wall_claims
        (office_holder_id, source_profile_id, source_ghost_id, target_profile_id, target_ghost_id,
         status, claimed_at, created_by, metadata)
      VALUES
        (r.office_holder_id, r.source_profile_id, r.source_ghost_id, r.target_profile_id, r.target_ghost_id,
         'pending_review', now(), v_admin_id,
         jsonb_build_object(
           'data_fix', true,
           'reason', 'officeholder + election_candidate duplicate profile for the same seat',
           'full_name', r.full_name
         ))
      RETURNING id INTO v_claim_id;

      PERFORM public._execute_officeholder_wall_claim_merge(v_claim_id, v_admin_id);
      v_success_count := v_success_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed_count := v_failed_count + 1;
      RAISE NOTICE 'Skipped merge for % (office_holder_id=%): %', r.full_name, r.office_holder_id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Duplicate profile merge complete: % merged, % skipped', v_success_count, v_failed_count;
END $$;
