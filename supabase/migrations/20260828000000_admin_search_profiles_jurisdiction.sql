-- admin_search_profiles previously returned only id/full_name/avatar_url/
-- role -- enough to render a name-search picker, but not enough for the
-- news JSON import flow (resolvePoliticianNamesToTags in
-- AdminNewsPageClient.tsx) to tell two same-named politicians apart. With
-- 1000+ office holders imported, "John Smith" or "David Lee" can easily
-- collide across different cities/provinces, and the AI-generated JSON only
-- gives a plain name string, not a profile id.
--
-- Adds profiles.country and profiles.constituency to the return shape so
-- the client can score ambiguous name matches against the article's own
-- country/province (see scoreCandidateByJurisdiction in
-- AdminNewsPageClient.tsx) instead of guessing or leaving every same-named
-- politician unmatched. Also returns designation for a friendlier
-- disambiguation prompt if the admin ends up picking manually.
-- Return type (OUT params) changed -- CREATE OR REPLACE can't alter that,
-- Postgres requires the old signature dropped first.
DROP FUNCTION IF EXISTS public.admin_search_profiles(text, uuid);

CREATE OR REPLACE FUNCTION public.admin_search_profiles(p_query text DEFAULT NULL, p_id uuid DEFAULT NULL)
 RETURNS TABLE(id uuid, full_name text, avatar_url text, role text, country text, constituency text, designation text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles caller WHERE caller.id = auth.uid() AND caller.role = 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF p_id IS NOT NULL THEN
    RETURN QUERY
      SELECT p.id, p.full_name, pp.avatar_url, p.role, p.country, p.constituency, p.designation
      FROM public.profiles p
      LEFT JOIN public.politician_profiles pp ON pp.id = p.id
      WHERE p.id = p_id;
    RETURN;
  END IF;
  RETURN QUERY
    SELECT p.id, p.full_name, pp.avatar_url, p.role, p.country, p.constituency, p.designation
    FROM public.profiles p
    LEFT JOIN public.politician_profiles pp ON pp.id = p.id
    WHERE p_query IS NOT NULL AND p.full_name ILIKE '%' || p_query || '%'
    ORDER BY p.full_name
    LIMIT 15;
END;
$function$;
