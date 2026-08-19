# Campaign Tracking - Deployment Quick Start

## 🚀 One-Command Deploy

```bash
# Step 1: Run database migration
supabase db push

# Step 2: Deploy all functions
supabase functions deploy

# Done! ✅
```

---

## 📋 Verify Deployment

```bash
# Check migration applied
supabase db list-tables | grep tracking_events

# Check functions deployed
supabase functions list
```

Expected output:
```
track-email-open
track-link-click
track-wall-view
```

---

## 🔗 Get Your Function URLs

```bash
supabase functions list --json
```

You'll need these URLs for the next step. They look like:
```
https://YOUR-PROJECT-REF.supabase.co/functions/v1/track-email-open
https://YOUR-PROJECT-REF.supabase.co/functions/v1/track-link-click
https://YOUR-PROJECT-REF.supabase.co/functions/v1/track-wall-view
```

---

## 📝 Update Code

1. **Update `lib/utils/campaignTemplates.ts`**
   - Replace `YOUR-PROJECT-REF` with your actual Supabase project ref
   - See `docs/DEPLOYMENT_TRACKING.md` for full code

2. **Update `CampaignAdminClient.tsx`**
   - Add tracking token generation
   - Wrap HTML with tracking pixel
   - Rewrite links with click tracking
   - See `docs/DEPLOYMENT_TRACKING.md` for full code

3. **Update wall component**
   - Add wall view tracking on unmount
   - See `docs/DEPLOYMENT_TRACKING.md` for full code

---

## ✅ Test Tracking

1. Send a test email via `/admin/campaign`
2. Open the email → check `campaign_sends.opened_at`
3. Click a link → should redirect & increment `link_clicks`
4. Visit wall with `?t=TOKEN` → check `wall_visited` and duration

---

## 📊 View Tracking Data

**In Supabase Dashboard:**
```sql
-- View all tracking events
SELECT * FROM tracking_events ORDER BY occurred_at DESC;

-- View campaign send tracking
SELECT id, email, opened_at, opened_count, link_clicks, wall_visited 
FROM campaign_sends 
WHERE opened_at IS NOT NULL;

-- View click details
SELECT id, email, links_clicked FROM campaign_sends 
WHERE links_clicked IS NOT NULL;
```

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Migration fails | Run `supabase db push --dry-run` first |
| Functions don't deploy | Check `supabase status` |
| Tracking data not appearing | Verify function URLs are correct in code |
| Links not redirecting | Check browser console for 302 redirect |
| Wall tracking not working | Ensure `?t=TOKEN` is in wall URL |

---

## 📚 Full Documentation

See `docs/DEPLOYMENT_TRACKING.md` for complete step-by-step guide.

---

## 🎉 You're Done!

Campaign emails now have:
- ✅ Open tracking (with timestamp)
- ✅ Link click tracking (per link + count)
- ✅ Wall visit tracking (with duration)
- ✅ Engagement scoring (0-100)
- ✅ Detailed event logging

Start sending tracked campaigns! 🚀
