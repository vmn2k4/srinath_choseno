-- One-off cleanup: scripts/sync-bc-election-results.py matched winners
-- against map_shapes filtered only by country='Canada', with no province
-- scoping. Place names collide across provinces constantly (Victoria,
-- Woodstock, Richmond, Hope, Armstrong, Mackenzie, ...), and this feed is
-- BC-only by definition, so any name that resolved to a different
-- province's shape was always wrong. Confirmed 30 real BC officeholders
-- had been silently written onto other provinces' identically-named
-- shapes:
--   BC's Hope       -> Quebec's "Hope"               (7 councillors)
--   BC's Richmond   -> Quebec's "Richmond"            (9, incl. Malcolm Brodie)
--   BC's Armstrong  -> Manitoba's "Armstrong"         (7)
--   BC's Mackenzie  -> Alberta's "Mackenzie County"   (7) -- via
--     normalize_municipal_name() stripping a trailing "County" suffix,
--     colliding "Mackenzie" (BC) and "Mackenzie County" (Alberta) down to
--     the same normalized key
--
-- These are placement errors, not real people leaving real office, so they
-- were deleted outright rather than run through the is_current/
-- term_ended_at retirement flow (which is for genuine term transitions).
-- Verified before deleting: zero wall claims, zero supporters, zero post
-- mentions, zero candidacies referencing any of them -- safe to remove
-- both the office_holders rows and the ghost profiles/wall pages that had
-- been auto-created for them.
--
-- The correct BC shapes (Hope, Richmond, Armstrong, Mackenzie) already had
-- pre-existing officeholder data from before this incident and were
-- separately reconciled by re-running the now-fixed
-- sync-bc-election-results.py (see scripts/bc-election-results-sync.sql).
BEGIN;

DELETE FROM politician_profiles WHERE id IN (
  SELECT linked_profile_id FROM office_holders
  WHERE map_shape_id IN (19716, 17400, 21093, 17887) AND is_current = true
);
DELETE FROM profiles WHERE id IN (
  SELECT linked_profile_id FROM office_holders
  WHERE map_shape_id IN (19716, 17400, 21093, 17887) AND is_current = true
);
DELETE FROM office_holders
WHERE map_shape_id IN (19716, 17400, 21093, 17887) AND is_current = true;

COMMIT;
