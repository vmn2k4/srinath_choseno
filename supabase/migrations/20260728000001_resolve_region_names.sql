-- Resolves, for a batch of target shapes, the name of the admin_only container (Province for
-- Canada, State for USA) each one spatially falls inside -- used by ElectionsAdmin.jsx to
-- pick the correct regional role_title (e.g. Ontario -> MPP) PER SHAPE at seat-creation time,
-- rather than from whatever single container the admin happened to pick in the UI. That
-- distinction matters: a seat-creation batch can legitimately mix shapes found via
-- find_shapes_within with manually added shapes from a different region, and resolving
-- region from the UI's container selection alone would mislabel the manual additions.
--
-- No SECURITY DEFINER -- reads only public boundary data (map_shapes, country_boundary_types
-- are both publicly SELECTable), same posture as find_shapes_within.
--
-- DISTINCT ON (target.id) guards against a future country ever registering more than one
-- admin_only container type, which would otherwise produce more than one row per shape.
--
-- A shape with no matching row (e.g. ST_PointOnSurface landing just outside a deliberately
-- simplified container coastline -- Province/State containers are simplified to ~2km
-- tolerance for query performance, see 20260727000004) is not an error: the caller falls back
-- to the '' default region_override in election_role_types.
CREATE OR REPLACE FUNCTION public.resolve_region_names(p_shape_ids bigint[], p_country text)
RETURNS TABLE(map_shape_id bigint, region_name text)
LANGUAGE sql STABLE AS $$
  SELECT DISTINCT ON (target.id) target.id, container.name
  FROM public.map_shapes target
  JOIN public.country_boundary_types cbt ON cbt.country = p_country AND cbt.admin_only
  JOIN public.map_shapes container
    ON container.country = p_country AND container.boundary_type = cbt.type_name
    AND container.retired_at IS NULL
    AND ST_Contains(container.geom, ST_PointOnSurface(target.geom))
  WHERE target.id = ANY(p_shape_ids)
  ORDER BY target.id, container.id;
$$;
