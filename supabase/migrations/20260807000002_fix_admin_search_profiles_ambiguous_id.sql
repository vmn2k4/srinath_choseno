-- 20260807000001's admin_search_profiles had an unqualified `id` in the
-- admin-check WHERE clause, which plpgsql resolved against the function's
-- own RETURNS TABLE(id uuid, ...) output variable instead of
-- profiles.id -- broke for every caller (not just non-admins) with
-- "column reference id is ambiguous". Alias the admin-check subquery so
-- its `id`/`role` unambiguously mean the queried row, not the OUT params.
CREATE OR REPLACE FUNCTION public.admin_search_profiles(p_query text DEFAULT NULL, p_id uuid DEFAULT NULL)
 RETURNS TABLE(id uuid, full_name text, avatar_url text, role text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles caller WHERE caller.id = auth.uid() AND caller.role = 'admin') THEN
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
