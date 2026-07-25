-- shape_containers (precomputed "which province/state is this shape inside")
-- was admin-only, which was fine while only the admin panel used it. The
-- politician-facing "browse open seats in a different province" filter needs
-- to read it too, and this data isn't sensitive -- it's the same tier as
-- map_shapes itself (already public), just a membership index over it.
CREATE POLICY "Public can read shape_containers"
  ON public.shape_containers FOR SELECT USING (true);
