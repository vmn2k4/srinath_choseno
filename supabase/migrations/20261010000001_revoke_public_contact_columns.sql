-- Contact email / phone are admin-only data. Step 2 of 2: stop anon/authenticated
-- from SELECTing contact_email / contact_phone on the two public tables that
-- carry them. Everything else on the tables stays readable exactly as before.
-- Admins (and politicians, for their own profile) read them through
-- get_politician_contacts / admin_get_office_holder_contacts (20261010000000).
--
-- APPLY ONLY AFTER the client that no longer selects these columns is deployed:
-- any select that names them (or uses `*`) from anon/authenticated will 42501.
--
-- NOTE: because table-level SELECT is replaced by a column list, a column added
-- to either table later must be GRANTed to anon/authenticated explicitly.
-- INSERT/UPDATE stay table-level, so politicians can still edit their own
-- contact fields (write-only from the browser's point of view).

DO $$
DECLARE
  t text;
  cols text;
BEGIN
  FOREACH t IN ARRAY ARRAY['politician_profiles', 'office_holders'] LOOP
    SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
      INTO cols
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = t
       AND column_name NOT IN ('contact_email', 'contact_phone');

    EXECUTE format('REVOKE SELECT ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT (%s) ON public.%I TO anon, authenticated', cols, t);
  END LOOP;
END $$;
