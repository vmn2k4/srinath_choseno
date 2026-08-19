-- Campaign Tracking System Migration
-- Run with: supabase migration up

-- Add tracking columns to campaign_sends table
ALTER TABLE campaign_sends ADD COLUMN IF NOT EXISTS (
  tracking_token VARCHAR(255) UNIQUE,
  opened_at TIMESTAMP,
  opened_count INTEGER DEFAULT 0,
  last_opened_at TIMESTAMP,
  first_open_time_seconds INTEGER,
  link_clicks INTEGER DEFAULT 0,
  links_clicked JSONB DEFAULT '[]'::jsonb,
  wall_visited BOOLEAN DEFAULT false,
  wall_visited_at TIMESTAMP,
  wall_visit_duration_seconds INTEGER,
  estimated_read_time_seconds INTEGER,
  engagement_score INTEGER DEFAULT 0
);

-- Create indexes for tracking
CREATE INDEX IF NOT EXISTS idx_campaign_sends_tracking_token ON campaign_sends(tracking_token);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_opened_at ON campaign_sends(opened_at);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_wall_visited ON campaign_sends(wall_visited);

-- Create tracking_events table for detailed event logs
CREATE TABLE IF NOT EXISTS tracking_events (
  id BIGSERIAL PRIMARY KEY,
  send_id UUID REFERENCES campaign_sends(id) ON DELETE CASCADE NOT NULL,
  event_type VARCHAR(50) NOT NULL,  -- 'open', 'click', 'wall_view', 'wall_exit'
  event_data JSONB,
  occurred_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes on tracking_events
CREATE INDEX IF NOT EXISTS idx_tracking_events_send_id ON tracking_events(send_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_occurred_at ON tracking_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_tracking_events_event_type ON tracking_events(event_type);

-- Enable RLS on tracking_events
ALTER TABLE tracking_events ENABLE ROW LEVEL SECURITY;

-- RLS policies - only Choseno functions and admins can read
CREATE POLICY "tracking_events_select_admin" ON tracking_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Allow functions to write tracking events (no auth required)
CREATE POLICY "tracking_events_insert_public" ON tracking_events
  FOR INSERT WITH CHECK (true);

-- Set grants for service role (used by functions)
GRANT INSERT ON tracking_events TO service_role;
GRANT UPDATE ON campaign_sends TO service_role;
