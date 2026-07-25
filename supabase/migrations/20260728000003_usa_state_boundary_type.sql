-- Registers a "State" admin_only container boundary type for USA, mirroring Canada's
-- existing admin_only "Province" type (20260727000001). Needed because Governor and U.S.
-- Senator are statewide offices -- there was previously no boundary a seat could attach to
-- for either. admin_only=true keeps it out of sync_user_boundary_memberships/
-- find_boundaries_by_point, same as Province: a citizen-facing feed tab/membership for
-- "your whole state" was never requested, only an admin container-selection aid.
--
-- rank is computed (MAX(rank)+1), not hardcoded, to avoid colliding with the 4 USA types
-- already registered (Federal=1, State Senate=2, State House=3, Municipal=4).
--
-- The actual State geometry is loaded separately via scripts/upload_boundary.py (not part of
-- this migration) once this row exists, since map_shapes.boundary_type has no FK of its own
-- but country_boundary_types is the registry every admin picker/select reads from.
INSERT INTO public.country_boundary_types (country, type_name, rank, admin_only)
SELECT 'USA', 'State', COALESCE(MAX(rank), 0) + 1, true
FROM public.country_boundary_types WHERE country = 'USA';
