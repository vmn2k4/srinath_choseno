-- Founder badge: every signup gets a permanent, immutable signup_order
-- number ("you were user #N"), plus a created_at we didn't previously have
-- on profiles (only updated_at existed). Powers:
--   1. A private badge on the user's own profile (RLS already restricts
--      profiles SELECT to the owning row, so no new policy needed for that).
--   2. A public, PII-free live founder count used in signup nudges
--      ("342 founders so far — be one of the first 1,000"), via the
--      SECURITY DEFINER RPC below, since anon/authenticated cannot SELECT
--      across all profiles rows under the existing RLS.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS signup_order INTEGER;

-- Sequence backing signup_order. Assigning from a sequence (rather than
-- `count(*) + 1` at insert time) avoids a race between concurrent signups
-- ever handing out the same number.
CREATE SEQUENCE IF NOT EXISTS public.profiles_signup_order_seq;

-- Backfill existing rows in true signup order (auth.users.created_at),
-- since profiles.created_at didn't exist until this migration.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.id, u.created_at AS real_created_at
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.signup_order IS NULL
    ORDER BY u.created_at ASC
  LOOP
    UPDATE public.profiles
    SET signup_order = nextval('public.profiles_signup_order_seq'),
        created_at = r.real_created_at
    WHERE id = r.id;
  END LOOP;
END $$;

-- Deliberately left NULLable, not NOT NULL: this table also holds ~31.7K
-- politician rows that were bulk-imported (candidate/officeholder sync, no
-- matching auth.users row -- confirmed against the live DB while writing
-- this migration) and a handful of is_test=true QA accounts. Neither is a
-- real signup, so neither gets a signup_order.

CREATE UNIQUE INDEX IF NOT EXISTS profiles_signup_order_key ON public.profiles (signup_order);

-- Assign the next number on every new signup from here on.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, current_ghost_id, signup_order)
  VALUES (NEW.id, gen_random_uuid(), nextval('public.profiles_signup_order_seq'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Public founder count for signup nudges. Returns only a count -- no rows,
-- no PII -- so it's safe to expose to anon despite bypassing profiles RLS.
-- Excludes the bulk-imported politician rows (signup_order IS NULL -- they
-- never went through auth signup) and is_test QA accounts, so the number
-- shown to visitors is real people who actually signed up.
CREATE OR REPLACE FUNCTION public.get_founder_count()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT count(*)::INTEGER
  FROM public.profiles
  WHERE signup_order IS NOT NULL AND is_test = false;
$$;

GRANT EXECUTE ON FUNCTION public.get_founder_count() TO anon, authenticated;
