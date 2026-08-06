-- Pre-launch cleanup: the app has a single Supabase project shared by dev
-- and prod (no separate staging DB), so instead of deleting everything
-- created during development, every content row gets an is_test flag.
-- Service-layer reads filter is_test=true out in production while dev mode
-- keeps showing everything -- lets the team keep testing against real
-- production data post-launch without polluting what real users see.
-- Deliberately NOT applied to profiles/politician_profiles (structural
-- identity data, not "content") or reference data (boundaries, elections,
-- parties) -- see chat discussion 2026-08-06.
ALTER TABLE public.posts ADD COLUMN is_test BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.comments ADD COLUMN is_test BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.politician_supporters ADD COLUMN is_test BOOLEAN NOT NULL DEFAULT false;

-- Everything that exists right now was created during development/testing.
UPDATE public.posts SET is_test = true;
UPDATE public.comments SET is_test = true;
UPDATE public.politician_supporters SET is_test = true;
