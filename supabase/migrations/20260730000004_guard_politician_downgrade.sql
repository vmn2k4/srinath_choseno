-- A politician profile can accumulate real state elsewhere (election
-- candidacies, a public wall, supporters, politician_profiles fields) that
-- has no meaning for a citizen account. Letting a politician downgrade back
-- to role='normal' -- via ProfilePage's "Switch to Citizen Account" button,
-- EditProfileFlow's role picker (shown even when editing an existing
-- politician), or a stray re-visit to /onboarding -- would leave that state
-- orphaned ("zombie") without actually being cleaned up. Client-side checks
-- can be bypassed, so enforce this the same way guard_candidate_status_change
-- already enforces a similar one-way transition on election_candidates:
-- normal -> politician stays allowed; politician -> normal is blocked at
-- the database, admins excepted.
CREATE OR REPLACE FUNCTION public.guard_politician_role_downgrade()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF OLD.role = 'politician' AND NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT (
      COALESCE(current_setting('app.bypass_politician_downgrade_guard', true), 'false') = 'true'
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    ) THEN
      RAISE EXCEPTION 'Cannot change a politician profile back to a citizen account';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER guard_politician_role_downgrade
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_politician_role_downgrade();
