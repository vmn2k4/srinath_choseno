-- Click-tracking for candidate_claim_invites, matching the shape
-- politician_claim_campaigns already has (20260819000002) -- brings the
-- "Invite Candidates to Claim" invite email up to the same tracking level
-- as the /admin/campaign outreach tool's emails. Only ever written by the
-- new secondary "learn more about Choseno" link in the email body -- the
-- primary claim link stays untracked/unwrapped on purpose (see
-- auth-send-email's comments): it's a single-use, stateless auth link, and
-- an extra tracking-redirect hop in front of it isn't worth even the small
-- added latency/failure surface on the one link that actually matters.
ALTER TABLE public.candidate_claim_invites
  ADD COLUMN link_clicks integer NOT NULL DEFAULT 0,
  ADD COLUMN links_clicked jsonb NOT NULL DEFAULT '[]'::jsonb;
