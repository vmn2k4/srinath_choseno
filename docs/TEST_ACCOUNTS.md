# Test Accounts (Mailsac disposable inboxes)

Reusable test accounts for exercising auth/email/claim flows against the
local dev server without burning real inboxes. Credentials live in
`.env.local` (gitignored) under `mailsac_voter1_*` / `mailsac_voter2_*` /
`mailsac_voter3_*` — not duplicated here since this file is checked in.

## What these are

Three accounts on the free [mailsac.com](https://mailsac.com) disposable-email
service: `chosenovoter1@mailsac.com`, `chosenovoter2@mailsac.com`,
`chosenovoter3@mailsac.com`. Mailsac needs no signup/password to use — any
inbox at `mailsac.com/inbox/<address>` is publicly viewable by anyone who
knows the address, which is exactly what makes it convenient for this and
also why nothing sensitive should ever be sent there.

All three already exist as real Supabase Auth users in the dev project
(`qlzyfdwrkcxyqapewxwg`), email-confirmed, with a known password set via the
Auth Admin API (see below) — so you can log in through the normal `/auth`
UI immediately, no signup/confirmation round-trip needed.

## Reading mail sent to a mailsac address

- UI: `https://mailsac.com/inbox/<address>`
- API (no auth needed for a public inbox):
  `https://mailsac.com/api/addresses/<address>/messages` — returns JSON
  including a `links` array per message with any URLs found in the body
  (e.g. the officeholder-claim token link or the Supabase email-confirm
  link), which is the fastest way to grab a link programmatically instead
  of clicking through the UI.

## Setting/resetting a test account's password

The signup flow's own "forgot password" isn't wired up in the UI
(`AuthPageClient.tsx` has no reset-password link), so the reliable way to
gain access to one of these accounts — or any test account whose password
is unknown — is the Supabase Auth Admin API with the project's
`service_role` key:

```bash
# Get the service_role key for the linked project:
supabase projects api-keys --project-ref qlzyfdwrkcxyqapewxwg

# Look up a user by email:
curl -s "https://qlzyfdwrkcxyqapewxwg.supabase.co/auth/v1/admin/users?email=<address>" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY"

# Set a known password (and/or force email_confirm) by user id:
curl -s -X PUT "https://qlzyfdwrkcxyqapewxwg.supabase.co/auth/v1/admin/users/<user_id>" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"password":"<new password>","email_confirm":true}'
```

The service_role key is a live secret — fetch it fresh via the CLI each
time rather than pasting it into a file that could get committed.

## Calling admin-only RPCs from a script (bypassing a UI confirm() dialog)

Some admin actions in the UI go through a native `window.confirm()` (e.g.
"Merge wall" in the Office Holders admin panel) that headless/automated
browser sessions silently dismiss. When that blocks you, call the RPC
directly instead of the button — but note most of these RPCs check
`auth.uid()` against `profiles.role = 'admin'` internally
(`SECURITY DEFINER`), so a service_role JWT alone won't pass — you need an
actual admin user's access token:

```bash
ADMIN_TOKEN=$(curl -s -X POST "https://qlzyfdwrkcxyqapewxwg.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"<admin email>","password":"<admin password>"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -s -X POST "https://qlzyfdwrkcxyqapewxwg.supabase.co/rest/v1/rpc/<function_name>" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -d '{"p_claim_id":"<uuid>"}'
```

## Known state as of 2026-08-11

`chosenovoter3@mailsac.com` claimed and was merged into David Eby's
officeholder wall end-to-end (admin invite → email → redeem → admin merge,
full flow documented in
[OFFICEHOLDER_WALL_CLAIM_AND_MERGE.md](OFFICEHOLDER_WALL_CLAIM_AND_MERGE.md)).
That account now owns `/wall/user-premier` (role `politician`, Premier of
British Columbia). The old `/wall/david-eby-premier` URL redirects there.
`chosenovoter1`/`chosenovoter2` are unclaimed, plain `citizen`-role accounts
— good starting points for a fresh claim/invite test without cleanup.
