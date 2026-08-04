-- E2E test fixture users for the Playwright suite in e2e/.
-- Run manually against the dev Supabase project (never production):
--   PGPASSWORD='<db password>' psql "postgresql://postgres@db.<project-ref>.supabase.co:5432/postgres" -f sql/seed_e2e_users.sql
-- Idempotent — safe to re-run. Mirrors the auth.users insert pattern from seed_admin.sql,
-- but also fills the token columns with '' (not NULL) to avoid a known GoTrue quirk where
-- manually-inserted users with NULL token columns can fail admin/password-grant operations.
--
-- All fixture accounts share the password: ChosenoE2E123!
-- Emails use the +e2e tag so they're easy to find/purge later:
--   e2e.admin@choseno.test        -- role: admin (site admin)
--   e2e.politician1@choseno.test  -- role: politician, onboarded (self-nominates a seat)
--   e2e.politician2@choseno.test  -- role: politician, onboarded (claims an admin-added seat)
--   e2e.citizen1@choseno.test     -- role: normal, onboarded (posts/comments/supports)
--   e2e.citizen2@choseno.test     -- role: normal, onboarded (self-nominates as election admin)

DO $$
DECLARE
  v_id uuid;
  v_email text;
  v_password text := 'ChosenoE2E123!';
  fixtures text[] := ARRAY[
    'e2e.admin@choseno.test',
    'e2e.politician1@choseno.test',
    'e2e.politician2@choseno.test',
    'e2e.citizen1@choseno.test',
    'e2e.citizen2@choseno.test'
  ];
BEGIN
  FOREACH v_email IN ARRAY fixtures LOOP
    SELECT id INTO v_id FROM auth.users WHERE email = v_email;

    IF v_id IS NULL THEN
      v_id := gen_random_uuid();
      INSERT INTO auth.users (
        id, instance_id, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        role, aud, confirmation_token, recovery_token,
        email_change_token_new, email_change
      ) VALUES (
        v_id, '00000000-0000-0000-0000-000000000000', v_email,
        crypt(v_password, gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', '{}', now(), now(),
        'authenticated', 'authenticated', '', '', '', ''
      );
    ELSE
      UPDATE auth.users
      SET encrypted_password = crypt(v_password, gen_salt('bf')), email_confirmed_at = now()
      WHERE id = v_id;
    END IF;
  END LOOP;
END $$;

-- profiles rows: the on_auth_user_created trigger already inserted a bare 'normal' row for
-- each new user above — upsert over it with the actual test role + onboarding_completed=true
-- so Playwright can skip the onboarding wizard and log straight into /feed.
INSERT INTO public.profiles (id, role, full_name, country, onboarding_completed)
SELECT id, 'admin', 'E2E Admin', 'Canada', true FROM auth.users WHERE email = 'e2e.admin@choseno.test'
ON CONFLICT (id) DO UPDATE SET role = 'admin', onboarding_completed = true;

INSERT INTO public.profiles (id, role, full_name, country, onboarding_completed)
SELECT id, 'politician', 'E2E Politician One', 'Canada', true FROM auth.users WHERE email = 'e2e.politician1@choseno.test'
ON CONFLICT (id) DO UPDATE SET role = 'politician', onboarding_completed = true;

INSERT INTO public.profiles (id, role, full_name, country, onboarding_completed)
SELECT id, 'politician', 'E2E Politician Two', 'Canada', true FROM auth.users WHERE email = 'e2e.politician2@choseno.test'
ON CONFLICT (id) DO UPDATE SET role = 'politician', onboarding_completed = true;

INSERT INTO public.profiles (id, role, full_name, country, onboarding_completed)
SELECT id, 'normal', 'E2E Citizen One', 'Canada', true FROM auth.users WHERE email = 'e2e.citizen1@choseno.test'
ON CONFLICT (id) DO UPDATE SET role = 'normal', onboarding_completed = true;

INSERT INTO public.profiles (id, role, full_name, country, onboarding_completed)
SELECT id, 'normal', 'E2E Citizen Two', 'Canada', true FROM auth.users WHERE email = 'e2e.citizen2@choseno.test'
ON CONFLICT (id) DO UPDATE SET role = 'normal', onboarding_completed = true;

-- politician_profiles rows are required for a politician-role profile to render fully
-- (avatar_url/bio fields the UI reads) — insert bare rows if missing.
INSERT INTO public.politician_profiles (id)
SELECT id FROM auth.users WHERE email IN ('e2e.politician1@choseno.test', 'e2e.politician2@choseno.test')
ON CONFLICT (id) DO NOTHING;

SELECT email, id FROM auth.users WHERE email LIKE 'e2e.%@choseno.test' ORDER BY email;
