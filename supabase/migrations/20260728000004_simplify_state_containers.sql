-- Applies the same unconditional simplify pass to USA's admin_only "State" container layer
-- that Canada's "Province" layer needed (20260727000004) -- there, an upload-time simplify
-- alone was insufficient and find_shapes_within timed out through PostgREST until the STORED
-- geometry was simplified further. Doing this unconditionally now (all 50 states, not just
-- ones that "turn out" complex) rather than waiting to rediscover the same failure mode.
--
-- ST_Simplify (not PreserveTopology, confirmed elsewhere this session to barely reduce vertex
-- count when small islands/complex coastlines are involved) at 0.02 degrees (~2km) -- fine
-- for an admin-only container/selection aid, never shown to citizens and never itself
-- determining real user membership -- then ST_MakeValid + ST_CollectionExtract(...,3) to
-- repair the self-intersections ST_Simplify introduces, same repair pattern used throughout
-- the upload pipeline (scripts/upload_boundary.py) and the Province migration.
UPDATE public.map_shapes
SET geom = ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_Simplify(geom, 0.02)), 3))::geometry(MultiPolygon, 4326)
WHERE boundary_type = 'State' AND country = 'USA';
