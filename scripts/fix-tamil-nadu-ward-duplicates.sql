-- One-off correction: Chennai (and Coimbatore, Erode) were showing duplicate
-- ward boundaries -- e.g. two full sets of Chennai's wards overlapping each
-- other geographically.
--
-- Root cause: map_shapes.boundary_type='Ward' for India has FOUR separate
-- uploads, not one:
--   4b4fe530-38f1-4179-ac19-4c83c234a2c3  "India Municipal Wards (Swachh
--     Bharat Mission, APPROVED status only)" -- 63,674 wards nationwide,
--     127 Tamil Nadu ULBs, proper ulbcode metadata, ward counts matching
--     known-correct figures (e.g. exactly 200 for Chennai).
--   02e2648d-619c-44f4-b4e4-9899f9622e9d  "Tamil Nadu Municipal Wards
--     (LivingAtlas / Esri)" -- 737 wards across only 10 Tamil Nadu cities,
--     uploaded two days after the nationwide one, no ulbcode field.
--   a892c4a1-2e1b-4fad-a5d2-517270be136e  "Tambaram Municipal Boundary" --
--     a single citywide boundary (not ward-level), for a city absent from
--     the nationwide upload -- genuinely complementary, not a duplicate.
--
-- Checked all 10 of LivingAtlas's cities against the nationwide upload
-- (trimmed ulbname match, since LivingAtlas has inconsistent leading
-- whitespace in some ulbnames): only Chennai, Coimbatore, and Erode
-- actually overlap. The other 7 (Chengalpattu, Dindigul, Hosur,
-- Kanchipuram, Karur, Madurai, Thanjavur) have zero coverage in the
-- nationwide upload -- LivingAtlas is the *only* source for those, so
-- retiring the whole upload would have deleted real, non-duplicated
-- coverage instead of fixing anything.
--
-- No office_holders row referenced any LivingAtlas ward shape at the time
-- of this fix (verified before running), so this is a pure boundary-data
-- correction with no FK re-pointing needed.
UPDATE map_shapes
SET retired_at = NOW()
WHERE upload_id = '02e2648d-619c-44f4-b4e4-9899f9622e9d'
  AND trim(properties->>'ulbname') IN ('Chennai', 'Coimbatore', 'Erode')
  AND retired_at IS NULL;
