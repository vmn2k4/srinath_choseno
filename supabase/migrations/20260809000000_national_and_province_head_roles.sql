-- National-level head of government (Prime Minister for Canada, President for
-- USA) and Premier for Canada's existing Province container, so the Feed's
-- "All Districts" view can show them as the user's representative alongside
-- their riding-level MP/MLA/Mayor -- not a citizen membership or feed filter
-- (see FeedPageClient.tsx's filterPills), so this follows the same
-- admin_only pattern as Canada's existing Province container
-- (20260727000001_admin_only_boundary_types.sql): excluded from
-- sync_user_boundary_memberships / find_boundaries_by_point, resolved
-- directly by profile.country instead. USA's Governor role already exists on
-- the 'State' boundary type (20260728000005) -- only President is new there.
INSERT INTO public.country_boundary_types (country, type_name, rank, admin_only, is_container)
SELECT 'Canada', 'National', COALESCE(MAX(rank), 0) + 1, true, false
FROM public.country_boundary_types WHERE country = 'Canada'
ON CONFLICT (country, type_name) DO NOTHING;

INSERT INTO public.country_boundary_types (country, type_name, rank, admin_only, is_container)
SELECT 'USA', 'National', COALESCE(MAX(rank), 0) + 1, true, false
FROM public.country_boundary_types WHERE country = 'USA'
ON CONFLICT (country, type_name) DO NOTHING;

-- One placeholder shape per country to anchor office_holders.map_shape_id to.
-- geom is left NULL (nullable column, map_shapes DDL) -- this shape is never
-- geometrically queried (admin_only excludes it from every point-in-polygon
-- flow) and never rendered on a map; it exists purely as an id to hang a
-- Prime Minister/President office_holders row off of.
INSERT INTO public.map_shapes (country, boundary_type, name)
SELECT 'Canada', 'National', 'Canada'
WHERE NOT EXISTS (SELECT 1 FROM public.map_shapes WHERE country = 'Canada' AND boundary_type = 'National');

INSERT INTO public.map_shapes (country, boundary_type, name)
SELECT 'USA', 'National', 'United States'
WHERE NOT EXISTS (SELECT 1 FROM public.map_shapes WHERE country = 'USA' AND boundary_type = 'National');

-- Role catalog: Prime Minister (Canada, National) / President (USA, National),
-- and Premier on Canada's existing Province container (mirrors USA's Governor
-- role on its State container, 20260728000005_election_role_types_usa_state.sql).
INSERT INTO public.election_role_types (country, boundary_type, role_key, region_override, role_title) VALUES
  ('Canada', 'National', 'prime_minister', '', 'Prime Minister'),
  ('Canada', 'Province', 'premier', '', 'Premier'),
  ('USA', 'National', 'president', '', 'President')
ON CONFLICT (country, boundary_type, role_key, region_override) DO NOTHING;
