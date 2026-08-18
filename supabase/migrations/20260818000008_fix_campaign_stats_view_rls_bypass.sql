-- Security Advisor: "Security Definer View" (the 14th critical error).
--
-- politician_campaign_stats is a plain view owned by `postgres`. Without
-- security_invoker, Postgres evaluates the underlying politician_claim_campaigns
-- table's RLS policies as the view OWNER, not the querying user — and `postgres`
-- has BYPASSRLS. Combined with anon/authenticated both holding SELECT on the view
-- (the default grant new views inherit), this means any anonymous visitor can read
-- campaign send/open/claim analytics via PostgREST, completely bypassing the
-- "Admins can read campaign sends" policy on politician_claim_campaigns.
--
-- Website intent (per politician_claim_campaigns' own policies) is admin-only access.
-- security_invoker makes the view re-check RLS as the querying user, so a non-admin
-- caller now simply gets zero rows instead of bypassing the check; we also drop the
-- anon grant and the write-oriented grants entirely since this is a read-only
-- aggregate report with no legitimate public or DML use.
alter view public.politician_campaign_stats set (security_invoker = true);

revoke all on public.politician_campaign_stats from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.politician_campaign_stats from authenticated;
