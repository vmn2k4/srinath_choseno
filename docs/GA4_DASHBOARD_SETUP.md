# Google Analytics dashboard setup

The `/admin/analytics` page has a "Live Traffic (Google Analytics)" section that
pulls real GA4 data via the [GA4 Data API](https://developers.google.com/analytics/devguides/reporting/data/v1).
This is a separate credential from the `G-LEEVBQ78R4` measurement ID used by
gtag.js (`src/lib/constants/analytics.ts`) — that ID is what *sends* events to
GA4; the service account below is what *reads* them back out.

Until the env vars below are set, the section shows a "not connected yet"
state and the rest of the admin page works normally.

## One-time Google Cloud setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) and select or create a project.
2. **APIs & Services → Library** → search "Google Analytics Data API" → **Enable**.
3. **APIs & Services → Credentials → Create Credentials → Service Account**. Any name works, e.g. `choseno-ga4-reader`. No IAM roles needed at the project level — access is granted at the GA4 property level in step 5.
4. Open the new service account → **Keys** tab → **Add Key → Create new key → JSON**. This downloads a JSON file with a `client_email` and `private_key`.
5. In [Google Analytics](https://analytics.google.com/) → **Admin → Property Access Management** (for the Choseno GA4 property) → **+ → Add users** → paste the service account's `client_email` → Role: **Viewer** → Add.
6. Note the **Property ID**: Admin → Property Settings → Property ID (a short numeric ID — not the `G-XXXXXXX` measurement ID, which is a different identifier).

## Env vars

Set these as server-only secrets (no `NEXT_PUBLIC_` prefix — they must never reach the browser) in `.env.local` and in Vercel's project settings:

```
GA4_PROPERTY_ID=123456789
GA4_SERVICE_ACCOUNT_EMAIL=choseno-ga4-reader@your-project.iam.gserviceaccount.com
GA4_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n"
```

The private key from the downloaded JSON has real `\n` characters; when
pasting it into an env var as a single-line string, keep it as the literal
two-character sequence `\n` (most `.env` tooling and Vercel's dashboard both
handle this) — `src/lib/analytics/ga4Reporting.ts` un-escapes it before use.

## Access control

`/api/admin/ga4` checks `profiles.role === 'admin'` for the requesting user
before calling GA4 (see the route handler for why this can't rely on RLS like
the rest of the app does — GA4 isn't Supabase). Non-admins and signed-out
requests get a 401/403 with no data.
