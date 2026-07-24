-- reconcile_shape_memberships() fires on every map_shapes insert/geom-update
-- and auto-creates/removes user_boundary_memberships for that shape — missed
-- in the earlier admin_only migration, so uploading the (admin-only) Province
-- shapes just auto-enrolled every user whose stored location fell inside one.
CREATE OR REPLACE FUNCTION public.reconcile_shape_memberships()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_admin_only boolean;
BEGIN
  SELECT admin_only INTO v_admin_only
  FROM public.country_boundary_types
  WHERE country = NEW.country AND type_name = NEW.boundary_type;

  IF v_admin_only THEN
    RETURN NEW;
  END IF;

  DELETE FROM public.user_boundary_memberships ubm
  USING public.user_locations ul
  WHERE ubm.map_shape_id = NEW.id
    AND ubm.profile_id = ul.profile_id
    AND (
      ul.latitude IS NULL OR ul.longitude IS NULL
      OR NOT ST_Contains(NEW.geom, ST_SetSRID(ST_Point(ul.longitude, ul.latitude), 4326))
    );

  INSERT INTO public.user_boundary_memberships (profile_id, map_shape_id)
  SELECT ul.profile_id, NEW.id
  FROM public.user_locations ul
  WHERE ul.latitude IS NOT NULL AND ul.longitude IS NOT NULL
    AND ST_Contains(NEW.geom, ST_SetSRID(ST_Point(ul.longitude, ul.latitude), 4326))
  ON CONFLICT (profile_id, map_shape_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Clean up memberships the old version of this trigger already created for
-- the just-uploaded (admin-only) Province shapes.
DELETE FROM public.user_boundary_memberships ubm
USING public.map_shapes ms, public.country_boundary_types cbt
WHERE ubm.map_shape_id = ms.id
  AND cbt.country = ms.country AND cbt.type_name = ms.boundary_type
  AND cbt.admin_only;
