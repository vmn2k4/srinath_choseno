-- Precomputed container membership cache.
--
-- find_shapes_within (20260728000008) does a correct but nontrivial live
-- geometry join (ST_Intersects + area-ratio) every time it's called. Admin
-- screens (Elections seat-building, Redistricting, the Visualizer) all ask
-- the same question repeatedly against the same small set of containers
-- (Province/State), which almost never change. Cache the answer instead:
-- shape_containers stores, for every ordinary shape, which admin_only
-- container shape(s) it substantially overlaps (same >2% of-its-own-area
-- rule as find_shapes_within, so results are identical -- just precomputed).
--
-- Not unique-per-shape on purpose: a shape could eventually sit inside more
-- than one container if a country ever gets a second, more granular
-- container type (e.g. County inside State) -- both would be valid rows.
CREATE TABLE public.shape_containers (
  map_shape_id bigint NOT NULL REFERENCES public.map_shapes(id) ON DELETE CASCADE,
  container_shape_id bigint NOT NULL REFERENCES public.map_shapes(id) ON DELETE CASCADE,
  PRIMARY KEY (map_shape_id, container_shape_id)
);

CREATE INDEX idx_shape_containers_container ON public.shape_containers(container_shape_id);

ALTER TABLE public.shape_containers ENABLE ROW LEVEL SECURITY;

-- Admin-tooling cache, same posture as boundary_uploads/map_shapes admin
-- surfaces -- never read by citizen-facing code, no client writes (only the
-- trigger/backfill functions below write to it, both SECURITY DEFINER).
CREATE POLICY "Admins can read shape_containers"
  ON public.shape_containers FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Recompute every membership row for one container shape (call when a
-- container is inserted, or its geometry/retirement changes).
CREATE OR REPLACE FUNCTION public.recompute_shape_containers_for_container(p_container_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_country text;
BEGIN
  DELETE FROM shape_containers WHERE container_shape_id = p_container_id;

  SELECT country INTO v_country FROM map_shapes WHERE id = p_container_id AND retired_at IS NULL;
  IF v_country IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO shape_containers (map_shape_id, container_shape_id)
  SELECT c.id, p_container_id
  FROM map_shapes c, map_shapes container
  WHERE container.id = p_container_id
    AND c.id <> p_container_id
    AND c.country = v_country
    AND c.retired_at IS NULL
    AND c.geom && container.geom
    AND ST_Intersects(c.geom, container.geom)
    AND ST_Area(ST_Intersection(c.geom, container.geom)) / NULLIF(ST_Area(c.geom), 0) > 0.02;
END;
$$;

-- Recompute every container row for one ordinary shape (call when that
-- shape is inserted, or its geometry/retirement changes).
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
   AND cbt.admin_only
  WHERE shape.id = p_shape_id
    AND container.id <> p_shape_id
    AND container.country = v_country
    AND container.retired_at IS NULL
    AND shape.geom && container.geom
    AND ST_Intersects(shape.geom, container.geom)
    AND ST_Area(ST_Intersection(shape.geom, container.geom)) / NULLIF(ST_Area(shape.geom), 0) > 0.02;
END;
$$;

-- Trigger: keep the cache live the same way reconcile_shape_memberships
-- keeps user_boundary_memberships live -- any insert/geometry change/
-- retirement on map_shapes recomputes just the affected shape's rows,
-- whichever side of the container relationship it's on.
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

  SELECT admin_only INTO v_is_container
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

CREATE TRIGGER trg_reconcile_shape_containers
  AFTER INSERT OR UPDATE OF geom, retired_at, boundary_type, country ON public.map_shapes
  FOR EACH ROW EXECUTE FUNCTION public.reconcile_shape_containers();

-- One-time backfill for every container that already exists (Province,
-- USA's State).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT ms.id
    FROM map_shapes ms
    JOIN country_boundary_types cbt
      ON cbt.country = ms.country AND cbt.type_name = ms.boundary_type AND cbt.admin_only
    WHERE ms.retired_at IS NULL
  LOOP
    PERFORM recompute_shape_containers_for_container(r.id);
  END LOOP;
END $$;
