-- Campaign Tracking System Migration
-- Adds tracking columns to politician_claim_campaigns and creates tracking_events table

-- 1. Add tracking columns to politician_claim_campaigns table
ALTER TABLE public.politician_claim_campaigns ADD COLUMN IF NOT EXISTS tracking_token VARCHAR(255) UNIQUE;
ALTER TABLE public.politician_claim_campaigns ADD COLUMN IF NOT EXISTS opened_count INTEGER DEFAULT 0;
ALTER TABLE public.politician_claim_campaigns ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMPTZ;
ALTER TABLE public.politician_claim_campaigns ADD COLUMN IF NOT EXISTS first_open_time_seconds INTEGER;
ALTER TABLE public.politician_claim_campaigns ADD COLUMN IF NOT EXISTS link_clicks INTEGER DEFAULT 0;
ALTER TABLE public.politician_claim_campaigns ADD COLUMN IF NOT EXISTS links_clicked JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.politician_claim_campaigns ADD COLUMN IF NOT EXISTS wall_visited BOOLEAN DEFAULT false;
ALTER TABLE public.politician_claim_campaigns ADD COLUMN IF NOT EXISTS wall_visited_at TIMESTAMPTZ;
ALTER TABLE public.politician_claim_campaigns ADD COLUMN IF NOT EXISTS wall_visit_duration_seconds INTEGER;
ALTER TABLE public.politician_claim_campaigns ADD COLUMN IF NOT EXISTS estimated_read_time_seconds INTEGER;
ALTER TABLE public.politician_claim_campaigns ADD COLUMN IF NOT EXISTS engagement_score INTEGER DEFAULT 0;

-- 2. Create indexes for tracking on politician_claim_campaigns
CREATE INDEX IF NOT EXISTS idx_politician_claim_campaigns_tracking_token ON public.politician_claim_campaigns(tracking_token);
CREATE INDEX IF NOT EXISTS idx_politician_claim_campaigns_opened_at ON public.politician_claim_campaigns(opened_at);
CREATE INDEX IF NOT EXISTS idx_politician_claim_campaigns_wall_visited ON public.politician_claim_campaigns(wall_visited);

-- 3. Create tracking_events table for detailed event logs
CREATE TABLE IF NOT EXISTS public.tracking_events (
  id BIGSERIAL PRIMARY KEY,
  send_id UUID REFERENCES public.politician_claim_campaigns(id) ON DELETE CASCADE NOT NULL,
  event_type VARCHAR(50) NOT NULL,  -- 'open', 'click', 'wall_view', 'wall_exit'
  event_data JSONB,
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes on tracking_events
CREATE INDEX IF NOT EXISTS idx_tracking_events_send_id ON public.tracking_events(send_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_occurred_at ON public.tracking_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_tracking_events_event_type ON public.tracking_events(event_type);

-- Enable RLS on tracking_events
ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;

-- RLS policies - admins can read tracking events
DROP POLICY IF EXISTS "tracking_events_select_admin" ON public.tracking_events;
CREATE POLICY "tracking_events_select_admin" ON public.tracking_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE public.profiles.id = auth.uid()
      AND public.profiles.role = 'admin'
    )
  );

-- Allow public insert so tracking endpoints can write events
DROP POLICY IF EXISTS "tracking_events_insert_public" ON public.tracking_events;
CREATE POLICY "tracking_events_insert_public" ON public.tracking_events
  FOR INSERT WITH CHECK (true);

-- Set grants for service role & authenticated
GRANT ALL ON public.tracking_events TO service_role;
GRANT SELECT ON public.tracking_events TO authenticated;
GRANT ALL ON public.politician_claim_campaigns TO service_role;

-- 4. Create campaign_sends view pointing to politician_claim_campaigns for backward compatibility
CREATE OR REPLACE VIEW public.campaign_sends AS
SELECT
  id,
  politician_name,
  politician_email,
  politician_email AS email,
  role_title,
  city,
  claim_token,
  claim_link,
  campaign_name,
  status,
  error_message,
  sent_at,
  opened_at,
  claimed_at,
  created_by,
  created_at,
  updated_at,
  tracking_token,
  opened_count,
  last_opened_at,
  first_open_time_seconds,
  link_clicks,
  links_clicked,
  wall_visited,
  wall_visited_at,
  wall_visit_duration_seconds,
  estimated_read_time_seconds,
  engagement_score
FROM public.politician_claim_campaigns;

GRANT SELECT ON public.campaign_sends TO service_role;
GRANT SELECT ON public.campaign_sends TO authenticated;
