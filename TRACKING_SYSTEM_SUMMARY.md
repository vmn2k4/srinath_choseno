# Campaign Tracking System - Complete Summary

## 📦 What's Been Created

### Database & Functions (Ready to Deploy)
```
supabase/
├── migrations/
│   └── 20260819_add_campaign_tracking.sql ✅
│       - Adds tracking columns to campaign_sends
│       - Creates tracking_events table
│       - Sets up RLS & indexes
│
└── functions/
    ├── track-email-open/index.ts ✅
    │   - Tracks when emails are opened
    │   - Returns 1x1 tracking pixel
    │
    ├── track-link-click/index.ts ✅
    │   - Tracks individual link clicks
    │   - Redirects to actual URL
    │
    └── track-wall-view/index.ts ✅
        - Tracks wall visits & duration
        - Called when user leaves wall
```

### Documentation (Ready to Read)
```
docs/
├── CAMPAIGN_TRACKING_IMPLEMENTATION.md ✅
│   - Full technical implementation guide
│   - Database schema details
│   - API endpoint documentation
│   - Admin UI code examples
│
└── DEPLOYMENT_TRACKING.md ✅
    - Step-by-step deployment guide
    - Code integration instructions
    - Testing procedures
    - Troubleshooting section

TRACKING_DEPLOYMENT_QUICKSTART.md ✅
- One-command deployment
- Quick verification
- Function URLs
- Code update checklist
```

---

## 🚀 Deployment Steps (Copy-Paste Ready)

### Step 1: Deploy to Supabase
```bash
cd /Users/vmn2k4/Coding/Choseno

# Run migration
supabase db push

# Deploy functions
supabase functions deploy
```

### Step 2: Get Your Project Ref
```bash
supabase functions list --json
```
Look for: `https://YOUR-PROJECT-REF.supabase.co/functions/v1/track-email-open`

### Step 3: Update Code (3 places)

**File 1: `lib/utils/campaignTemplates.ts`**
```typescript
const TRACKING_BASE_URL = "https://YOUR-PROJECT-REF.supabase.co/functions/v1"

export function addTrackingPixelToTemplate(
  htmlBody: string,
  trackingToken: string
): string {
  const trackingPixelUrl = `${TRACKING_BASE_URL}/track-email-open?token=${trackingToken}`
  const trackingPixel = `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" />`
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

**File 2: `CampaignAdminClient.tsx` (in sendOne function)**
```typescript
import { v4 as uuidv4 } from 'uuid'
import { addTrackingPixelToTemplate, createTrackedLink } from '@/lib/utils/campaignTemplates'

// In sendOne:
const trackingToken = uuidv4()
let trackedHtml = addTrackingPixelToTemplate(body, trackingToken)

const linkRegex = /href="(https?:\/\/[^"]+)"/g
trackedHtml = trackedHtml.replace(linkRegex, (match, url) => {
  return `href="${createTrackedLink(url, trackingToken)}"`
})

// Pass trackingToken to sendCampaignInvite
const { error } = await sendCampaignInvite(supabase, {
  // ... existing fields
  trackingToken,
})
```

**File 3: `lib/services/campaigns.ts` (sendCampaignInvite function)**
```typescript
// When inserting to campaign_sends:
const { error } = await supabase.from("campaign_sends").insert({
  // ... existing fields
  tracking_token: payload.trackingToken,
})
```

**File 4 (Optional): Wall tracking in `pages/wall/[slug].tsx`**
```typescript
useEffect(() => {
  const trackingToken = new URLSearchParams(window.location.search).get('t')
  
  if (trackingToken) {
    const startTime = Date.now()
    
    const handleBeforeUnload = () => {
      const durationSeconds = Math.floor((Date.now() - startTime) / 1000)
      navigator.sendBeacon(
        'https://YOUR-PROJECT-REF.supabase.co/functions/v1/track-wall-view',
        JSON.stringify({
          token: trackingToken,
          wall_slug: slug,
          duration_seconds: durationSeconds,
        })
      )
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }
}, [slug])
```

---

## 📊 What You'll See in Admin Dashboard

After deployment, your campaign history will show:

```
Brenda Locke | BC Test | Sent 2h | ✓ Opened 2x (15m ago) | 15m | 3 clicks | Wall: 47s | 72/100
```

Click **"Details"** for complete event timeline:
- 2:15 PM - Email opened
- 2:32 PM - Clicked "Find my district" link
- 2:45 PM - Clicked wall link
- 3:02 PM - Email opened again (second open)
- 3:05 PM - Viewed wall (47 seconds)

---

## 📈 Tracking Metrics

### What Gets Tracked
- ✅ **Email Opens** - When & how many times
- ✅ **Time to Open** - Seconds from send to first open
- ✅ **Link Clicks** - Which links, when, how many times
- ✅ **Wall Visits** - Did they visit the wall?
- ✅ **Time on Wall** - How long they stayed
- ✅ **Engagement Score** - Overall 0-100 score

### Engagement Score Breakdown
- **40 points** - Email opened (+ bonus for multiple opens)
- **10 points** - Fast open (within 1 hour)
- **30 points** - Link clicks (up to 3 clicks max)
- **20 points** - Wall visit (+ bonus for 30+ seconds)
- **Total: 100 points max**

---

## 🧪 Quick Test

1. **Send test email** via `/admin/campaign`
2. **Open email** → See `opened_at` populate in dashboard
3. **Click link** → Get redirected + see `link_clicks` increment
4. **Visit wall with `?t=TOKEN`** → See `wall_visited` populate

---

## 📝 Database Queries

### Check tracking is working
```sql
-- See all open events
SELECT send_id, event_type, occurred_at 
FROM tracking_events 
ORDER BY occurred_at DESC 
LIMIT 10;

-- See campaign summary
SELECT 
  email,
  opened_at,
  opened_count,
  link_clicks,
  wall_visited,
  wall_visit_duration_seconds
FROM campaign_sends
WHERE opened_at IS NOT NULL
LIMIT 5;
```

---

## 🎯 Next Action Items

- [ ] Run `supabase db push`
- [ ] Run `supabase functions deploy`
- [ ] Get your project ref from function URLs
- [ ] Update `campaignTemplates.ts` with your project ref
- [ ] Update `CampaignAdminClient.tsx` 
- [ ] Update `campaigns.ts` service
- [ ] (Optional) Add wall tracking
- [ ] Test with one email
- [ ] Send to UBC professors & PSSA!

---

## 📚 Full Docs

- **Quick Start**: `TRACKING_DEPLOYMENT_QUICKSTART.md`
- **Step-by-Step**: `docs/DEPLOYMENT_TRACKING.md`
- **Implementation Details**: `docs/CAMPAIGN_TRACKING_IMPLEMENTATION.md`

---

## 🎉 You're Ready!

All the pieces are in place. Just need to:
1. Deploy functions (2 commands)
2. Update 4 code sections (copy-paste ready)
3. Test!

**Total time: ~15 minutes** ⚡

Questions? Check the deployment guide or implementation docs.
