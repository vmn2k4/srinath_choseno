-- Generalizes delete_boundary_upload's safety check to an arbitrary set of
-- shape ids, for shapes that predate upload-batch tracking (upload_id IS
-- NULL) and so can't be removed via that batch-scoped RPC.
CREATE OR REPLACE FUNCTION public.delete_shapes(p_shape_ids BIGINT[])
RETURNS void AS $$
DECLARE
  v_blocked_count INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT count(*) INTO v_blocked_count
  FROM public.map_shapes ms
  WHERE ms.id = ANY(p_shape_ids)
    AND (
      EXISTS (SELECT 1 FROM public.election_seats es WHERE es.map_shape_id = ms.id)
      OR EXISTS (SELECT 1 FROM public.post_boundaries pb WHERE pb.map_shape_id = ms.id)
    );

  IF v_blocked_count > 0 THEN
    RAISE EXCEPTION 'RETIRE_REQUIRED: % of these boundaries are already referenced by elections or posts and cannot be permanently deleted. Retire them instead.', v_blocked_count;
  END IF;

  DELETE FROM public.map_shapes WHERE id = ANY(p_shape_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
