-- Promotes USA's 'State' boundary type from admin_only (container-selection-only,
-- added in 20260728000003 solely so Governor/U.S. Senator seats had a boundary
-- to attach to) to a normal, citizen-facing boundary type -- decided with the
-- user after finding that keeping 'State' admin_only left Governor/Senate races
-- structurally invisible to citizens: ElectionsPage.jsx and
-- get_active_elections_for_user() both scope to user_boundary_memberships, and
-- admin_only types are deliberately excluded from ever populating that table
-- (20260727000001_admin_only_boundary_types.sql). It also unblocked *creating*
-- those seats at all -- ElectionsAdmin.jsx's seat-creation UI only ever lists
-- non-admin_only types as a seat's target boundary type; admin_only types there
-- are container-selection-only. Both gates are driven dynamically off this one
-- admin_only column, so flipping it is the entire fix -- no code changes needed
-- in sync_user_boundary_memberships, find_boundaries_by_point,
-- add_user_boundary_membership, get_active_elections_for_user, or
-- ElectionsAdmin.jsx/BoundaryVisualizer.jsx's target/container-type dropdowns.
--
-- Trade-offs accepted:
--   * 'State' can no longer be picked as a *container* to scope a Federal/
--     Municipal seat-creation batch (e.g. "every House district in
--     California") -- that capability existed structurally (any admin_only
--     type doubles as a container) but was never the reason 'State' was
--     added and wasn't otherwise in use.
--   * resolve_region_names(shape_ids, 'USA') (20260728000001) will now find
--     zero admin_only containers for USA and return no rows -- harmless,
--     since no USA role_key has ever used a non-'' region_override (only
--     Canada's Provincial MPP/MNA/MHA does); callers already fall back to
--     each role's '' default title when no region resolves.
UPDATE public.country_boundary_types
SET admin_only = false
WHERE country = 'USA' AND type_name = 'State';

-- Backfill: reconcile_shape_memberships() (20260723000000) only fires on a
-- map_shapes insert/geometry update, not on this admin_only flag flip, so
-- existing users would otherwise get no membership in their own state until
-- their location next happens to re-sync. One-time backfill for every user
-- with a stored location, mirroring reconcile_shape_memberships()'s own
-- insert logic exactly.
INSERT INTO public.user_boundary_memberships (profile_id, map_shape_id)
SELECT ul.profile_id, ms.id
FROM public.user_locations ul
JOIN public.map_shapes ms
  ON ms.country = 'USA' AND ms.boundary_type = 'State' AND ms.retired_at IS NULL
WHERE ul.latitude IS NOT NULL AND ul.longitude IS NOT NULL
  AND ST_Contains(ms.geom, ST_SetSRID(ST_Point(ul.longitude, ul.latitude), 4326))
ON CONFLICT (profile_id, map_shape_id) DO NOTHING;
