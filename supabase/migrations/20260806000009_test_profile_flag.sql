-- Companion to 20260806000006_test_content_flag.sql: hides internal/dev
-- accounts from production the same way test content is hidden. profiles.id
-- has no email column (deliberately -- see anonymity model), so accounts are
-- identified here via auth.users.email for this one-time backfill.
-- vmn2k4@gmail.com (admin) and munaruna86@gmail.com (Murugappan Valliyappan,
-- the one real politician account seeded so far) are the only two accounts
-- kept visible -- every other profile, including the 16 rows with no
-- matching auth.users row at all (orphaned/manually-seeded test data), is
-- flagged. See chat discussion 2026-08-06.
ALTER TABLE public.profiles ADD COLUMN is_test BOOLEAN NOT NULL DEFAULT false;

UPDATE public.profiles p
SET is_test = true
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users u
  WHERE u.id = p.id
    AND lower(u.email) IN ('vmn2k4@gmail.com', 'munaruna86@gmail.com')
);
