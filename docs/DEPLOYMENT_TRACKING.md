# Campaign Tracking System - Deployment Guide

## Prerequisites

```bash
# Install Supabase CLI
npm install -g supabase

# Initialize Supabase (if not already done)
supabase init

# Make sure you're logged in
supabase login
```

---

## Step 1: Run Database Migration

```bash
# Navigate to project root
cd /Users/vmn2k4/Coding/Choseno

# Create and run the migration
supabase migration up

# Or if you want to apply a specific migration:
supabase db push
```

**What this does:**
- ✅ Adds tracking columns to `campaign_sends` table
- ✅ Creates `tracking_events` table for event logging
- ✅ Sets up indexes for performance
- ✅ Enables RLS (Row Level Security)

**Verify in Supabase dashboard:**
```bash
supabase db list-tables
```

You should see both `campaign_sends` and `tracking_events` tables.

---

## Step 2: Deploy Edge Functions

```bash
# Deploy all three tracking functions
supabase functions deploy track-email-open
supabase functions deploy track-link-click
supabase functions deploy track-wall-view

# Or deploy all at once:
supabase functions deploy
```

**What this does:**
- ✅ Deploys `track-email-open` to track when emails are opened
- ✅ Deploys `track-link-click` to track link clicks with redirect
- ✅ Deploys `track-wall-view` to track wall visits and duration

**Verify deployment:**
```bash
supabase functions list
```

You should see all three functions listed with their URLs.

---

## Step 3: Get Function URLs

After deployment, get your function URLs:

```bash
supabase functions list --json
```

Your URLs will be:
```
https://your-project-ref.supabase.co/functions/v1/track-email-open
https://your-project-ref.supabase.co/functions/v1/track-link-click
https://your-project-ref.supabase.co/functions/v1/track-wall-view
```

---

## Step 4: Update Code with Function URLs

### Update `lib/utils/campaignTemplates.ts`

```typescript
// Replace with your actual URLs from Step 3
const TRACKING_BASE_URL = "https://YOUR-PROJECT-REF.supabase.co/functions/v1"

export function addTrackingPixelToTemplate(
  htmlBody: string,
  trackingToken: string
): string {
  const trackingPixelUrl = `${TRACKING_BASE_URL}/track-email-open?token=${trackingToken}`
  const trackingPixel = `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />`
  
  // Add pixel before closing body tag
  return htmlBody.replace('</body>', `${trackingPixel}</body>`)
}

export function createTrackedLink(
  originalUrl: string,
  trackingToken: string
): string {
  const encoded = encodeURIComponent(originalUrl)
  return `${TRACKING_BASE_URL}/track-link-click?token=${trackingToken}&link=${encoded}&redirect=${encoded}`
}
```

---

## Step 5: Update CampaignAdminClient.tsx

```typescript
import { v4 as uuidv4 } from 'uuid'
import { addTrackingPixelToTemplate, createTrackedLink } from '@/lib/utils/campaignTemplates'

// In your sendCampaignInvite function:

async function sendOne(index: number) {
  const record = rows[index]
  
  // Generate unique tracking token
  const trackingToken = uuidv4()
  
  // Add tracking pixel to email
  let trackedHtml = addTrackingPixelToTemplate(body, trackingToken)
  
  // Rewrite all links with tracking
  const linkRegex = /href="(https?:\/\/[^"]+)"/g
  trackedHtml = trackedHtml.replace(linkRegex, (match, url) => {
    return `href="${createTrackedLink(url, trackingToken)}"`
  })
  
  // Fill template variables
  const filledSubject = fillCampaignTemplate(subject, record.data)
  const htmlTemplate = fillCampaignTemplate(trackedHtml, record.data)
  
  // Send with tracking token
  const { error } = await sendCampaignInvite(supabase, {
    name: record.data.name,
    email: record.data.email,
    role: record.data.role,
    city: record.data.city,
    subject: filledSubject,
    htmlTemplate,
    campaignName: campaignName.trim() || "Untitled Campaign",
    redirectOrigin: window.location.origin,
    trackingToken, // Add this
  })

  setRows((prev) =>
    prev.map((r, i) =>
      i === index
        ? { ...r, status: error ? "failed" : "sent", errorMessage: error?.message }
        : r
    )
  )
  loadHistory()
}
```

---

## Step 6: Add Tracking to Campaign Send Service

Update `lib/services/campaigns.ts`:

```typescript
export async function sendCampaignInvite(
  supabase: SupabaseClient,
  payload: {
    name: string
    email: string
    role: string
    city: string
    subject: string
    htmlTemplate: string
    campaignName: string
    redirectOrigin: string
    trackingToken?: string // Add this
  }
) {
  // Your existing send logic...
  
  // Store tracking token when saving the send record
  const { error } = await supabase.from("campaign_sends").insert({
    // ... existing fields
    tracking_token: payload.trackingToken,
  })
  
  return { error }
}
```

---

## Step 7: Add Wall View Tracking

Update your wall component (e.g., `pages/wall/[slug].tsx`):

