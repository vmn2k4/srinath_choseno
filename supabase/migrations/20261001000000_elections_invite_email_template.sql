-- Per-election candidate claim-invite email.
--
-- The seat admin's "Search & Send Interview Invite" / "Invite Candidates to
-- Claim" flows all end in the auth-send-email hook, which builds the invite
-- email. This column tells that hook which election-specific template to
-- use. NULL (the default) means "send the standard claim-invite email", so
-- every election without a template keeps working exactly as before.
--
-- Template keys are defined in
-- supabase/functions/auth-send-email/electionInviteTemplates.ts.

alter table public.elections
  add column if not exists invite_email_template text;

comment on column public.elections.invite_email_template is
  'Key of the election-specific claim-invite email (see auth-send-email/electionInviteTemplates.ts). NULL = standard claim-invite email.';

-- 2026 BC Provincial Election (MLA candidates)
update public.elections
   set invite_email_template = 'bc_mla'
 where id = '0832d7b5-e607-4342-8eb3-8ca25db70d9a';
