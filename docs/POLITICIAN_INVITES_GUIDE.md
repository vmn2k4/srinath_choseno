# Politician Wall Invitations

Send personalized claim wall invitations to politicians via CSV using the existing Supabase email infrastructure.

## Quick Start

### 1. Setup

Ensure these environment variables are set in `.env` or `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=https://www.choseno.com
```

### 2. Create CSV

Create a CSV file with politician data. Required columns:
- `name` - Full name
- `email` - Email address

Optional columns:
- `role` - Their position (Mayor, Councillor, etc.)
- `city` - City/municipality

Example:
```csv
name,email,role,city
John Smith,john@example.com,Mayor,Vancouver
Jane Doe,jane@example.com,Councillor,Burnaby
```

### 3. Run Campaign

**Option A: Using npm scripts (easier)**

```bash
# Test run with first 5 records
npm run send-invites:test

# Send to all BC mayors & councillors
npm run send-invites:mayors

# Send to all BC civic parties
npm run send-invites:parties

# Custom CSV
npm run send-invites your-file.csv "Campaign Name"
```

**Option B: Direct ts-node**

```bash
npx ts-node scripts/send-politician-invites.ts your-file.csv "Campaign Name"
```

**Examples:**

```bash
# BC mayors & councillors
npx ts-node scripts/send-politician-invites.ts scripts/bc-municipal-outreach.csv "BC Mayors 2026"

# BC parties
npx ts-node scripts/send-politician-invites.ts scripts/bc-civic-parties-contacts.csv "BC Parties 2026"

# Custom CSV with campaign name
npx ts-node scripts/send-politician-invites.ts your-file.csv "Your Campaign Name"
```

## What Happens

✅ Script reads CSV file  
✅ Validates email addresses  
✅ Generates unique claim token for each person  
✅ Sends personalized HTML email via Supabase Edge Function  
✅ Saves campaign record to database  
✅ Outputs results to JSON file  
✅ 1-second delay between emails to prevent spam flagging

## Output

The script generates a `campaign-results-YYYY-MM-DD.json` file with:

```json
[
  {
    "politician_name": "John Smith",
    "politician_email": "john@example.com",
    "claim_token": "550e8400-e29b-41d4-a716-446655440000",
    "claim_link": "https://www.choseno.com/claim-wall?token=550e8400-e29b-41d4-a716-446655440000&email=john%40example.com",
    "status": "sent",
    "sent_at": "2026-08-11T15:30:45.123Z"
  }
]
```

## Track Results

### View in Supabase

```sql
-- All campaigns
SELECT * FROM politician_campaign_stats;

-- Specific campaign
SELECT politician_name, politician_email, status, sent_at, opened_at, claimed_at
FROM politician_claim_campaigns
WHERE campaign_name = 'BC Mayors 2026'
ORDER BY sent_at DESC;

-- Only failed sends
SELECT * FROM politician_claim_campaigns
WHERE status = 'failed'
ORDER BY sent_at DESC;
```

## Email Template

The email includes:
- Personalized greeting
- Call-to-action button to claim wall
- Explanation of platform features
- Link to Choseno homepage
- Professional HTML design

To customize the email template, edit the `generateEmailHtml()` function in `scripts/send-politician-invites.ts`.

## Error Handling

The script validates each record before sending:
- ✅ Checks email format
- ✅ Requires name field
- ✅ Reports validation errors
- ✅ Continues after failures

Failed emails are logged in the results JSON for manual retry.

### Retry Failed Emails

```bash
# View failed records
cat campaign-results-2026-08-11.json | jq '.[] | select(.status=="failed")'

# Create CSV from failed emails and retry
npx ts-node scripts/send-politician-invites.ts retry.csv "Retry Wave 1"
```

## Database Schema

Uses existing `politician_claim_campaigns` table:

```sql
CREATE TABLE politician_claim_campaigns (
  id UUID PRIMARY KEY,
  politician_name TEXT NOT NULL,
  politician_email TEXT NOT NULL,
  claim_token UUID NOT NULL UNIQUE,
  claim_link TEXT NOT NULL,
  campaign_name TEXT,
  status TEXT CHECK (status IN ('pending', 'sent', 'failed', 'opened', 'claimed')),
  sent_at TIMESTAMP DEFAULT NOW(),
  opened_at TIMESTAMP,
  claimed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## How It Works

1. **Script reads CSV** and validates records
2. **Generates claim token** - UUID for one-time use
3. **Creates claim link** - `https://choseno.com/claim-wall?token=...&email=...`
4. **Sends email** - Invokes `send-email` Supabase Edge Function
5. **Saves to DB** - Records campaign record with token and link
6. **Outputs results** - JSON file with all attempts (sent/failed)

When politician clicks link:
1. Lands on `/claim-wall` page with token
2. Claim page validates token and creates wall
3. Token is marked as 'claimed' in database

## Dependencies

✅ **No new dependencies required!** The script uses:
- Supabase Edge Functions (`send-email`) — already deployed
- Database table (`politician_claim_campaigns`) — migration exists
- Node.js built-in `readline` — no external CSV library needed
- Supabase client — already in `package.json`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Missing environment variables" | Check `.env` has SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY |
| "CSV file not found" | Provide full path: `scripts/politicians.csv` |
| "Invalid email format" | Check email addresses in CSV (must have @domain.com) |
| "Email send failed" | Verify SMTP/Supabase email config is working |
| "DB error" | Check if `politician_claim_campaigns` table exists |

## Best Practices

1. **Test first** - Run with small subset (5-10 records)
2. **Warm-up** - Start with 20-30, wait for opens/claims, then scale
3. **Stagger sends** - Don't send all at once (1 sec delay helps)
4. **Monitor bounces** - Check email provider for delivery issues
5. **Track results** - Use database queries to monitor engagement

## Links

- **Claim page**: `/claim-wall?token=UUID&email=EMAIL`
- **Database table**: `politician_claim_campaigns`
- **Analytics view**: `politician_campaign_stats`
- **Email function**: `supabase/functions/send-email/index.ts`

---

**Status**: ✅ Production Ready  
**Last Updated**: 2026-08-11
