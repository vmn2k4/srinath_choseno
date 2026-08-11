-- Officeholder wall claim foundation.
--
-- Non-destructive: this migration only creates empty audit/invitation tables,
-- indexes, RLS policies, and comments. It does not update or delete existing
-- officeholder, profile, wall, rating, supporter, or election data.
--
-- Merge/reversal RPCs are deliberately deferred until the live schema and the
-- affected ownership paths have been tested against disposable fixtures.

CREATE TABLE IF NOT EXISTS public.office_holder_wall_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_holder_id UUID NOT NULL REFERENCES public.office_holders(id) ON DELETE RESTRICT,
  source_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  source_ghost_id UUID NOT NULL,
  target_profile_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  target_ghost_id UUID,
  contact_email TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft',
      'invited',
      'pending_confirmation',
      'pending_review',
      'approved',
      'reversed',
      'rejected',
      'expired'
    )),
  invited_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  reversed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  reversed_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  reversal_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (target_profile_id IS NULL OR target_profile_id <> source_profile_id),
  CHECK (target_ghost_id IS NULL OR target_ghost_id <> source_ghost_id),
  CHECK (reversed_at IS NULL OR status = 'reversed'),
  CHECK (reversal_reason IS NULL OR reversed_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS office_holder_wall_claims_office_holder_idx
  ON public.office_holder_wall_claims (office_holder_id, created_at DESC);

CREATE INDEX IF NOT EXISTS office_holder_wall_claims_source_profile_idx
  ON public.office_holder_wall_claims (source_profile_id);

CREATE INDEX IF NOT EXISTS office_holder_wall_claims_target_profile_idx
  ON public.office_holder_wall_claims (target_profile_id);

CREATE UNIQUE INDEX IF NOT EXISTS office_holder_wall_claims_one_open_claim_idx
  ON public.office_holder_wall_claims (office_holder_id)
  WHERE status IN ('draft', 'invited', 'pending_confirmation', 'pending_review', 'approved');

ALTER TABLE public.office_holder_wall_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read officeholder wall claims" ON public.office_holder_wall_claims;
CREATE POLICY "Admins can read officeholder wall claims"
  ON public.office_holder_wall_claims FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

DROP POLICY IF EXISTS "Admins can create officeholder wall claims" ON public.office_holder_wall_claims;
CREATE POLICY "Admins can create officeholder wall claims"
  ON public.office_holder_wall_claims FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update officeholder wall claims" ON public.office_holder_wall_claims;
CREATE POLICY "Admins can update officeholder wall claims"
  ON public.office_holder_wall_claims FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE TABLE IF NOT EXISTS public.office_holder_wall_claim_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.office_holder_wall_claims(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'office_holder',
    'profile',
    'politician_profile',
    'post',
    'comment',
    'supporter',
    'rating',
    'election_candidate',
    'news_article_tag',
    'wall_route'
  )),
  entity_id TEXT NOT NULL,
  source_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  target_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  moved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reversed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS office_holder_wall_claim_items_claim_idx
  ON public.office_holder_wall_claim_items (claim_id, moved_at);

CREATE INDEX IF NOT EXISTS office_holder_wall_claim_items_entity_idx
  ON public.office_holder_wall_claim_items (entity_type, entity_id);

ALTER TABLE public.office_holder_wall_claim_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read officeholder wall claim items" ON public.office_holder_wall_claim_items;
CREATE POLICY "Admins can read officeholder wall claim items"
  ON public.office_holder_wall_claim_items FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

DROP POLICY IF EXISTS "Admins can create officeholder wall claim items" ON public.office_holder_wall_claim_items;
CREATE POLICY "Admins can create officeholder wall claim items"
  ON public.office_holder_wall_claim_items FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

DROP POLICY IF EXISTS "Admins can update officeholder wall claim items" ON public.office_holder_wall_claim_items;
CREATE POLICY "Admins can update officeholder wall claim items"
  ON public.office_holder_wall_claim_items FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE TABLE IF NOT EXISTS public.office_holder_wall_claim_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.office_holder_wall_claims(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS office_holder_wall_claim_invites_claim_idx
  ON public.office_holder_wall_claim_invites (claim_id, created_at DESC);

ALTER TABLE public.office_holder_wall_claim_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read officeholder wall claim invites" ON public.office_holder_wall_claim_invites;
CREATE POLICY "Admins can read officeholder wall claim invites"
  ON public.office_holder_wall_claim_invites FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

DROP POLICY IF EXISTS "Admins can create officeholder wall claim invites" ON public.office_holder_wall_claim_invites;
CREATE POLICY "Admins can create officeholder wall claim invites"
  ON public.office_holder_wall_claim_invites FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update officeholder wall claim invites" ON public.office_holder_wall_claim_invites;
CREATE POLICY "Admins can update officeholder wall claim invites"
  ON public.office_holder_wall_claim_invites FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

COMMENT ON TABLE public.office_holder_wall_claims IS
  'Claim lifecycle for imported officeholder walls. Merge and reversal operations must preserve this record.';

COMMENT ON TABLE public.office_holder_wall_claim_items IS
  'Per-entity audit trail for officeholder wall merges and reversals.';

COMMENT ON TABLE public.office_holder_wall_claim_invites IS
  'Single-use, hashed-token invitations scoped to one officeholder wall claim.';
