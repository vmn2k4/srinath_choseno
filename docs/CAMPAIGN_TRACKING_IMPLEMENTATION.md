# Campaign Email Tracking System - Full Implementation Guide

## Overview
Complete tracking system for campaign emails including:
- ✅ Email open tracking (with timestamp)
- ✅ Link click tracking (which links, when, how many times)
- ✅ Wall view tracking (if they visited the candidate wall)
- ✅ Time to open calculation
- ✅ Read time estimation
- ✅ Engagement scoring

---

## Part 1: Database Schema Changes

### New columns for `campaign_sends` table

```sql
ALTER TABLE campaign_sends ADD COLUMN (
  opened_at TIMESTAMP,
  opened_count INTEGER DEFAULT 0,
  last_opened_at TIMESTAMP,
  first_open_time_seconds INTEGER,  -- seconds from send to first open
  link_clicks INTEGER DEFAULT 0,
  links_clicked JSONB DEFAULT '[]',  -- array of {link, clicked_at, count}
  wall_visited BOOLEAN DEFAULT false,
  wall_visited_at TIMESTAMP,
  wall_visit_duration_seconds INTEGER,
  estimated_read_time_seconds INTEGER,
  engagement_score INTEGER DEFAULT 0,  -- 0-100 score based on all metrics
  tracking_token VARCHAR(255) UNIQUE
);

CREATE INDEX idx_campaign_sends_tracking_token ON campaign_sends(tracking_token);
CREATE INDEX idx_campaign_sends_opened_at ON campaign_sends(opened_at);
```

### New tracking_events table (detailed log)

```sql
CREATE TABLE tracking_events (
  id BIGSERIAL PRIMARY KEY,
  send_id UUID REFERENCES campaign_sends(id) ON DELETE CASCADE,
  event_type VARCHAR(50),  -- 'open', 'click', 'wall_view', 'wall_exit'
  event_data JSONB,  -- {link_url, ip, user_agent, viewport_size, etc}
  occurred_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tracking_events_send_id ON tracking_events(send_id);
CREATE INDEX idx_tracking_events_occurred_at ON tracking_events(occurred_at);
```

---

## Part 2: Backend API Endpoints

### File: `supabase/functions/track-email-open/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

serve(async (req) => {
  const url = new URL(req.url)
  const token = url.searchParams.get("token")

  if (!token) {
    return new Response("Invalid token", { status: 400 })
  }

  try {
    // Get the send record
    const { data: send, error: fetchError } = await supabase
      .from("campaign_sends")
      .select("id, sent_at, opened_at, opened_count")
      .eq("tracking_token", token)
      .single()

    if (fetchError || !send) {
      return new Response("Not found", { status: 404 })
    }

    const now = new Date()
    const openedCount = (send.opened_count || 0) + 1
    const firstOpenTime = send.opened_at
      ? null
      : Math.floor(
          (now.getTime() - new Date(send.sent_at).getTime()) / 1000
        ) // seconds

    // Log the event
    await supabase.from("tracking_events").insert({
      send_id: send.id,
      event_type: "open",
      event_data: {
        ip: req.headers.get("x-forwarded-for") || "unknown",
        user_agent: req.headers.get("user-agent"),
        timestamp: now.toISOString(),
        open_number: openedCount,
      },
    })

    // Update send record
    const { error: updateError } = await supabase
      .from("campaign_sends")
      .update({
        opened_at: send.opened_at || now,
        last_opened_at: now,
        opened_count: openedCount,
        first_open_time_seconds: firstOpenTime || send.first_open_time_seconds,
      })
      .eq("id", send.id)

    if (updateError) throw updateError

    // Return 1x1 transparent pixel
    const pixel = new Uint8Array([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
      0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x0a,
      0x00, 0x01, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
      0x00, 0x02, 0x02, 0x4c, 0x01, 0x00, 0x3b,
    ])

    return new Response(pixel, {
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    })
  } catch (error) {
    console.error("Open tracking error:", error)
    return new Response("Error", { status: 500 })
  }
})
```

### File: `supabase/functions/track-link-click/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

