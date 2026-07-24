-- Canonical countries lookup table. Keyed by the same free-text name already
-- used in map_shapes/country_boundary_types/boundary_uploads/profiles.country
-- (no data migration on those columns) — this table replaces free-text entry
-- with a real admin-managed dropdown going forward.
CREATE TABLE public.countries (
  name TEXT PRIMARY KEY,
  code TEXT UNIQUE,          -- ISO 3166-1 alpha-2, e.g. 'CA' — for flag lookup/sorting
  flag_emoji TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read countries" ON public.countries FOR SELECT USING (true);
CREATE POLICY "Admins can write countries" ON public.countries FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

INSERT INTO public.countries (name, code, flag_emoji) VALUES ('Canada', 'CA', '🇨🇦');

-- country_boundary_types is now fully admin-managed via a dropdown sourced
-- from this table, so an FK is safe to add immediately (unlike map_shapes /
-- boundary_uploads / profiles, which are populated by user-facing flows and
-- RPCs and aren't constrained in this pass).
ALTER TABLE public.country_boundary_types
  ADD CONSTRAINT country_boundary_types_country_fkey FOREIGN KEY (country) REFERENCES public.countries(name);

-- find_shapes_within previously had no country awareness at all — a
-- container in one country and a target type name that happens to exist in
-- another (e.g. both have "Municipal") could match across countries.
-- Adding an optional trailing p_country param keeps existing 2-arg callers
-- working unchanged.
CREATE OR REPLACE FUNCTION public.find_shapes_within(p_container_shape_id bigint, p_target_boundary_type text, p_country text DEFAULT NULL)
 RETURNS SETOF map_shapes
 LANGUAGE sql
 STABLE
AS $function$
  SELECT ms.*
  FROM public.map_shapes ms, public.map_shapes container
  WHERE container.id = p_container_shape_id
    AND ms.boundary_type = p_target_boundary_type
    AND (p_country IS NULL OR ms.country = p_country)
    AND ms.id <> container.id
    AND ms.retired_at IS NULL
    AND ST_Intersects(ms.geom, container.geom);
$function$;

-- find_boundaries_by_point had no ordering guarantee, so the frontend
-- couldn't reliably take "the broadest matched boundary's country" as the
-- user's country. Join in each match's rank and order by it. This changes
-- the return type (adds a column), so it must be dropped and recreated
-- rather than CREATE OR REPLACE'd in place.
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
      AND ST_Contains(ms.geom, ST_SetSRID(ST_Point(lng, lat), 4326))
    ORDER BY cbt.rank ASC;
END;
$function$;
