-- Some boundary types (e.g. whole province/territory outlines) exist purely
-- as admin container-selection helpers and should never become a citizen
-- membership or feed tab. sync_user_boundary_memberships previously matched
-- ANY active map_shapes row with no way to exclude a type.
ALTER TABLE public.country_boundary_types ADD COLUMN admin_only BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.sync_user_boundary_memberships(p_lat double precision, p_lng double precision)
 RETURNS SETOF user_boundary_memberships
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.user_locations SET latitude = p_lat, longitude = p_lng WHERE profile_id = auth.uid();
  IF NOT FOUND THEN
    INSERT INTO public.user_locations (profile_id, latitude, longitude) VALUES (auth.uid(), p_lat, p_lng);
  END IF;

  DELETE FROM public.user_boundary_memberships WHERE profile_id = auth.uid();

  INSERT INTO public.user_boundary_memberships (profile_id, map_shape_id)
  SELECT auth.uid(), ms.id
  FROM public.map_shapes ms
  JOIN public.country_boundary_types cbt
    ON cbt.country = ms.country AND cbt.type_name = ms.boundary_type
  WHERE ms.retired_at IS NULL
    AND NOT cbt.admin_only
    AND ST_Contains(ms.geom, ST_SetSRID(ST_Point(p_lng, p_lat), 4326));

  RETURN QUERY SELECT * FROM public.user_boundary_memberships WHERE profile_id = auth.uid();
END;
$function$;

-- find_boundaries_by_point drives onboarding's "you belong to N groups"
-- preview and the public Boundary Finder — same admin_only exclusion, so it
-- never implies a membership that sync would then not actually create.
DROP FUNCTION IF EXISTS public.find_boundaries_by_point(double precision, double precision);

CREATE FUNCTION public.find_boundaries_by_point(lat double precision, lng double precision)
 RETURNS TABLE(id bigint, name text, country text, boundary_type text, code text, rank integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT ms.id, ms.name, ms.country, ms.boundary_type, ms.code, cbt.rank
    FROM public.map_shapes ms
    JOIN public.country_boundary_types cbt
      ON cbt.country = ms.country AND cbt.type_name = ms.boundary_type
    WHERE ms.retired_at IS NULL
      AND NOT cbt.admin_only
      AND ST_Contains(ms.geom, ST_SetSRID(ST_Point(lng, lat), 4326))
    ORDER BY cbt.rank ASC;
END;
$function$;

-- add_user_boundary_membership is the manual "search and add a jurisdiction"
-- path (StepLocation.jsx) — guard it server-side too, since a client could
-- call it directly with any shape id regardless of what the search UI offers.
CREATE OR REPLACE FUNCTION public.add_user_boundary_membership(p_map_shape_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_admin_only boolean;
BEGIN
  SELECT cbt.admin_only INTO v_admin_only
  FROM public.map_shapes ms
  JOIN public.country_boundary_types cbt
    ON cbt.country = ms.country AND cbt.type_name = ms.boundary_type
  WHERE ms.id = p_map_shape_id;

  IF v_admin_only THEN
    RAISE EXCEPTION 'This boundary is admin-only and cannot be added as a membership';
  END IF;

  INSERT INTO public.user_boundary_memberships (profile_id, map_shape_id)
  VALUES (auth.uid(), p_map_shape_id)
  ON CONFLICT (profile_id, map_shape_id) DO NOTHING;
END;
$function$;