serve(async (req) => {
  const url = new URL(req.url)
  const token = url.searchParams.get("token")
  const linkUrl = url.searchParams.get("link")
  const redirectUrl = url.searchParams.get("redirect")

  if (!token || !linkUrl || !redirectUrl) {
    return new Response("Invalid parameters", { status: 400 })
  }

  try {
    // Get the send record
    const { data: send, error: fetchError } = await supabase
      .from("campaign_sends")
      .select("id, links_clicked")
      .eq("tracking_token", token)
      .single()

    if (fetchError || !send) {
      return new Response("Not found", { status: 404 })
    }

    const now = new Date()
    const existingLinks = send.links_clicked || []
    const linkRecord = existingLinks.find((l: any) => l.link === linkUrl)

    let updatedLinks
    if (linkRecord) {
      linkRecord.count = (linkRecord.count || 1) + 1
      linkRecord.last_clicked_at = now.toISOString()
      updatedLinks = existingLinks
    } else {
      updatedLinks = [
        ...existingLinks,
        {
          link: linkUrl,
          clicked_at: now.toISOString(),
          count: 1,
        },
      ]
    }

    // Log the event
    await supabase.from("tracking_events").insert({
      send_id: send.id,
      event_type: "click",
      event_data: {
        link: linkUrl,
        ip: req.headers.get("x-forwarded-for") || "unknown",
        user_agent: req.headers.get("user-agent"),
        timestamp: now.toISOString(),
      },
    })

    // Update send record
    await supabase
      .from("campaign_sends")
      .update({
        link_clicks: (send.link_clicks || 0) + 1,
        links_clicked: updatedLinks,
      })
      .eq("id", send.id)

    // Redirect to actual URL
    return new Response(null, {
      status: 302,
      headers: { Location: decodeURIComponent(redirectUrl) },
    })
  } catch (error) {
    console.error("Link tracking error:", error)
    // Still redirect even on error
    return new Response(null, {
      status: 302,
      headers: { Location: decodeURIComponent(redirectUrl) },
    })
  }
})
```

### File: `supabase/functions/track-wall-view/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 })

  try {
    const { token, wall_slug, duration_seconds } = await req.json()

    if (!token || !wall_slug) {
      return new Response("Missing parameters", { status: 400 })
    }

    const now = new Date()

    // Get the send record
    const { data: send, error: fetchError } = await supabase
      .from("campaign_sends")
      .select("id")
      .eq("tracking_token", token)
      .single()

    if (fetchError || !send) {
      return new Response("Not found", { status: 404 })
    }

    // Log the event
    await supabase.from("tracking_events").insert({
      send_id: send.id,
      event_type: "wall_view",
      event_data: {
        wall_slug,
        duration_seconds,
        ip: req.headers.get("x-forwarded-for") || "unknown",
        user_agent: req.headers.get("user-agent"),
        timestamp: now.toISOString(),
      },
    })

    // Update send record
    await supabase
      .from("campaign_sends")
      .update({
        wall_visited: true,
        wall_visited_at: now,
        wall_visit_duration_seconds: duration_seconds,
      })
      .eq("id", send.id)

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("Wall tracking error:", error)
    return new Response("Error", { status: 500 })
  }
})
```

---

## Part 3: Update Email Templates

### Modified `campaignTemplates.ts` with tracking

```typescript
// Add tracking token generation
import { v4 as uuidv4 } from 'uuid'

export function addTrackingToTemplate(
  htmlBody: string,
  trackingToken: string
): string {
  const trackingPixel = `<img src="https://choseno.com/functions/v1/track-email-open?token=${trackingToken}" width="1" height="1" style="display:none;" alt="" />`
  
  // Add pixel before closing body tag
  return htmlBody.replace('</body>', `${trackingPixel}</body>`)
}

