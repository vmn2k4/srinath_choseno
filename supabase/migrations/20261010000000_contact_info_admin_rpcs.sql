-- Contact email / phone are admin-only data. Step 1 of 2: the SECURITY DEFINER
-- readers that admin (and, for their own profile, the politician) will use once
-- 20261010000001 revokes direct column SELECT from anon/authenticated.
-- Purely additive -- safe to apply before the matching client deploy.

-- Raw politician_profiles contact fields. Site admins get any profile; a
-- politician only ever gets their own row back (EditProfile prefill).
-- p_merged = true adds the same fallback the wall page always used (current
-- office_holders row linked by id, then by name, then a same-named profile),
-- so an admin viewing a wall sees what the imports actually know.
CREATE OR REPLACE FUNCTION public.get_politician_contacts(
  p_profile_ids uuid[],
  p_merged boolean DEFAULT false
)
RETURNS TABLE (profile_id uuid, contact_email text, contact_phone text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT EXISTS (
      SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'
    ) AS is_admin
  )
  SELECT
    pr.id,
    COALESCE(
      NULLIF(btrim(pp.contact_email), ''),
      CASE WHEN p_merged THEN COALESCE(
        (SELECT NULLIF(btrim(oh.contact_email), '') FROM public.office_holders oh
          WHERE (oh.linked_profile_id = pr.id OR lower(btrim(oh.full_name)) = lower(btrim(pr.full_name)))
            AND NULLIF(btrim(oh.contact_email), '') IS NOT NULL
          ORDER BY oh.is_current DESC, (oh.linked_profile_id = pr.id) DESC LIMIT 1),
        (SELECT NULLIF(btrim(p2.contact_email), '') FROM public.profiles pr2
          JOIN public.politician_profiles p2 ON p2.id = pr2.id
          WHERE lower(btrim(pr2.full_name)) = lower(btrim(pr.full_name))
            AND NULLIF(btrim(p2.contact_email), '') IS NOT NULL LIMIT 1)
      ) END
    ),
    COALESCE(
      NULLIF(btrim(pp.contact_phone), ''),
      CASE WHEN p_merged THEN COALESCE(
        (SELECT NULLIF(btrim(oh.contact_phone), '') FROM public.office_holders oh
          WHERE (oh.linked_profile_id = pr.id OR lower(btrim(oh.full_name)) = lower(btrim(pr.full_name)))
            AND NULLIF(btrim(oh.contact_phone), '') IS NOT NULL
          ORDER BY oh.is_current DESC, (oh.linked_profile_id = pr.id) DESC LIMIT 1),
        (SELECT NULLIF(btrim(p2.contact_phone), '') FROM public.profiles pr2
          JOIN public.politician_profiles p2 ON p2.id = pr2.id
          WHERE lower(btrim(pr2.full_name)) = lower(btrim(pr.full_name))
            AND NULLIF(btrim(p2.contact_phone), '') IS NOT NULL LIMIT 1)
      ) END
    )
  FROM public.profiles pr
  LEFT JOIN public.politician_profiles pp ON pp.id = pr.id
  CROSS JOIN me
  WHERE pr.id = ANY (p_profile_ids)
    AND (me.is_admin OR pr.id = (SELECT auth.uid()));
$$;

-- Raw office_holders contact fields -- admin only. Any filter may be NULL;
-- results are the union of whichever filters are given.
CREATE OR REPLACE FUNCTION public.admin_get_office_holder_contacts(
  p_ids uuid[] DEFAULT NULL,
  p_linked_profile_ids uuid[] DEFAULT NULL,
  p_names text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  linked_profile_id uuid,
  full_name text,
  contact_email text,
  contact_phone text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT oh.id, oh.linked_profile_id, oh.full_name, oh.contact_email, oh.contact_phone
  FROM public.office_holders oh
  WHERE EXISTS (
          SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'
        )
    AND (
      oh.id = ANY (COALESCE(p_ids, '{}'))
      OR oh.linked_profile_id = ANY (COALESCE(p_linked_profile_ids, '{}'))
      OR oh.full_name = ANY (COALESCE(p_names, '{}'))
    );
$$;

REVOKE ALL ON FUNCTION public.get_politician_contacts(uuid[], boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_office_holder_contacts(uuid[], uuid[], text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_politician_contacts(uuid[], boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_office_holder_contacts(uuid[], uuid[], text[]) TO authenticated;
