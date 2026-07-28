-- 20260729000014 promoted USA's 'State' from admin_only=true to a normal
-- boundary type, so Governor/U.S. Senator seats could exist and citizens
-- could get a real membership in their own state. A side effect, called out
-- explicitly as an accepted trade-off in that migration's comment: 'State'
-- could no longer be used as a *container* to scope a Federal/Municipal
-- seat-creation batch (e.g. "every House district in California") the way
-- Canada's Province still can, because the admin UI's container/target
-- dropdown split (ElectionsAdmin.jsx, BoundaryVisualizer.jsx) and the
-- shape_containers cache (20260728000009) both used the single admin_only
-- column to mean two different things at once: "excluded from citizen
-- boundary membership" AND "usable as an admin container." Once 'State'
-- needed the first to be false but the second to stay true, one column
-- could no longer express both.
--
-- Fix: split them. admin_only keeps its original, narrower meaning
-- (citizen-membership/feed-tab exclusion -- sync_user_boundary_memberships,
-- find_boundaries_by_point, add_user_boundary_membership, unchanged, still
-- read admin_only directly). A new is_container column takes over "is this
-- a valid container to scope another type's search by" -- defaults to
-- matching admin_only for every existing type (so Canada's Province and any
-- other already-admin_only type behaves identically to before), with 'State'
-- the one deliberate exception: admin_only=false (real target, real
-- membership) AND is_container=true (still usable as a container) at once.
ALTER TABLE public.country_boundary_types ADD COLUMN is_container boolean NOT NULL DEFAULT false;
UPDATE public.country_boundary_types SET is_container = admin_only;
UPDATE public.country_boundary_types SET is_container = true WHERE country = 'USA' AND type_name = 'State';

-- shape_containers (20260728000009) and resolve_region_names (20260728000001)
-- both used cbt.admin_only to mean "is a container type" -- repointed at
-- is_container. Definitions otherwise unchanged from their prior versions.
CREATE OR REPLACE FUNCTION public.recompute_shape_containers_for_shape(p_shape_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_country text;
BEGIN
  DELETE FROM shape_containers WHERE map_shape_id = p_shape_id;

  SELECT country INTO v_country FROM map_shapes WHERE id = p_shape_id AND retired_at IS NULL;
  IF v_country IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO shape_containers (map_shape_id, container_shape_id)
  SELECT p_shape_id, container.id
  FROM map_shapes shape, map_shapes container
  JOIN country_boundary_types cbt
    ON cbt.country = container.country
   AND cbt.type_name = container.boundary_type
   AND cbt.is_container
  WHERE shape.id = p_shape_id
    AND container.id <> p_shape_id
    AND container.country = v_country
    AND container.retired_at IS NULL
    AND shape.geom && container.geom
    AND ST_Intersects(shape.geom, container.geom)
    AND ST_Area(ST_Intersection(shape.geom, container.geom)) / NULLIF(ST_Area(shape.geom), 0) > 0.02;
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_shape_containers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_container boolean;
BEGIN
  IF NEW.retired_at IS NOT NULL THEN
    DELETE FROM shape_containers WHERE map_shape_id = NEW.id OR container_shape_id = NEW.id;
    RETURN NEW;
  END IF;

  SELECT is_container INTO v_is_container
  FROM country_boundary_types
  WHERE country = NEW.country AND type_name = NEW.boundary_type;

  IF COALESCE(v_is_container, false) THEN
    PERFORM recompute_shape_containers_for_container(NEW.id);
  ELSE
    PERFORM recompute_shape_containers_for_shape(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_region_names(p_shape_ids bigint[], p_country text)
RETURNS TABLE(map_shape_id bigint, region_name text)
LANGUAGE sql STABLE AS $$
  SELECT DISTINCT ON (target.id) target.id, container.name
  FROM public.map_shapes target
  JOIN public.country_boundary_types cbt ON cbt.country = p_country AND cbt.is_container
  JOIN public.map_shapes container
    ON container.country = p_country AND container.boundary_type = cbt.type_name
    AND container.retired_at IS NULL
    AND ST_Contains(container.geom, ST_PointOnSurface(target.geom))
  WHERE target.id = ANY(p_shape_ids)
  ORDER BY target.id, container.id;
$$;

-- Force-recompute shape_containers for every USA/State shape now that it's
-- flagged is_container -- rather than trust whatever rows happened to
-- already exist from before 20260729000014 flipped admin_only (they may be
-- stale, or may never have existed if a shape was touched in between).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.map_shapes WHERE country = 'USA' AND boundary_type = 'State' AND retired_at IS NULL
  LOOP
    PERFORM recompute_shape_containers_for_container(r.id);
  END LOOP;
END $$;