```typescript
'use client'

import { useEffect, useRef } from 'react'

export default function WallPage({ params }: { params: { slug: string } }) {
  const trackingStartTimeRef = useRef<number>(0)

  useEffect(() => {
    // Get tracking token from URL params
    const trackingToken = new URLSearchParams(window.location.search).get('t')
    
    if (trackingToken) {
      trackingStartTimeRef.current = Date.now()

      // Track wall exit time
      const handleBeforeUnload = () => {
        const durationSeconds = Math.floor(
          (Date.now() - trackingStartTimeRef.current) / 1000
        )

        // Send tracking event
        navigator.sendBeacon(
          'https://YOUR-PROJECT-REF.supabase.co/functions/v1/track-wall-view',
          JSON.stringify({
            token: trackingToken,
            wall_slug: params.slug,
            duration_seconds: durationSeconds,
          })
        )
      }

      window.addEventListener('beforeunload', handleBeforeUnload)

      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload)
      }
    }
  }, [params.slug])

  // Rest of your component...
}
```

---

## Step 8: Test the Tracking

### Test Open Tracking
1. Send a test email from `/admin/campaign`
2. Check email and look at the pixel image (open in browser dev tools)
3. Go to Supabase dashboard → `campaign_sends` table
4. Verify `opened_at` and `opened_count` are updated

### Test Link Click Tracking
1. Click a link in the email
2. Verify you're redirected to the correct URL
3. Check Supabase → `campaign_sends` table
4. Verify `link_clicks` is incremented and `links_clicked` JSON has the link

### Test Wall View Tracking
1. Visit a wall with `?t=TRACKING_TOKEN` parameter
2. Stay for ~30 seconds
3. Navigate away
4. Check Supabase → `campaign_sends` table
5. Verify `wall_visited`, `wall_visited_at`, and `wall_visit_duration_seconds` are set

---

## Step 9: Display Tracking in Admin Dashboard

Add these columns to your campaign history table in `CampaignAdminClient.tsx`:

```typescript
// Type definition
interface CampaignSendWithTracking extends CampaignSendRow {
  opened_at: string | null
  opened_count: number
  last_opened_at: string | null
  first_open_time_seconds: number | null
  link_clicks: number
  wall_visited: boolean
  wall_visit_duration_seconds: number | null
  engagement_score: number
}

// Add these columns to your table header
<th>Opened</th>
<th>Time to Open</th>
<th>Clicks</th>
<th>Wall View</th>
<th>Engagement</th>

// Add these to your table body
<td>
  {send.opened_at ? (
    <Badge tone="emerald">
      {send.opened_count}x • {formatDistanceToNow(new Date(send.last_opened_at!))}
    </Badge>
  ) : (
    <Badge tone="neutral">Not opened</Badge>
  )}
</td>

<td>
  {send.first_open_time_seconds ? (
    <span className="text-sm">
      {send.first_open_time_seconds < 3600
        ? `${Math.round(send.first_open_time_seconds / 60)}m`
        : `${Math.round(send.first_open_time_seconds / 3600)}h`}
    </span>
  ) : (
    "-"
  )}
</td>

<td>
  {send.link_clicks > 0 ? (
    <Badge tone="accent">{send.link_clicks}</Badge>
  ) : (
    "-"
  )}
</td>

<td>
  {send.wall_visited ? (
    <Badge tone="primary">{send.wall_visit_duration_seconds}s</Badge>
  ) : (
    "-"
  )}
</td>

<td>
  <div className="flex items-center gap-1">
    <div className="w-16 h-2 bg-border-light rounded">
      <div
        className="h-full bg-primary rounded"
        style={{ width: `${calculateEngagementScore(send)}%` }}
      />
    </div>
    <span className="text-xs text-text-muted">{calculateEngagementScore(send)}/100</span>
  </div>
</td>
```

---

## Engagement Score Calculation

```typescript
function calculateEngagementScore(send: CampaignSendWithTracking): number {
  let score = 0

  // Opened (40 points)
  if (send.opened_at) {
    score += 40
    if (send.opened_count > 1) {
      score += Math.min((send.opened_count - 1) * 5, 10)
    }
  }

  // Time to open (10 points) - faster is better
  if (send.first_open_time_seconds) {
    if (send.first_open_time_seconds < 3600) score += 10
    else if (send.first_open_time_seconds < 86400) score += 5
  }

  // Link clicks (30 points)
  if (send.link_clicks > 0) {
    score += Math.min(send.link_clicks * 10, 30)
  }

  // Wall visit (20 points)
  if (send.wall_visited) {
    score += 20
    if (send.wall_visit_duration_seconds && send.wall_visit_duration_seconds > 30) {
      score += 10
    }
  }

  return Math.min(score, 100)
}
```

---

## Troubleshooting

### Functions not deploying?
```bash
# Check function status
supabase functions list

# View function logs
supabase functions list --json
```

### Tracking data not appearing?
1. Check Supabase dashboard → SQL Editor
2. Run: `SELECT * FROM tracking_events ORDER BY occurred_at DESC LIMIT 10;`
3. Check for errors in function logs

### Links not redirecting?
- Verify URL encoding in `createTrackedLink`
- Check browser console for errors
- Test with a simple URL first (e.g., `https://www.choseno.com`)

---

## Environment Variables

Add to your `.env.local`:

```env
NEXT_PUBLIC_TRACKING_BASE_URL=https://YOUR-PROJECT-REF.supabase.co/functions/v1
```

---

## Next Steps

1. ✅ Run migration
2. ✅ Deploy functions
3. ✅ Update campaign code
4. ✅ Add wall tracking
5. ✅ Update admin dashboard
6. ✅ Test everything
7. ✅ Send first tracked campaign!

**Questions?** Check the implementation guide at `docs/CAMPAIGN_TRACKING_IMPLEMENTATION.md`