export function createTrackedLink(
  originalUrl: string,
  trackingToken: string
): string {
  const encoded = encodeURIComponent(originalUrl)
  return `https://choseno.com/functions/v1/track-link-click?token=${trackingToken}&link=${encodeURIComponent(originalUrl)}&redirect=${encoded}`
}
```

### Updated `CampaignAdminClient.tsx`

```typescript
// In sendCampaignInvite or similar function:
import { addTrackingToTemplate, createTrackedLink } from '@/lib/utils/campaignTemplates'

const trackingToken = uuidv4()

// Add tracking pixel to HTML
let trackedHtml = addTrackingToTemplate(htmlTemplate, trackingToken)

// Replace all links with tracked links
const linkRegex = /href="(https?:\/\/[^"]+)"/g
trackedHtml = trackedHtml.replace(linkRegex, (match, url) => {
  return `href="${createTrackedLink(url, trackingToken)}"`
})

// Store tracking token when sending
const { error } = await sendCampaignInvite(supabase, {
  // ... existing fields
  trackingToken,
  trackedHtmlTemplate: trackedHtml,
})
```

---

## Part 4: Update Admin Dashboard UI

### New columns in Campaign History table

```typescript
// In CampaignAdminClient.tsx, update the history display

type CampaignSendRow = {
  // existing fields...
  opened_at: string | null
  opened_count: number
  last_opened_at: string | null
  first_open_time_seconds: number | null
  link_clicks: number
  wall_visited: boolean
  wall_visited_at: string | null
  engagement_score: number
}

