# Politician Claim Wall Campaign Automation

## Overview

Campaign automation is **ready to use** with zero new dependencies! The system integrates with your existing Supabase email infrastructure.

## What You Have

### ✅ Infrastructure Already in Place

1. **Supabase Edge Function** (`supabase/functions/send-email/`)
   - Sends emails via SMTP
   - Configured for SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD
   - Already deployed and tested

2. **Email Service Wrapper** (`src/lib/services/email.ts`)
   - `sendEmail()` - Direct email sending
   - `sendMarketingEmail()` - Marketing emails
   - `sendNotificationEmail()` - Notifications
   - All call the Supabase function

3. **Database Table** (`politician_claim_campaigns`)
   - Tracks all campaign sends
   - Stores claim tokens
   - Records open/click/claim events
   - Migration: `20260811_politician_claim_campaigns.sql`

4. **CSV Files Ready**
   - `scripts/bc-municipal-outreach.csv` (268 mayors/councillors)
   - `scripts/bc-civic-parties-contacts.csv` (20 parties)
   - Can use your own CSV with `name` and `email` columns

### ✅ New Script

**`scripts/send-politician-invites.ts`** - Campaign automation script

- Reads CSV files
- Validates email addresses
- Generates unique claim tokens (UUIDs)
- Sends personalized emails via Supabase function
- Saves to database
- Outputs results to JSON
- Rate-limited (1 sec between emails)

## How It Works

```
CSV File
   ↓
Script validates records
   ↓
Generate unique token for each person
   ↓
Create claim link: https://choseno.com/claim-wall?token=UUID&email=...
   ↓
Invoke Supabase function: send-email
   ↓
Save to politician_claim_campaigns table
   ↓
Output results.json
   ↓
Email arrives → Person clicks link → Token validates → Wall created
```

## Get Started

### Step 1: Verify Environment

Your `.env` or `.env.local` must have:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-key
NEXT_PUBLIC_SITE_URL=https://www.choseno.com
```

### Step 2: Run Test Campaign

Send to just 5 people first:

```bash
npm run send-invites:test
```

This creates a test CSV from the first 6 rows and runs the campaign. You'll see:

```
🚀 Starting Politician Wall Claim Invitation Campaign

📄 Reading CSV file: scripts/test.csv

📊 Found 5 records to process
✅ 5 valid records

[1/5] Sending to John Smith... ✅
[2/5] Sending to Jane Doe... ✅
[3/5] Sending to Bob Jones... ✅
[4/5] Sending to Alice Cooper... ✅
[5/5] Sending to Charlie Brown... ✅

============================================================
📈 CAMPAIGN SUMMARY
============================================================
✅ Successfully sent: 5
❌ Failed to send: 0
📊 Total processed: 5
============================================================

💾 Results saved to: campaign-results-2026-08-11.json
```

### Step 3: Send to BC Contacts

Once test works, send to real contacts:

```bash
# Send to all BC mayors & councillors (268 people)
npm run send-invites:mayors

# Send to all BC parties (20 people)
npm run send-invites:parties

# Or both
npm run send-invites:mayors && npm run send-invites:parties
```

### Step 4: Track Results

In Supabase dashboard, query:

```sql
-- Campaign statistics
SELECT * FROM politician_campaign_stats;

-- Specific campaign
SELECT politician_name, politician_email, status, sent_at, opened_at, claimed_at
FROM politician_claim_campaigns
WHERE campaign_name = 'BC Mayors & Councillors 2026'
ORDER BY sent_at DESC;
```

## npm Scripts

| Command | What It Does |
|---------|-------------|
| `npm run send-invites:test` | Test with 5 records |
| `npm run send-invites:mayors` | Send to BC mayors/councillors |
| `npm run send-invites:parties` | Send to BC parties |
| `npm run send-invites FILE "NAME"` | Custom CSV |

## Email Content

Recipients get:
- Personalized greeting with their first name
- "Your Political Wall is Ready" subject
- Button to claim wall
- Explanation of platform features
- Link to Choseno homepage
- Professional HTML design

The email template is in `scripts/send-politician-invites.ts` in the `generateEmailHtml()` function — edit it to customize.

## Results

After each campaign, a JSON file is created: `campaign-results-YYYY-MM-DD.json`

```json
[
  {
    "politician_name": "John Smith",
    "politician_email": "john@example.com",
    "claim_token": "550e8400-e29b-41d4-a716-446655440000",
    "claim_link": "https://www.choseno.com/claim-wall?token=...",
    "status": "sent",
    "sent_at": "2026-08-11T15:30:45.123Z"
  }
]
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Missing environment variables" | Check `.env` has SUPABASE_URL and SERVICE_ROLE_KEY |
| "Failed to send email" | Check SMTP credentials in Supabase settings |
| "DB error" | Ensure `politician_claim_campaigns` table exists |
| "Invalid email" | CSV has typos — check format (name@domain.com) |
| "File not found" | Use full path: `scripts/your-file.csv` |

## Next Steps

1. ✅ Run test: `npm run send-invites:test`
2. ✅ Check results: `campaign-results-*.json`
3. ✅ Query database: Check `politician_campaign_stats`
4. ✅ Send real campaign: `npm run send-invites:mayors`
5. ✅ Monitor: Track opens/claims in database

## Custom Campaigns

To send to your own CSV:

```bash
npx ts-node scripts/send-politician-invites.ts path/to/your-file.csv "Campaign Name"
```

CSV should have at minimum: `name`, `email`

Optional: `role`, `city`, `party`, `constituency`, etc. (stored in results but not sent in email)

## Key Files

| File | Purpose |
|------|---------|
| `scripts/send-politician-invites.ts` | Campaign automation script |
| `docs/POLITICIAN_INVITES_GUIDE.md` | Full documentation |
| `supabase/functions/send-email/` | Email sending function |
| `src/lib/services/email.ts` | Email service wrapper |
| `supabase/migrations/20260811_politician_claim_campaigns.sql` | Database table |
| `scripts/bc-municipal-outreach.csv` | BC mayors & councillors list |
| `scripts/bc-civic-parties-contacts.csv` | BC parties list |

## Architecture Diagram

```
┌─────────────────┐
│  CSV File       │
│  (name, email)  │
└────────┬────────┘
         │
         ↓
┌─────────────────────────────────────┐
│  send-politician-invites.ts         │
│  - Validate emails                  │
│  - Generate claim tokens            │
│  - Build claim links                │
└────────┬────────────────────────────┘
         │
         ├─→ Supabase Function (send-email)  →  SMTP  →  Email
         │
         └─→ Supabase Table (politician_claim_campaigns)  →  Database
         
         Results  →  campaign-results-YYYY-MM-DD.json
```

## Status

**✅ Ready for Production**

- No external dependencies needed
- Uses existing Supabase infrastructure
- Integrated with existing email service
- Database table and indexes ready
- Test CSV files available
- npm scripts configured

---

**Last Updated:** 2026-08-11  
**Location:** Choseno codebase  
**Maintainer:** Campaign automation system
