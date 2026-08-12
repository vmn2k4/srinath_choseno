-- Adds target_wall_slug to list_pending_self_requested_officeholder_claims()
-- so the admin panel can link straight to the requester's own (prefilled)
-- wall without a second round-trip query. Postgres won't let CREATE OR
-- REPLACE change an OUT-parameter row shape, so the old signature from
-- 20260811170000 is dropped first — not editing that migration file in
-- place, this is a new migration replacing the function it defined.
DROP FUNCTION IF EXISTS public.list_pending_self_requested_officeholder_claims();

CREATE FUNCTION public.list_pending_self_requested_officeholder_claims()
RETURNS TABLE (
  claim_id UUID,
  office_holder_id UUID,
  office_holder_name TEXT,
  role_title TEXT,
  boundary_name TEXT,
  target_profile_id UUID,
  target_wall_slug TEXT,
  requester_name TEXT,
  contact_email TEXT,
  note TEXT,
  claimed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'admin authorization required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    c.id, c.office_holder_id, oh.full_name, ert.role_title, ms.name,
    c.target_profile_id, pp.wall_slug, p.full_name, c.contact_email, c.metadata->>'note', c.claimed_at
  FROM public.office_holder_wall_claims c
  JOIN public.office_holders oh ON oh.id = c.office_holder_id
  LEFT JOIN public.election_role_types ert ON ert.id = oh.election_role_type_id
  LEFT JOIN public.map_shapes ms ON ms.id = oh.map_shape_id
  LEFT JOIN public.profiles p ON p.id = c.target_profile_id
  LEFT JOIN public.politician_profiles pp ON pp.id = c.target_profile_id
  WHERE c.status = 'pending_review' AND (c.metadata->>'self_requested')::boolean IS TRUE
  ORDER BY c.claimed_at DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.list_pending_self_requested_officeholder_claims() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_pending_self_requested_officeholder_claims() TO authenticated;
