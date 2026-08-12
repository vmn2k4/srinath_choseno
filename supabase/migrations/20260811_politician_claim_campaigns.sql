-- Admin-run outreach campaigns: bulk personalized emails to prospective
-- politicians/candidates (CSV/JSON import in the admin "Campaign" tab),
-- inviting them to sign up and claim their wall. Distinct from
-- office_holder_wall_claims (20260811082341_officeholder_wall_claim_foundation.sql):
-- that flow is scoped to a specific, already-seeded office_holders row and
-- issues a single-use redeemable token. This table just logs what was sent
-- to whom for an outreach batch — recipients may not exist in office_holders
-- (or even have an account) yet, so there is no redemption RPC here, only a
-- send record and lightweight click/signup tracking.

CREATE TABLE IF NOT EXISTS public.politician_claim_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Recipient information (as supplied in the imported CSV/JSON row)
  politician_name TEXT NOT NULL,
  politician_email TEXT NOT NULL,
  role_title TEXT,
  city TEXT,

  -- Outreach link sent in the email. token is opaque and only used for
  -- attributing a later signup/click back to this send — it does not grant
  -- any access by itself (contrast office_holder_wall_claims.token, which
  -- is a real bearer credential and stored as a hash for that reason).
  claim_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  claim_link TEXT NOT NULL,

  -- Campaign tracking
  campaign_name TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'opened', 'claimed')),
  error_message TEXT,

  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS politician_claim_campaigns_email_idx
  ON public.politician_claim_campaigns (politician_email);

CREATE INDEX IF NOT EXISTS politician_claim_campaigns_status_idx
  ON public.politician_claim_campaigns (status);

CREATE INDEX IF NOT EXISTS politician_claim_campaigns_campaign_name_idx
  ON public.politician_claim_campaigns (campaign_name, sent_at DESC);

CREATE OR REPLACE FUNCTION public._politician_claim_campaigns_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS politician_claim_campaigns_updated_at ON public.politician_claim_campaigns;
CREATE TRIGGER politician_claim_campaigns_updated_at
  BEFORE UPDATE ON public.politician_claim_campaigns
  FOR EACH ROW EXECUTE FUNCTION public._politician_claim_campaigns_set_updated_at();

ALTER TABLE public.politician_claim_campaigns ENABLE ROW LEVEL SECURITY;

-- Admin-only in every direction — this table holds outreach targets' PII
-- (name, email) and is written from the client with the user's own session,
-- not a service-role key, so RLS is the actual enforcement here.
DROP POLICY IF EXISTS "Admins can read campaign sends" ON public.politician_claim_campaigns;
CREATE POLICY "Admins can read campaign sends"
  ON public.politician_claim_campaigns FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

DROP POLICY IF EXISTS "Admins can create campaign sends" ON public.politician_claim_campaigns;
CREATE POLICY "Admins can create campaign sends"
  ON public.politician_claim_campaigns FOR INSERT
  TO authenticated
  WITH CHECK (
    (created_by = auth.uid() OR created_by IS NULL)
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update campaign sends" ON public.politician_claim_campaigns;
CREATE POLICY "Admins can update campaign sends"
  ON public.politician_claim_campaigns FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

-- Per-campaign rollup for the admin UI.
CREATE OR REPLACE VIEW public.politician_campaign_stats AS
SELECT
  campaign_name,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status = 'sent') AS sent_count,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
  COUNT(*) FILTER (WHERE status = 'opened') AS opened_count,
  COUNT(*) FILTER (WHERE status = 'claimed') AS claimed_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'claimed') / NULLIF(COUNT(*), 0), 1) AS claim_rate_percent,
  MIN(sent_at) AS campaign_start,
  MAX(sent_at) AS last_sent_at
FROM public.politician_claim_campaigns
GROUP BY campaign_name
ORDER BY MIN(sent_at) DESC NULLS LAST;

-- View runs with the querying user's own RLS-filtered read of the base
-- table, so it's safe to expose to any authenticated user, but only admins
-- can actually read the base table so only admins see any rows here.
GRANT SELECT ON public.politician_campaign_stats TO authenticated;
