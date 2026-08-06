-- Contact info and an optional link to the officeholder's own profile, if
-- they're a registered platform user. v1 remains admin-only/manual (see
-- office_holders.sql) -- this is not a self-serve claim flow like
-- candidacy_claims, just an admin-set reference so the UI can render
-- "View their profile" when applicable.
ALTER TABLE public.office_holders
  ADD COLUMN contact_email text,
  ADD COLUMN contact_phone text,
  ADD COLUMN linked_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX idx_office_holders_linked_profile ON public.office_holders(linked_profile_id);

-- profiles RLS only allows auth.uid() = id (no public/admin SELECT-all
-- policy), so the admin "search a profile to link" picker -- and resolving
-- an already-linked_profile_id back to a display name on a later visit --
-- both need a SECURITY DEFINER RPC rather than a plain client-side select.
-- p_id, when given, looks up that single profile directly and ignores
-- p_query; otherwise p_query does a name search.
CREATE FUNCTION public.admin_search_profiles(p_query text DEFAULT NULL, p_id uuid DEFAULT NULL)
 RETURNS TABLE(id uuid, full_name text, avatar_url text, role text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF p_id IS NOT NULL THEN
    RETURN QUERY
      SELECT p.id, p.full_name, pp.avatar_url, p.role
      FROM public.profiles p
      LEFT JOIN public.politician_profiles pp ON pp.id = p.id
      WHERE p.id = p_id;
    RETURN;
  END IF;
  RETURN QUERY
    SELECT p.id, p.full_name, pp.avatar_url, p.role
    FROM public.profiles p
    LEFT JOIN public.politician_profiles pp ON pp.id = p.id
    WHERE p_query IS NOT NULL AND p.full_name ILIKE '%' || p_query || '%'
    ORDER BY p.full_name
    LIMIT 15;
END;
$function$;
