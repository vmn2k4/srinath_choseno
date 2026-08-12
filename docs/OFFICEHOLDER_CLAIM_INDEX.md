# Officeholder Wall Claim System — Documentation Index

**Status**: ✅ Production-ready (2026-08-12)

Complete documentation for the officeholder wall claim, merge, and reversal system. Start with the link that matches your role or task.

## For Developers

### Understanding the System

1. **[OFFICEHOLDER_WALL_CLAIM_AND_MERGE.md](OFFICEHOLDER_WALL_CLAIM_AND_MERGE.md)** — Design spec and implementation guide
   - Purpose and design decisions
   - Complete data model and schema
   - All RPCs with signatures and behavior
   - Admin-initiated vs self-requested flows
   - Auto-merge feature (2026-08-12)
   - Edge cases and fallback handling
   - Live verification evidence

### Testing

2. **[TESTING_OFFICEHOLDER_CLAIMS.md](TESTING_OFFICEHOLDER_CLAIMS.md)** — Practical testing guide with curl examples
   - Environment setup (API keys, credentials)
   - Database connection (psql)
   - Mailsac inbox access (viewing emails)
   - **Test Flow 1**: Admin invite → auto-merge (7 steps)
   - **Test Flow 2**: Self-requested claim (4 steps)
   - **Test Flow 3**: Verify merged state
   - **Test Flow 4**: Auto-merge fallback (edge case)
   - **Test Flow 5**: Reverse an approved claim
   - Common query patterns (find claims, count by status, etc.)
   - Browser testing URLs
   - Troubleshooting