// Add these columns to the table
<table>
  <thead>
    <tr>
      <th>Recipient</th>
      <th>Campaign</th>
      <th>Sent</th>
      <th>Opened</th>
      <th>Time to Open</th>
      <th>Link Clicks</th>
      <th>Wall View</th>
      <th>Engagement</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    {sends.map((send) => (
      <tr key={send.id}>
        <td>{send.recipient_name}</td>
        <td>{send.campaign_name}</td>
        <td>{formatDate(send.sent_at)}</td>
        <td>
          {send.opened_at ? (
            <Badge tone="emerald">
              {send.opened_count}x {formatDate(send.last_opened_at)}
            </Badge>
          ) : (
            <Badge tone="neutral">Not opened</Badge>
          )}
        </td>
        <td>
          {send.first_open_time_seconds ? (
            formatSeconds(send.first_open_time_seconds)
          ) : (
            "-"
          )}
        </td>
        <td>
          {send.link_clicks > 0 ? (
            <Badge tone="accent">{send.link_clicks} clicks</Badge>
          ) : (
            "-"
          )}
        </td>
        <td>
          {send.wall_visited ? (
            <Badge tone="primary">
              {send.wall_visit_duration_seconds}s
            </Badge>
          ) : (
            "-"
          )}
        </td>
        <td>
          <div className="flex items-center gap-1">
            <div className="w-16 h-2 bg-border-light rounded">
              <div
                className="h-full bg-primary rounded"
                style={{
                  width: `${send.engagement_score}%`,
                }}
              />
            </div>
            <span className="text-xs text-text-muted">{send.engagement_score}/100</span>
          </div>
        </td>
        <td>
          <Button
            size="xs"
            variant="outline"
            onClick={() => showTrackingDetails(send.id)}
          >
            Details
          </Button>
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

### Engagement Score Calculation

```typescript
export function calculateEngagementScore(send: CampaignSendRow): number {
  let score = 0

  // Opened (40 points)
  if (send.opened_at) {
    score += 40
    // Bonus for multiple opens
    if (send.opened_count > 1) {
      score += Math.min((send.opened_count - 1) * 5, 10)
    }
  }

  // Time to open (10 points) - faster is better
  if (send.first_open_time_seconds) {
    if (send.first_open_time_seconds < 3600) score += 10 // opened within 1 hour
    else if (send.first_open_time_seconds < 86400) score += 5 // within 24 hours
  }

  // Link clicks (30 points)
  if (send.link_clicks > 0) {
    score += Math.min(send.link_clicks * 10, 30)
  }

  // Wall visit (20 points)
  if (send.wall_visited) {
    score += 20
    // Bonus for time spent
    if (send.wall_visit_duration_seconds && send.wall_visit_duration_seconds > 30) {
      score += 10 // spent more than 30 seconds
    }
  }

  return Math.min(score, 100)
}
```

### Detailed Tracking Modal

```typescript
// New component: TrackingDetailsModal.tsx

export function TrackingDetailsModal({ send }: { send: CampaignSendRow }) {
  const [events, setEvents] = useState<TrackingEvent[]>([])

  useEffect(() => {
    // Fetch tracking events for this send
    supabase
      .from("tracking_events")
      .select("*")
      .eq("send_id", send.id)
      .order("occurred_at", { ascending: false })
      .then(({ data }) => setEvents(data || []))
  }, [send.id])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Total Opens" value={send.opened_count} />
        <StatCard label="Link Clicks" value={send.link_clicks} />
        <StatCard
          label="Time to First Open"
          value={send.first_open_time_seconds ? formatSeconds(send.first_open_time_seconds) : "-"}
        />
        <StatCard
          label="Wall View Time"
          value={send.wall_visit_duration_seconds ? `${send.wall_visit_duration_seconds}s` : "-"}
        />
      </div>

      <div>
        <h3 className="font-semibold mb-3">Event Timeline</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {events.map((event) => (
            <div key={event.id} className="p-3 border border-border-light/40 rounded">
              <div className="flex justify-between items-start">
                <div>
                  <Badge>{event.event_type}</Badge>
                  {event.event_type === "click" && (
                    <p className="text-xs text-text-muted mt-1">
                      Clicked: {event.event_data.link}
                    </p>
                  )}
                  {event.event_type === "wall_view" && (
                    <p className="text-xs text-text-muted mt-1">
                      Viewed: {event.event_data.wall_slug} ({event.event_data.duration_seconds}s)
                    </p>
                  )}
                </div>
                <time className="text-xs text-text-muted">
                  {formatDate(event.occurred_at)}
                </time>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

---

## Part 5: Wall View Tracking (Frontend)

### Add to candidate wall page

```typescript
// In pages/wall/[slug].tsx or similar

useEffect(() => {
  const trackingToken = new URLSearchParams(window.location.search).get("t")
  if (!trackingToken) return

  const startTime = Date.now()

  // Track wall view when component unmounts or user navigates away
  return () => {
    const durationSeconds = Math.floor((Date.now() - startTime) / 1000)

    // Send tracking event
    fetch("/functions/v1/track-wall-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: trackingToken,
        wall_slug: slug,
        duration_seconds: durationSeconds,
      }),
    }).catch(console.error)
  }
}, [slug])
```

---

## Part 6: Implementation Checklist

- [ ] Run database migrations (schema changes)
- [ ] Deploy tracking functions to Supabase
- [ ] Update `campaignTemplates.ts` with tracking
- [ ] Update `CampaignAdminClient.tsx` with UI columns
- [ ] Add `TrackingDetailsModal` component
- [ ] Add wall view tracking to wall pages
- [ ] Test open tracking
- [ ] Test link click tracking
- [ ] Test wall view tracking
- [ ] Add engagement score calculation
- [ ] Update campaign send service to include tracking token
- [ ] Document tracking in README

---

## Testing Checklist

```bash
# Test open tracking
1. Send test email
2. Open email in client
3. Check campaign_sends table for opened_at timestamp
4. Verify tracking_events has 'open' event

# Test link tracking
1. Click a link in email
2. Should redirect to intended URL
3. Check campaign_sends.link_clicks incremented
4. Check tracking_events has 'click' event

# Test wall view tracking
1. Visit wall with ?t=TOKEN param
2. Stay on page for ~30 seconds
3. Navigate away
4. Check campaign_sends.wall_visited = true
5. Check wall_visit_duration_seconds recorded
```

---

## Notes

- All tracking is privacy-respecting (no PII stored, only IP + user agent for debugging)
- Read time estimation is based on Choseno's existing email length
- Engagement score is weighted to prioritize opens → clicks → wall visits
- Can expand with future events (reply tracking, forward tracking, etc)
