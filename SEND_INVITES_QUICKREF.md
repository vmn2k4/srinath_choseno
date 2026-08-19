# Send Politician Invites - Quick Reference

> **For Mayor/Councillor outreach with the professional HTML templates, use `/admin/campaign` in the admin panel instead — see [OUTREACH_GUIDE.md](OUTREACH_GUIDE.md) §4.** This CLI script sends a different, generic email template, not the Mayor/Councillor HTML designs.

## TL;DR

```bash
# Test with 5 records
npm run send-invites:test

# Send to BC mayors & councillors (268 people)
npm run send-invites:mayors

# Send to BC parties (20 people)
npm run send-invites:parties

# Custom CSV
npm run send-invites your-file.csv "Campaign Name"
```

## Setup (One Time)

1. **Check environment variables** (`.env` or `.env.local`):
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://...supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-key
   NEXT_PUBLIC_SITE_URL=https://www.choseno.com
   ```

2. **Verify database table** exists:
   ```bash
   # In Supabase dashboard SQL Editor
   SELECT table_name FROM information_schema.tables 
   WHERE table_name = 'politician_claim_campaigns';
   ```

## Running Campaigns

### Option 1: Built-in Lists

```bash
# Test run (5 records)
npm run send-invites:test

# BC mayors & councillors (268 records)
npm run send-invites:mayors

# BC civic parties (20 records)
npm run send-invites:parties
```

### Option 2: Custom CSV

```bash
npm run send-invites path/to/file.csv "Campaign Name"
```

CSV needs: `name`, `email` (minimum)

## What Happens

1. Script reads CSV
2. Validates emails
3. Generates unique token for each person
4. Sends personalized email
5. Saves to database
6. Creates `campaign-results-YYYY-MM-DD.json`

## Monitor Results

### View in Database

```sql
-- All stats
SELECT * FROM politician_campaign_stats;

-- Specific campaign
SELECT politician_name, politician_email, status, sent_at
FROM politician_claim_campaigns
WHERE campaign_name = 'BC Mayors & Councillors 2026'
ORDER BY sent_at DESC;
```

### Check Results File

```bash
cat campaign-results-2026-08-11.json | jq '.[0:5]'
```

## Retry Failed Emails

```bash
# View failed
cat campaign-results-*.json | jq '.[] | select(.status=="failed")'

# Extract failed emails to retry.csv and re-run
npm run send-invites retry.csv "Retry Wave 1"
```

## Timing

- **Rate:** 1 email per second (to avoid spam flags)
- **BC Mayors (268):** ~4.5 minutes
- **BC Parties (20):** ~20 seconds
- **Test (5):** ~5 seconds

## Troubleshooting

| Error | Fix |
|-------|-----|
| "Missing environment variables" | Update `.env` |
| "Failed to send email" | Check SMTP config in Supabase |
| "DB error" | Ensure table exists |
| "Invalid email" | Check CSV format |
| "File not found" | Use full path |

## Email Content

**Subject:** Your Political Wall is Ready on Choseno

**Includes:**
- Personalized greeting
- Unique claim link
- Platform explanation
- Call-to-action button
- Choseno homepage link

To edit: See `generateEmailHtml()` in `scripts/send-politician-invites.ts`

## Files

| File | Purpose |
|------|---------|
| `scripts/send-politician-invites.ts` | Campaign script |
| `docs/POLITICIAN_INVITES_GUIDE.md` | Full guide |
| `docs/CAMPAIGN_AUTOMATION_SUMMARY.md` | Architecture overview |
| `scripts/bc-municipal-outreach.csv` | BC mayors/councillors |
| `scripts/bc-civic-parties-contacts.csv` | BC parties |

## Documentation

- **Full Guide:** [POLITICIAN_INVITES_GUIDE.md](docs/POLITICIAN_INVITES_GUIDE.md)
- **Architecture:** [CAMPAIGN_AUTOMATION_SUMMARY.md](docs/CAMPAIGN_AUTOMATION_SUMMARY.md)

---

**Status:** ✅ Ready to use  
**No new dependencies required**  
**Uses existing Supabase infrastructure**
