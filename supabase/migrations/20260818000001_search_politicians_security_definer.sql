-- 20260818000000's new "exclude merged-away profiles" guard reads
-- office_holder_wall_claims, which is admin-only under RLS ("Admins can
-- read officeholder wall claims"). search_politicians_and_officeholders is
-- a plain SECURITY INVOKER function, so as the anon/authenticated caller
-- that NOT EXISTS subquery saw zero rows every time (RLS-filtered to
-- nothing) and never actually excluded anything -- confirmed live: a
-- merged-away duplicate profile still appeared as a phantom third search
-- result for David Eby after the fix was deployed.
--
-- Safe to run as SECURITY DEFINER: every column this function actually
-- returns already comes from publicly-readable tables/rows (office_holders,
-- map_shapes, election_role_types, political_parties, politician_profiles,
-- and profiles filtered to role='politician', which already has its own
-- public SELECT policy) -- office_holder_wall_claims itself is read only to
-- decide an exclusion, never returned to the caller.
ALTER FUNCTION public.search_politicians_and_officeholders(text, double precision, double precision, int)
  SECURITY DEFINER
  SET search_path = public;
