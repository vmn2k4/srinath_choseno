-- admin_search_profiles's ILIKE '%query%' is a single contiguous-substring
-- match, so searching "Donald Trump" against a profile stored as
-- "Donald J. Trump" returns zero rows -- "Donald Trump" is not a substring
-- of "Donald J. Trump" (the middle initial breaks it). Confirmed live:
-- profiles has exactly one Trump row and it's "Donald J. Trump", so the
-- news-import auto-tagging flow (resolvePoliticianNamesToTags in
-- AdminNewsPageClient.tsx) never even saw him as a candidate.
--
-- Replacing spaces in the query with '%' turns "Donald Trump" into the
-- wildcard pattern '%Donald%Trump%', which matches any full_name containing
-- "Donald" followed later by "Trump" -- middle initials/names in between are
-- fine, word order still has to match. Client-side matching in
-- AdminNewsPageClient.tsx does the stricter first/last-token comparison
-- against this now-broader candidate pool, so this only widens what's
-- *considered*, not what's accepted as a match.
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
    WHERE p_query IS NOT NULL
      AND p.full_name ILIKE '%' || replace(trim(p_query), ' ', '%') || '%'
    ORDER BY p.full_name
    LIMIT 15;
END;
$function$;
