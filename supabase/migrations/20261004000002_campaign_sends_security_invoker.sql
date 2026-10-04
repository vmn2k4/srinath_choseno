-- campaign_sends is a view over politician_claim_campaigns (admin-only RLS), but it ran as its
-- owner (postgres), bypassing that RLS: anon could read (and write) every row incl. politician
-- emails and claim tokens. Run it as the caller instead, and drop anon's access entirely.
ALTER VIEW public.campaign_sends SET (security_invoker = true);
REVOKE ALL ON public.campaign_sends FROM anon;