3. **[TEST_ACCOUNTS.md](TEST_ACCOUNTS.md)** — Reusable test account setup
   - Three mailsac disposable-inbox accounts
   - Why mailsac (no signup, read publicly)
   - How to read mailsac inboxes (UI and API)
   - How to reset a test account password (via Auth Admin API)
   - How to call admin-only RPCs from a script
   - Current test account state (chosenovoter3 already claimed David Eby's wall)

4. **[TEST_RESULTS_AUTO_MERGE.md](TEST_RESULTS_AUTO_MERGE.md)** — Auto-merge verification results (2026-08-12)
   - Feature summary
   - Test execution details (setup, steps, results)
   - RPC authorization and fallback handling
   - Client-side messaging updates
   - Database changes (new helper, updated RPCs)
   - Migration script info
   - Edge cases tested
   - Performance and compatibility analysis

## For Admins / Non-Technical Users

### How to Use (UI)

The admin panel is at **`/admin/office-holders`**. It has two tabs:

**Send Invite Tab:**
1. Enter the wall URL (e.g., `https://www.choseno.com/wall/david-eby-premier`)
2. Enter the email to invite
3. Click "Send Invite"
4. Email sent automatically via `send-officeholder-claim` edge function
5. Recipient receives invite with link to claim

**Invitation History Tab:**
- Shows all invites for the wall
- Status badges: Pending, Review (ready to merge), Claimed, Reversed
- Actions:
  - **Pending/Expired**: Resend or Cancel
  - **Review**: Merge (claim auto-merged on redemption) or Reverse
  - **Claimed**: View merged wall or reverse if error
  - **Rejected/Reversed**: View details

### Understanding Claim States

| Status | Meaning | What Happens Next |
|--------|---------|------------------|
| **invited** | Admin sent invite, waiting for recipient to redeem | Recipient clicks link in email |
| **pending_review** | Recipient redeemed OR self-service claim submitted | Admin reviews, then merges or rejects |
| **approved** | Claim merged — wall ownership transferred | Wall now belongs to claimant; old URL redirects |
| **rejected** | Admin rejected (self-requested claim) | Profile fields nulled; claimant keeps account |
| **reversed** | Admin reversed merged claim | Wall restored to original owner; all posts/ratings restored |
| **expired** | Invite link expired (7 days) | Resend a new invite |

### Auto-Merge Behavior (New in 2026-08-12)

**Admin-initiated invites now auto-merge on redemption** — no manual approve step needed.

- Admin sends invite to officeholder's email
- Officeholder redeems link → signs in (new account or existing)
- Wall **automatically transfers** to their account
- Receiver sees "Wall claimed — now yours" message
- Old wall URL redirects to new wall
- If auto-merge fails (rare): claim stays in "Review" for manual merge

**Self-requested claims still require manual review** (no auto-merge):
- Citizen goes to officeholder wall, clicks "Claim This Wall"
- Lands in pending_review, awaiting admin approval
- Admin reviews contact info and notes, then merges or rejects

## Key Data Models

### office_holder_wall_claims

Central table tracking every claim. Statuses:
- `invited` → `pending_review` → `approved` (normal flow)
- `invited` → `expired` (auto-expire after 7 days)
- `pending_review` → `rejected` (admin rejects self-request)
- `approved` → `reversed` (admin reverses in error)

### office_holder_wall_claim_invites

One-time tokens for email-based invites. Fields:
- `token_hash`: SHA-256 hash of plaintext token (never stored plaintext)
- `used_at`: When token was redeemed (NULL = unused)
- `expires_at`: 7 days by default

### office_holder_wall_claim_items

Audit trail: what was moved in this claim. Tracks:
- Posts, comments, supporters, ratings, news tags, election candidates
- Source and target values (which ghost_id, which politician_id, etc.)
- Whether each item was moved or just profile data
- When item was reversed (if claim was later reversed)

### office_holder_wall_redirects

Persists old URL → new URL mapping after claim merges. Allows:
- Old wall URL (`/wall/david-eby-premier`) → new wall (`/wall/user-premier`)
- Search engines to follow redirects (not hard 404s)

## Key RPCs (Supabase Functions)

**Admin-only:**
- `create_officeholder_wall_claim(office_holder_id, email, token_hash)` — Create invite
- `merge_officeholder_wall_claim(claim_id)` — Approve and move wall
- `reject_officeholder_wall_claim(claim_id, reason)` — Reject self-request
- `reverse_officeholder_wall_claim(claim_id, reason)` — Undo merge
- `preview_officeholder_wall_claim(claim_id)` — See what will be moved before merge
- `cancel_officeholder_wall_claim(claim_id)` — Cancel invite before it's redeemed
- `resend_officeholder_wall_claim(claim_id, email)` — Send new email for existing invite

**Authenticated (claimant only):**
- `redeem_officeholder_wall_claim(token_hash)` — Redeem invite (auto-merges if admin-initiated)

**Authenticated (any citizen):**
- `request_officeholder_wall_claim(office_holder_id, contact_email, note)` — Self-request

**Public (logged out OK):**
- `get_wall_claim_eligibility(profile_id)` — Check if wall is claimable (routes to right claim form)
- `list_pending_self_requested_officeholder_claims()` — List all pending self-requests (admin-only inside)

## Email Handling

### Authentication Hooks

Supabase Auth invokes `auth-send-email` edge function for every email (signup confirm, password reset, invite, etc.):

- Location: `supabase/functions/auth-send-email/index.ts`
- Verifies Standard Webhooks signature with `SEND_EMAIL_HOOK_SECRET`
- Dispatches to `send-email` function via SMTP

### Officeholder Claim Invite Emails

Officeholder claim invite emails are sent via `send-officeholder-claim` edge function:

- Location: `supabase/functions/send-officeholder-claim/index.ts`
- Triggered from admin UI's "Send Invite" button
- Constructs dual-link chooser (sign up vs log in)
- Both links include `next=/officeholder-claim/{token}` for post-auth redirect
- Token link is single-use, 7-day expiry

## Architecture Decisions

### Why Auto-Merge for Admin-Initiated Claims?

Admin creates invite → Admin has already decided this person owns the wall. The invite email proves the recipient controls that email address. Nothing new is being verified at a second "merge" step. The redundant gate was removed to speed up the flow and reduce admin overhead.

### Why NOT Auto-Merge for Self-Requested Claims?

No admin involvement when the claim is created → No vetting yet. Could be impersonation. A human must review contact info and notes before approving. Intentionally kept manual.

### Why Store Token Hash, Not Plaintext?

Tokens are sent over email (a semi-public transport). If the database is ever breached, plaintext tokens in the DB would be compromised. SHA-256 hashing provides defense in depth (even though the token is exposed in email, we don't store it plaintext).

### Why Wall Slug Instead of GhostID?

Public URLs should be human-readable and stable. Wall slugs (`/wall/david-eby-premier`) are more SEO-friendly and memorable than ghost IDs. Old slugs are preserved via `office_holder_wall_redirects` after merge.

## Related Systems

- **Election Candidate Claims**: Separate, older system for claiming unregistered candidacy stubs. Not unified with officeholder claims (different trust models: seat admin for candidates, site admin for officeholders).
- **Profile Roles**: politician role required to own a wall. Signup-time redemption auto-promotes citizen → politician.
- **Ghost IDs**: Anonymous wall identity for posting/rating. Preserved through merges (see `office_holder_wall_claim_items` tracking).
- **Supabase Auth**: Email-based, with custom hook for sending emails via Titan SMTP (not Supabase's built-in SMTP).

## Troubleshooting

### Common Issues

**Q: "Duplicate key value violates unique constraint office_holder_wall_claims_one_open_claim_idx"**

A: The officeholder already has an open or approved claim. Cancel it first:
```bash
curl -X POST "$SUPABASE_URL/rest/v1/rpc/cancel_officeholder_wall_claim" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{\"p_claim_id\": \"<claim_id>\"}"
```

**Q: "admin accounts cannot claim an officeholder wall"**

A: Admin accounts (role='admin') can't claim walls. Log out, then log back in as a non-admin user, or use a separate test account.

**Q: Invite email never arrives**

A: Check:
- Email rate limit (was 30/hr, should be ≥2000/hr)
- `send-officeholder-claim` function deployed and has SMTP credentials
- Recipient email is valid (if using mailsac, check [mailsac.com/inbox/](https://mailsac.com/inbox/))
- Function logs: `supabase functions logs send-officeholder-claim --project-ref <ref>`

**Q: Token keeps getting rejected ("invalid, used, cancelled, or expired")**

A: Token is one-time use. Check if it was already redeemed (`used_at` set in `office_holder_wall_claim_invites`). Generate a fresh token and send a new invite.

## Resources

- **Supabase CLI**: `supabase functions deploy` / `supabase db push` / `supabase functions logs`
- **Management API**: Raised rate limits, configured email hooks
- **Mailsac**: https://mailsac.com (free, disposable inboxes)
- **Git**: Migration files in `supabase/migrations/2026081*_officeholder_*.sql`
- **Code**: 
  - RPCs: `supabase/migrations/`
  - Functions: `supabase/functions/auth-send-email/`, `supabase/functions/send-officeholder-claim/`
  - UI: `src/components/features/OfficeHoldersAdminClient.tsx`, `src/components/features/InvitationHistoryPanel.tsx`, `src/components/features/OfficeholderClaimClient.tsx`
  - Services: `src/lib/services/elections.ts` (client API calls)

## Version History

- **2026-08-12**: ✅ Auto-merge for admin-initiated invites (migration 20260811210000)
- **2026-08-11**: ✅ Unified officeholder and politician wall claim eligibility (migration 20260811170000)
- **2026-08-11**: ✅ Claim rejection for pending_review (migration 20260811200000)
- **2026-08-11**: ✅ Signup-time profile prefill (migration 20260811160000)
- **2026-08-11**: ✅ Admin invite creation + dual-link signup (migrations 20260811090000+)
- **2026-08-05**: ✅ Foundation (migrations 20260811082341, 20260811100000)
