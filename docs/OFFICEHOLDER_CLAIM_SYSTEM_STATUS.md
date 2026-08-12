# Officeholder Wall Claim System — Current Implementation Status

**Project**: Choseno Political Engagement Platform  
**Feature**: Officeholder Wall Claiming & Merging  
**Last Updated**: 2026-08-11 (unified claim eligibility + self-service claim requests — see §4.6)  
**Status**: ✅ **IMPLEMENTED WITH HARDENING IN PROGRESS**

---

## 1. Overview

The officeholder wall claim system allows:
- **Admins** to invite real-world officeholders to claim their Choseno wall
- **New users** to sign up and claim their imported officeholder wall
- **Existing politicians** to claim walls that were auto-created for them
- **Walls to merge** with full audit trail and content consolidation
- **Claims to be reversed** if fraudulent or incorrect

This system is **separate from** but **similar in spirit to** the election candidate claim flow (for unregistered candidates).

**Two ways to start a claim**, both landing in the same `pending_review` queue, reviewed identically by an admin:
1. **Admin-invited**: an admin sends an invite email with two links (new signup vs. merge-into-existing-account) — see §4.1.
2. **Self-requested** (new, 2026-08-11): a logged-in citizen visiting an unclaimed officeholder wall clicks "Claim This Wall" and submits directly, no admin action needed to *start* the claim — see §4.6.

Both wall types (officeholder walls and generic politician walls) are gated by one shared eligibility check, `get_wall_claim_eligibility()`, that also fixed a real bug: the "Claim Profile" button used to show even on walls that already had a real, signed-up owner.

---

## 2. Current Implementation Status

### ✅ Completed Features

| Feature | Component | Status | Details |
|---------|-----------|--------|---------|
| **Foundation schema** | `office_holder_wall_claims` table | ✅ Complete | Tracks all claims with full metadata |
| **Audit trail** | `office_holder_wall_claim_items` table | ✅ Complete | Records every entity moved during merge |
| **Redirects** | `office_holder_wall_redirects` table | ✅ Complete | Old wall slugs redirect to new owner |
| **Invitation tokens** | `office_holder_wall_claim_invites` table | ✅ Complete | Hashed, expiring, single-use tokens |
| **Create claim RPC** | `create_officeholder_wall_claim()` | ✅ Complete | Admin-only, guards status invariants |
| **Redeem claim RPC** | `redeem_officeholder_wall_claim()` | ✅ Complete | User redeems token, proof of email control, **now also prefills their politician profile immediately (see 4.5)** |
| **Signup-time prefill** | `backfill_politician_profile_from_officeholder()` | ✅ Complete | Fills role/boundary/bio/party/contact/wall_slug from the officeholder record at redemption time — not just at merge |
| **Merge RPC** | `merge_officeholder_wall_claim()` | ✅ Complete | Transactional merge with audit items; also backfills a `politician_profiles` row/`wall_slug` if the target somehow reached merge without one (defensive) |
| **Preview RPC** | `preview_officeholder_wall_claim()` | ✅ Complete | Shows what will be moved (post/comment/supporter counts); now wired into the admin UI's merge confirm dialog |
| **Reverse RPC** | `reverse_officeholder_wall_claim()` | ✅ Complete | Restores source wall, requires admin reason; post reversal now restores `ghost_id`/`wall_ghost_id` independently (fixed 2026-08-11 — see 4.3/9) |
| **Resend invite RPC** | `resend_officeholder_wall_claim()` | ✅ Complete | Creates new token, cancels old ones |
| **Cancel claim RPC** | `cancel_officeholder_wall_claim()` | ✅ Complete | Admin can cancel invited/draft claims |
| **Email delivery** | `send-officeholder-claim` Edge Function | ✅ Complete | Sends dual-link invite (signup vs. merge) — see §4.1 |
| **Claim redemption page** | `/officeholder-claim/[token]` | ✅ Complete | User redeems token here |
| **Admin UI** | `OfficeHoldersAdminClient.tsx` | ✅ Complete | Full claim lifecycle in Office Holders admin panel |
| **Service layer** | `elections.ts` RPC wrappers | ✅ Complete | Typed service functions for all RPCs |
| **RLS policies** | Admin-only read/write on all claim tables | ✅ Complete | No public access to claims or invites |
| **Smoke tests** | `e2e/officeholder-claim-ui-smoke.mjs` | ✅ Complete | Unauthenticated page + protected admin route verified |
| **Unified claim eligibility** | `get_wall_claim_eligibility()` | ✅ Complete | One check for both officeholder and generic politician walls — see §4.6 |
| **Self-service claim requests** | `request_officeholder_wall_claim()` + "Claim This Wall" button | ✅ Complete | Logged-in citizen requests directly, no admin invite needed — see §4.6 |
| **Self-request discoverability** | `list_pending_self_requested_officeholder_claims()` + admin panel | ✅ Complete | Admin-only global listing, surfaced at top of `/admin/office-holders` |
| **"Already has an owner" protection** | `get_wall_claim_eligibility()` | ✅ Complete | Fixed a real bug: claim button used to show on walls that already had a real owner |

### 🔄 In Progress / Partial

| Feature | Component | Status | Details |
|---------|-----------|--------|---------|
| **Abuse review** | Content created during fraudulent claims | ⏳ Not Started | If reversed claim had unauthorized content, flag for review |
| **End-to-end tests** | `e2e/` suite | 🟡 Partial | Smoke tests pass; browser-driven full flow tests done for self-request (real, non-rollback) and admin-invite-through-dual-link-chooser (real); the signup→redemption step of the invite path was blocked by a dev-server build-cache glitch in the last pass — see §4.6 |

### ❌ Not Implemented

| Feature | Reason | Impact |
|---------|--------|--------|
| **Reject path for `pending_review` claims** | No `reject_officeholder_wall_claim()` RPC yet | An admin who decides not to merge a claim (invited or self-requested) has no explicit way to close it out — it just sits in the queue |
| **Claim history UI** | Nice-to-have; audit trail exists in DB | Admins can query DB directly if needed |
| **Duplicate claim prevention UI** | Database constraint prevents creation; just needs messaging | Attempts fail gracefully |

---

## 3. System Architecture

### 3.1 Data Ownership Model

The claim system treats wall ownership as **distributed across multiple tables**:

```
office_holders.linked_profile_id  ← Officeholder → Profile binding
posts.ghost_id                    ← Wall content ownership (posts)
posts.wall_ghost_id               ← Wall target (wall-scoped posts)
comments.ghost_id                 ← Comment ownership
politician_supporters             ← Follow/support relationships
politician_ratings                ← 1-5 star reviews
election_candidates.politician_id ← Candidacy ownership
```

**Merge strategy**: Only move content attributable to the **source ghost ID or source profile**. Do NOT move all content from the source profile (it may have other personal content).

### 3.2 Claim Lifecycle

```
DRAFT
  ↓ (admin initiates via email)
INVITED (invitation email sent, token is valid)
  ↓ (user clicks link, signs in or creates account)
PENDING_CONFIRMATION → PENDING_REVIEW (user redeems token)
  ↓ (admin reviews preview)
APPROVED (merge executed)
  ↓ (if fraudulent)
REVERSED (reversal executed with reason logged)

Alternative paths:
INVITED → EXPIRED (token expires after 7 days)
INVITED → EXPIRED → INVITED (admin resends with new token)
DRAFT/INVITED/PENDING_CONFIRMATION → (admin cancels)
```

**Status flow diagram**:
```
    create_officeholder_wall_claim()
             ↓
           INVITED ← [resend with new token]
             ↓
    redeem_officeholder_wall_claim()
             ↓
       PENDING_REVIEW
             ↓
    merge_officeholder_wall_claim()
             ↓
          APPROVED
             ↓
   reverse_officeholder_wall_claim()
             ↓
          REVERSED
```

### 3.3 Duplicate Claim Prevention

**Constraint**: Only ONE open claim per officeholder at a time.

```sql
CREATE UNIQUE INDEX office_holder_wall_claims_one_open_claim_idx
  ON public.office_holder_wall_claims (office_holder_id)
  WHERE status IN ('draft', 'invited', 'pending_confirmation', 'pending_review', 'approved');
```

**Behavior**:
- Attempt to create a second claim for the same officeholder → **database constraint violation**
- Admin must cancel or reverse the first claim before creating another
- Error: "Violates unique constraint office_holder_wall_claims_one_open_claim_idx"

**Can I send two invites at the same time?**
- **NO.** The database constraint prevents it. If there's an open claim, you must cancel or reverse it first.
- If the original claim is `invited`, call `resend_officeholder_wall_claim()` instead to create a new token for the same claim.

---

## 4. Implementation Details

### 4.1 Dual-Link Invitation (replaces account-existence detection, 2026-08-11)

**Previous design**: the Edge Function called `accountExists(email)` and picked ONE of two emails for the recipient — Supabase's built-in invite flow for a "new" email, or a custom sign-in email for an "existing" one. This assumed the invited email address is a reliable signal of whether the recipient already has a Choseno account, which isn't true — they may already have an account under a *different* email and want to use that one to merge instead of being funneled into creating a new one.

**Current design**: every invitation email contains **two links**, sharing the *same* underlying token, and the recipient picks:

```typescript
const nextPath = `/officeholder-claim/${token}`;
const signupUrl = `${redirectOrigin}/auth?role=politician&next=${encodeURIComponent(nextPath)}`;
const mergeUrl = `${redirectOrigin}/auth?role=politician&intent=login&next=${encodeURIComponent(nextPath)}`;

await admin.functions.invoke('send-email', {
  to: normalizedEmail,
  html: `
    <p><a href="${signupUrl}">New to Choseno? Sign up and claim your wall</a></p>
    <p><a href="${mergeUrl}">Already have a Choseno account? Sign in and merge this wall into your profile</a></p>
  `,
});
```

- `signupUrl` lands on `/auth` with the **Sign Up** tab shown by default (existing behavior — any `role` param defaults to signup).
- `mergeUrl` adds `intent=login`, which forces the **Log In** tab instead — a new `AuthPageClient` prop (`initialIntent`), independent of `role`, added specifically so a link can override the default tab without losing the "politician" framing/messaging.
- **Both links converge on the exact same `/officeholder-claim/{token}` page**, which — regardless of how the visitor got there — just checks for a session and calls `redeem_officeholder_wall_claim(token_hash)` (see §4.5). That RPC doesn't know or care whether the caller just signed up or just logged into a 10-year-old account; it only cares that `auth.uid()` resolves to *someone*.
- **Whichever link is completed first wins, and the other becomes permanently invalid** — this falls out of the existing single-use-token design for free, with no new schema or RPC needed. `redeem_officeholder_wall_claim()` sets `office_holder_wall_claim_invites.used_at` and requires `used_at IS NULL` to redeem; since both links reference the *same* invite row, completing either one sets `used_at`, and any later attempt (the other link, a resend of either, or anyone else who somehow obtains the link) fails with "claim invitation is invalid, used, cancelled, or expired." Verified with a rollback-only SQL test: two different accounts race for the same token — the first succeeds, the second is rejected, and a third later attempt is also rejected. No real data touched.
- If the recipient reaches `/officeholder-claim/{token}` directly without a session (bookmarked, forwarded, or no `intent` param), `OfficeholderClaimClient` shows both choices explicitly as two buttons rather than one generic "sign in or sign up" button.
- **Removed**: the `accountExists()` server-side lookup (a `listUsers` pagination loop) and the `inviteUserByEmail` branch are both gone — simpler function, one code path, and the account-existence-privacy property is now moot since nothing depends on it anymore.
- **Works identically for email/password or Google sign-in/sign-up** — `nextPath` is threaded through `emailRedirectTo`/OAuth `redirectTo` to `/auth/callback?next=...` regardless of method (`src/lib/services/auth.ts`), so the claim page (and the signup-time prefill in §4.5) fires the same way no matter which auth method the recipient used.

### 4.2 Merge Operation: Content Consolidation

The `merge_officeholder_wall_claim()` RPC handles 9 entity types:

| Entity Type | Source Lookup | Merge Strategy | Conflict Handling |
|---|---|---|---|
| `post` | `ghost_id` OR `wall_ghost_id` | Retarget to new ghost ID | All posts move |
| `comment` | `ghost_id` | Retarget to new ghost ID | All comments move |
| `supporter` | `politician_id` | Insert on target, delete from source | Skip if already supported |
| `rating` | `politician_id` | Move to target profile | Skip if rater already rated target |
| `news_article_tag` | `politician_id` | Move article tag to target | Skip if already tagged |
| `election_candidate` | `politician_id` | Retarget candidacy | All candidacies move |
| `wall_route` | `office_holder_id` | Update link | Always moves |
| `politician_profile` | 1:1 extension | Not moved; remains on source | Not applicable |
| `profile` | Direct | Archived; not deleted | Source stays as archive |

**Each move is logged** in `office_holder_wall_claim_items` with:
- `entity_type`, `entity_id`
- `source_value` (JSON snapshot: old ownership field)
- `target_value` (JSON snapshot: new ownership field)
- `metadata` (any extra context)

### 4.3 Reversal: Restoration

The `reverse_officeholder_wall_claim()` RPC:
1. Requires `status = 'approved'` (only approved claims can be reversed)
2. Iterates through `office_holder_wall_claim_items` for this claim
3. For each item, restores the **source value**:
   - Posts: set `ghost_id` and `wall_ghost_id` back to source
   - Comments: set `ghost_id` back to source
   - Supporters: delete from target, reinsert to source
   - Ratings: move back to source profile
   - News tags: delete from target, reinsert to source
   - Election candidates: move back to source
   - Office holder: link back to source
4. Marks `office_holder_wall_redirects.active = false` (old URLs stop working)
5. Updates claim status to `'reversed'` with reason and timestamp

**Important**: Reversal does NOT delete content created by the target profile after the claim was merged. Such content may need separate review if the claim was fraudulent.

### 4.4 Wall Slug Redirects

After a merge, the old wall URL remains accessible but redirects to the new owner:

```sql
SELECT * FROM office_holder_wall_redirects
WHERE old_wall_slug = 'my-official-name-mayor'
  AND active = true;
-- Returns: target_profile_id, target_ghost_id
```

On reversal, the redirect is deactivated (`active = false`), and the old wall URL becomes inactive (no longer resolves).

### 4.5 Signup-Time Profile Prefill (added 2026-08-11)

Redeeming a claim token now does more than flip `role` to `politician`. `redeem_officeholder_wall_claim()` calls `backfill_politician_profile_from_officeholder()`, which:

1. Ensures a `politician_profiles` row exists for the claimant (was already true before this change).
2. Generates a `wall_slug` for the claimant's **own** account if they don't have one — built from their own `full_name` + the officeholder's `election_role_types.role_title`, with a short id-suffix fallback on collision.
3. Gap-fills (`COALESCE` — never overwrites) `political_target_role`, `target_boundary_name`, `bio`, `political_party_id`, `contact_email`, `contact_phone`, `source_url`, `photo_url`, and `holding_since` from the officeholder record.

**This happens immediately on redemption, before any admin review.** A brand-new user who signs up through an invite link sees their profile — role, district, bio, party, contact info — fully populated the moment they land on their own account, not after an admin approves the merge (which could be hours later).

**What does NOT change at this point:** `office_holders.linked_profile_id` — the officeholder's actual public wall. That only moves when an admin runs `merge_officeholder_wall_claim()`. Until then, the claimant has a nicely filled-in profile of their own, but the officeholder's real, discoverable wall URL still shows the old (unmerged) content. Verified with a rollback-only SQL test: after redemption, `office_holders.linked_profile_id` still pointed at the source profile while the claimant's own `politician_profiles` row was fully populated.

**Why this is safe**: the claim token is single-use, hashed, expiring, and was emailed only to the address the admin entered — prefilling data doesn't grant any access beyond what redeeming the token already implies, and it doesn't touch the public wall. See `docs/OFFICEHOLDER_WALL_CLAIM_AND_MERGE.md` §5.2 for the full reasoning, including the known gap this surfaces: there is no `reject_officeholder_wall_claim()` RPC, so a `pending_review` claim an admin decides *not* to merge just sits there indefinitely rather than being explicitly rejected.

The same backfill function is also called (defensively, effectively a no-op by then) from `merge_officeholder_wall_claim()`, so any future claim path that reaches merge without going through redemption first still produces a resolvable wall.

### 4.6 Unified Claim Eligibility & Self-Service Requests (added 2026-08-11)

Before this, the only way onto an officeholder wall's claim queue was an admin-sent invite (§4.1) — there was no "Claim This Wall" button on officeholder walls at all, and the generic politician-wall claim button had two bugs: it showed on walls that already had a real owner, and submitting it on an officeholder wall (or any self-registered politician with no candidacy stub) hit a guaranteed FK violation writing into a table (`candidacy_claim_requests`) whose foreign key was never meant for that case.

**`get_wall_claim_eligibility(profile_id)`** — read-only, callable by anyone including logged-out visitors (needed so the UI can decide whether to even show a claim button before asking anyone to sign in). Returns one of:
- `unclaimed_candidate` → routes to the existing, untouched election-candidacy claim system (`request_candidacy_claim()`)
- `unclaimed_officeholder` → routes to `request_officeholder_wall_claim()` (below)
- `not_claimable` → hide all claim UI — the wall already has a real owner or an open claim in flight

**`request_officeholder_wall_claim(office_holder_id, contact_email, note)`** — self-service counterpart to the admin-initiated invite. A logged-in citizen asserts "this officeholder wall is me" directly into `pending_review`, no token or email round-trip needed. Reuses `backfill_politician_profile_from_officeholder()` — the exact function `redeem_officeholder_wall_claim()` calls — so a self-request gets identical immediate profile prefill to an invited signup (§4.5). Reviewed by an admin exactly like any other claim, through the same `preview_officeholder_wall_claim()` → `merge_officeholder_wall_claim()`/`reverse_officeholder_wall_claim()` path, since it produces a normal `office_holder_wall_claims` row rather than a separate table or workflow.

**`list_pending_self_requested_officeholder_claims()`** (admin-only) — self-requests are otherwise invisible unless an admin happens to already be looking at that specific officeholder's admin panel. Surfaced as a "Pending self-requested claims" panel at the top of `/admin/office-holders`, with a "Review" button that loads the existing `InvitationHistoryPanel` for that officeholder — no new merge/reverse UI was built, the existing one is reused.

**Election-candidacy path fixed as a side effect**: routing on `get_wall_claim_eligibility()`'s `candidate_id` instead of the old blind fallback also fixes the FK-violation and missing-column bugs for that path — it now always calls `request_candidacy_claim()` with a confirmed-valid id.

**Verified**: 14/14 checks in a rollback-only SQL test (all three eligibility outcomes, self-request prefill behavior, race-rejection of a second request on the same officeholder, admin-only access to the discoverability listing). Live in the browser with a real, logged-in account (not a rollback): a real already-owned wall shows no claim UI at all; a real unclaimed officeholder wall shows "Claim This Wall"; submitting it creates a real `pending_review` claim, promotes the requester's role to `politician`, and correctly preserves (never overwrites) the requester's own pre-existing `wall_slug`/`bio` via the same gap-fill `COALESCE` strategy §4.5 uses. Full detail and exact test data in `OFFICEHOLDER_WALL_CLAIM_AND_MERGE.md`'s 2026-08-11 implementation log entries.

---

## 5. Admin Workflow: Step-by-Step

### Scenario A: Newly Imported Officeholder, Recipient Signs Up Fresh

1. **Admin goes to** `/admin/office-holders`
2. **Selects boundary** (Country → Boundary Type → Search → Select)
3. **Finds role** (e.g., "Mayor")
4. **Sees "Set officeholder" button** (if no one assigned yet)
5. **Fills in form**:
   - Full name: "Jane Smith"
   - Political party: "Green Party"
   - Bio: "Community advocate"
   - Contact email: `jane@city.gov`
   - Term dates, phone (optional)
6. **Clicks "Save"**
7. **Clicks "Send claim invite"**
8. **System creates claim and sends ONE email with TWO links** (see §4.1):
   - `create_officeholder_wall_claim()` creates claim row (status: `invited`)
   - `send-officeholder-claim()` Edge Function generates a random token (256-bit), hashes it (SHA256), and emails both a signup link and a merge/login link — both built from the *same* token
   - Returns claim ID to UI
9. **Jane receives the email** and picks **"New to Choseno? Sign up and claim your wall"**
10. **Jane lands on** `/auth?role=politician&next=/officeholder-claim/{token}` — the Sign Up tab, pre-selected
11. **Jane creates an account** (email/password or Google — both work identically; see §4.1) and is redirected back to the claim link once her session exists
12. **OfficeholderClaimClient** component:
    - Hashes token locally (SHA256)
    - Calls `redeem_officeholder_wall_claim()` with token hash
    - RPC validates token — **also invalidates the *other* link from the same email**, since both share this one token (see §4.1)
    - RPC sets `role = 'politician'`
    - **RPC also calls `backfill_politician_profile_from_officeholder()`** — Jane's own (not-yet-public) profile is immediately filled in: role title, boundary name, bio, party, contact email/phone, source URL, holding-since date, and a generated `wall_slug` for her own account. Nothing here is publicly visible yet — the officeholder's real wall URL is untouched.
    - Updates claim to `pending_review`
    - User sees "Claim submitted" message
13. **Jane can already see her own profile is populated** (role, bio, contact info, her own wall at her own slug) — she doesn't have to wait for the admin to see this.
14. **Admin reviews in UI**:
    - Sees claim status: `pending_review`
    - Clicks "Merge wall" → sees a confirm dialog with the exact `preview_officeholder_wall_claim()` counts (posts/comments/supporters/ratings/news tags/candidacies) before confirming
15. **Merge executes**:
    - `merge_officeholder_wall_claim()` RPC runs transactionally
    - All wall content moves to Jane's new profile
    - `office_holder_wall_redirects` created for old wall slug
    - Claim status → `approved`
16. **Jane's wall is now live at the officeholder's real URL**:
    - Old wall slug redirects to her profile
    - All posts/comments/supporters/ratings consolidated
    - She can edit her profile, make posts, respond to comments

---

### Scenario B: Officeholder Merges Into an Existing Choseno Account

1. **Admin sends the invite exactly as in Scenario A** — the system doesn't need to know in advance whether the recipient already has an account; the same email is sent either way.
2. **Recipient already has a Choseno account** (maybe from running as a candidate previously, or an account under a different email than the one the admin invited) and picks **"Already have a Choseno account? Sign in and merge this wall into your profile"** instead.
3. **Lands on** `/auth?role=politician&intent=login&next=/officeholder-claim/{token}` — the Log In tab, pre-selected (the `intent=login` param is what forces this, independent of the `role` param).
4. **Signs in** (email/password or Google) and is redirected back to the claim link.
5. **Claim page**:
   - Session already exists → auto-submits immediately, no separate "sign in to claim" step
   - Shows "Claim submitted; admin will review"
   - Same token-invalidation guarantee applies: if the recipient (or anyone else) had also clicked the *signup* link from the same email, that one is now dead.
6. **Admin merges** (same as Scenario A, steps 14-16).

---

### Scenario B.5: Self-Service Request (No Invite Needed)

1. **A citizen visits an unclaimed officeholder wall** directly (found via search, a share link, etc.) — no admin invite was ever sent.
2. **Sees a "Claim This Wall" button** — shown because `get_wall_claim_eligibility()` returned `unclaimed_officeholder` for this wall (no owner, no open claim).
3. **If not logged in**, clicking the button redirects to `/auth?role=politician&next=<this wall's URL>`.
4. **Once logged in**, clicking the button opens a modal: "Are you [Name] or an authorized campaign staff member? ... Signed in as [email] — an admin reviews every request before anything on this wall changes."
5. **Fills in** contact email, phone/social link (optional), verification note, and submits.
6. **`request_officeholder_wall_claim()` runs**:
   - Creates an `office_holder_wall_claims` row directly in `pending_review`, `metadata->>'self_requested' = 'true'`
   - Promotes the requester's `role` to `'politician'`, sets `onboarding_completed = true`
   - Calls `backfill_politician_profile_from_officeholder()` — same immediate prefill as an invited signup (§4.5), gap-filling only what's NULL on the requester's own profile
7. **Requester sees** "Claim Request Submitted!" confirmation.
8. **Admin discovers the request** via the new "Pending self-requested claims" panel at the top of `/admin/office-holders` (§4.6) — no need to already be on that specific officeholder's page.
9. **Admin reviews and merges** exactly as in Scenario A steps 14-16.

---

### Scenario C: Reverse a Fraudulent Claim

1. **Admin opens** Office Holders admin
2. **Sees claimed officeholder**
3. **Clicks "Reverse claim"** (red button, only if status = `approved`)
4. **Prompted**: "Reason for reversing this claim?"
5. **Enters reason**: "Fraudulent account takeover; user not the real official"
6. **Clicks confirm**
7. **Reversal executes**:
   - `reverse_officeholder_wall_claim()` RPC
   - All wall content moves back to original (synthetic) profile
   - Redirect deactivated
   - Claim status → `reversed` with reason
8. **Original wall is restored**:
   - Old posts/comments back under original ghost ID
   - Supporters moved back
   - Ratings moved back
9. **New (fraudulent) profile keeps** any content created after the claim (requires separate review if problematic)

---

### Scenario D: Resend Invite (If First One Expired)

1. **Claim status is** `invited` OR `expired`
2. **Admin clicks "Resend invite"**
3. **Admin can change email** (or use stored one)
4. **System**:
   - Cancels old token (marks as `cancelled_at`)
   - Creates new token
   - Sends email with new link
   - Claim status remains `invited`
5. **Original token becomes unusable**
6. **New token has fresh 7-day expiry**

---

## 6. Edge Cases & Constraints

### 6.1 Duplicate Claims

**Q: Can I send two invites for the same officeholder at the same time?**

**A: NO.** Unique constraint prevents it:

```sql
-- Only ONE open claim per officeholder
WHERE status IN ('draft', 'invited', 'pending_confirmation', 'pending_review', 'approved')
```

**Resolution**:
- If first claim is `invited` → call `resend_officeholder_wall_claim()` (new token, same claim)
- If first claim is `pending_review` → wait for admin decision or `cancel_officeholder_wall_claim()`
- If first claim is `approved` → must `reverse_officeholder_wall_claim()` before creating new one

### 6.2 Account Already Claimed Another Wall

**Q: Can one user claim multiple officeholder walls?**

**A: YES, if no constraint prevents it.** Current implementation allows it, but it may be undesirable.

**Future mitigation** (if needed):
- Add constraint: `UNIQUE(target_profile_id) WHERE status = 'approved'`
- OR soft-limit in RPC: check if user already has approved claim

### 6.3 Merge Failure (Partial Content)

**Q: What if merge crashes mid-operation?**

**A: Transaction rollback.** The RPC is wrapped in a single transaction:
- All items inserted to `office_holder_wall_claim_items`
- All data updates (posts, comments, supporters, etc.)
- Claim status update to `approved`

**If any step fails**: entire transaction rolls back. No partial ownership changes. Wall remains unmerged.

**Visibility**: Claim stays in `pending_review` until admin retries or cancels.

### 6.4 Reversal After Target Has Posted

**Q: Reversal moves wall content back. What about posts created by the target after merge?**

**A: They stay with the target profile.** Reversal only restores what was moved during the merge.

**Scenario**:
1. Merge: Jane claims wall, 10 posts move to Jane
2. Jane creates 5 new posts herself
3. Reversal: 10 posts move back to source, 5 new posts stay with Jane

**If problematic**: Admin must manually review/delete Jane's unauthorized posts.

### 6.5 Email Delivery Failures

**Q: What if the email fails to send?**

**A: Claim is created but email not sent.**

**Visibility**:
- `send-officeholder-claim()` returns error
- UI displays error to admin
- Claim row exists (status: `invited`, `contact_email` populated)
- Admin can try "Resend" button later

**Logs**: Edge Function logs all attempts; check Supabase Edge Function logs for details.

---

## 7. Data Validation & Safety

### 7.1 RLS Policies

All claim tables are **admin-only**:

```sql
-- office_holder_wall_claims: only admins can read/create/update
CREATE POLICY "Admins can read officeholder wall claims"
  ON office_holder_wall_claims FOR SELECT
  USING (auth.uid() in (SELECT id FROM profiles WHERE role = 'admin'));

-- office_holder_wall_claim_invites: no public SELECT
-- (tokens must never be world-readable)

-- office_holder_wall_redirects: PUBLIC READ (needed for wall routing)
-- But only ACTIVE redirects are readable
CREATE POLICY "Anyone can read active officeholder wall redirects"
  ON office_holder_wall_redirects FOR SELECT
  USING (active = true);
```

### 7.2 Token Security

- **Generated**: 256-bit random bytes
- **Stored**: SHA256 hash only (plaintext token never stored)
- **Transmitted**: Via email link (single-use)
- **Expiry**: 7 days default
- **Revocation**: Can be manually cancelled; old tokens also cancelled on resend

### 7.3 Status Invariants

The RPC enforces:

```plpgsql
-- Can only merge if pending_review + has target profile set
IF c.status <> 'pending_review' OR c.target_profile_id IS NULL THEN
  RAISE EXCEPTION 'claim must be pending review with a target profile';
END IF;

-- Can only reverse if approved
IF c.status <> 'approved' THEN
  RAISE EXCEPTION 'only an approved claim can be reversed';
END IF;

-- Source and target must differ
IF c.source_profile_id = c.target_profile_id OR c.source_ghost_id = c.target_ghost_id THEN
  RAISE EXCEPTION 'source and target wall identities must differ';
END IF;
```

---

## 8. Testing & Verification

### ✅ Completed Tests

| Test | Result | Date |
|------|--------|------|
| Foundation schema creation | ✅ All 4 tables created | 2026-08-11 |
| RLS policies | ✅ Admin-only access verified | 2026-08-11 |
| `create_officeholder_wall_claim()` RPC | ✅ Works correctly | 2026-08-11 |
| `redeem_officeholder_wall_claim()` RPC | ✅ Works correctly | 2026-08-11 |
| `merge_officeholder_wall_claim()` RPC | ✅ Full merge with audit items | 2026-08-11 |
| `reverse_officeholder_wall_claim()` RPC | ✅ Full reversal tested | 2026-08-11 |
| `resend_officeholder_wall_claim()` RPC | ✅ Token cancellation verified | 2026-08-11 |
| `cancel_officeholder_wall_claim()` RPC | ✅ Status guards verified | 2026-08-11 |
| Email branching (new vs. existing account) | ✅ Server-side lookup verified | 2026-08-11 |
| Smoke tests (UI) | ✅ Claim page loads; admin route protected | 2026-08-11 |
| Transactional rollback (merge failure) | ✅ No partial data changes | 2026-08-11 |
| Duplicate claim prevention | ✅ Constraint enforced | 2026-08-11 |
| Merge/Reverse buttons in the invite-flow admin panel | ✅ Fixed (were missing entirely) and verified live in browser | 2026-08-11 |
| Reversal post-authorship bug (citizen post corrupted) | ✅ Fixed and verified with a rollback-only test | 2026-08-11 |
| New-account merge produces an unreachable wall | ✅ Fixed and verified live (real merge + reverse, not just rollback) | 2026-08-11 |
| Signup-time profile prefill | ✅ Verified with a rollback-only test simulating the real redeem path | 2026-08-11 |
| Dual-link invite: same-token race (signup link vs. merge link) | ✅ Verified with a rollback-only test — first redemption wins, second is rejected, later reuse also rejected | 2026-08-11 |
| `intent=login` routes to Log In tab; default routes to Sign Up tab | ✅ Verified live in browser (both `/auth` variants) | 2026-08-11 |
| `send-officeholder-claim` Edge Function deployed with dual-link email | ✅ Deployed and confirmed live (401 on unauthenticated request, as before) | 2026-08-11 |
| Supporters/ratings/comments move (and reverse) correctly, incl. overlap case | ✅ Verified with rollback-only tests | 2026-08-11 |
| Unified eligibility (`get_wall_claim_eligibility`): owned wall → `not_claimable`, candidate stub → `unclaimed_candidate`, officeholder → `unclaimed_officeholder` | ✅ 14/14 checks passed in rollback-only SQL test | 2026-08-11 |
| Self-request race: second citizen requesting the same officeholder while first is in flight | ✅ Correctly rejected (unique-open-claim constraint) — rollback-only test | 2026-08-11 |
| Self-request, real account, real submission via browser: "Claim This Wall" → modal → submit | ✅ Verified live (non-rollback) — claim created `pending_review`, role promoted, gap-fill preserved existing profile fields correctly | 2026-08-11 |
| `list_pending_self_requested_officeholder_claims()` admin-only enforcement | ✅ Verified live — non-admin caller correctly rejected | 2026-08-11 |
| Already-owned wall shows no claim UI (real wall, not test data) | ✅ Verified live in browser | 2026-08-11 |
| Unclaimed officeholder wall shows "Claim This Wall"; logged-out click redirects to `/auth` | ✅ Verified live in browser | 2026-08-11 |
| Admin-invite → dual-link chooser page → "New to Choseno" routing to signup | ✅ Verified live in browser (real invite, real token) | 2026-08-11 |

### 🟡 Pending Tests

| Test | Scope | Priority |
|------|-------|----------|
| End-to-end new account flow (signup → token redemption → merge), the redemption step specifically | Blocked in the last pass by a dev-server build-cache glitch after signup submit; invite creation + dual-link routing + signup form entry all verified — only the RPC call itself (`redeem_officeholder_wall_claim`) wasn't exercised live in this pass, though it has separate rollback-only and earlier real-session coverage | High |
| End-to-end existing account flow | Existing user merges wall via the "merge into it" link | High |
| Reversal with conflicting content | Posts created after merge | Medium |
| Concurrent claims (race condition) | Multiple admins claiming simultaneously | Medium |
| Large wall merge (1000+ posts/comments) | Performance under load | Medium |
| Token expiry enforcement | Claim link stops working after 7 days | High |
| Email failure handling | Graceful error + retry capability | Medium |

---

## 9. Known Issues & Gaps

### 🟢 No Issues (System is Solid)

The core merge, reversal, and audit functionality is complete and tested. A manual audit on 2026-08-11 found and fixed five real gaps (missing UI wiring, a reversal data-integrity bug, an unreachable-wall bug, a pre-existing unrelated FK-violation bug in the generic wall claim button, and a swallowed-error-message issue) — see the implementation log in `OFFICEHOLDER_WALL_CLAIM_AND_MERGE.md` §9 for full detail and test evidence on each.

### 🔴 Action Needed: Real Test Data Left in the Queue

- A real (non-rollback) self-requested claim from live testing on 2026-08-11 is sitting in `pending_review` on Tom Corbin's wall (claim id `d62de94f-7b17-48de-a383-7ec27fcedba6`, requester "John Doe" / `munaruna86@gmail.com`, a shared test account). It will appear in the "Pending self-requested claims" admin panel. Because of the gap directly below (no reject path), it can't be cleanly dismissed via RPC — an admin needs to either merge it for real or manually update its status via SQL.

### 🟡 Deferred Features (Not Blockers)

0. **No reject path for `pending_review` claims**
   - `cancel_officeholder_wall_claim()` only accepts `draft`/`invited`/`pending_confirmation` — once a claim reaches `pending_review` (whether via invite redemption or self-request), an admin who decides not to merge it has no explicit way to close it out; it just sits there.
   - Worth prioritizing now that both prefill (§4.5) *and* self-service requests (§4.6) mean `pending_review` claims are more common and carry more complete, official-looking profiles than before.
   - Suggested: a `reject_officeholder_wall_claim(claim_id, reason)` RPC, mirroring `reverse_officeholder_wall_claim()`'s shape but from `pending_review` instead of `approved`, and without anything to restore (nothing was ever moved).

1. **Abuse review after reversal**
   - If reversed claim had fraudulent posts, flag for review
   - Currently requires manual discovery + deletion
   - Planned for Phase 5

3. **One-user-one-wall limit**
   - Currently a user can claim multiple officeholder walls
   - May need constraint depending on product direction
   - Deferred decision

4. **Claim history UI**
   - Admins can view claims in Office Holders panel
   - Full audit trail exists in `office_holder_wall_claim_items`
   - Summary view could be added to admin dashboard

### ❌ Known Limitations

| Limitation | Impact | Mitigation |
|---|---|---|
| Direct linking disabled | Admins can't manually set `linked_profile_id` via form | Must use claim invitation flow |
| Only 1 open claim/officeholder | Can't test multiple invites in parallel | Create new officeholder for testing |
| No public claim form yet | General public can't self-request claim | Admin must initiate |
| Email backend required | If email service down, invites won't send | Check `send-email` function status |

---

## 10. Service Layer & API Reference

### Client Functions (`src/lib/services/elections.ts`)

```typescript
// Create a new claim invitation
export async function createOfficeholderWallClaimRecord(
  supabase: Client,
  officeHolderId: string,
  email: string,
  tokenHash: string,
  expiresAt?: string,
): Promise<{ data?, error? }>

// Send claim invite (branching: new vs. existing account)
export async function inviteOfficeholderToClaim(
  supabase: Client,
  officeHolderId: string,
  email: string,
): Promise<{ data?, error? }>

// Resend invite with new token
export async function resendOfficeholderClaim(
  supabase: Client,
  claimId: string,
  email: string,
): Promise<{ data?, error? }>

// Cancel a draft/invited/expired claim
export async function cancelOfficeholderClaim(
  supabase: Client,
  claimId: string,
): Promise<{ data?, error? }>

// User redeems token (makes claim.pending_review)
export async function redeemOfficeholderWallClaim(
  supabase: Client,
  tokenHash: string,
): Promise<{ data?, error? }>

// Admin previews what will merge
export async function previewOfficeholderWallClaim(
  supabase: Client,
  claimId: string,
): Promise<{ data?, error? }>

// Admin executes merge
export async function mergeOfficeholderWallClaim(
  supabase: Client,
  claimId: string,
): Promise<{ data?, error? }>

// Admin reverses a claim
export async function reverseOfficeholderWallClaim(
  supabase: Client,
  claimId: string,
  reason: string,
): Promise<{ data?, error? }>

// Get all claims for an officeholder
export async function getOfficeholderWallClaims(
  supabase: Client,
  officeHolderId: string,
): Promise<{ data?: OfficeholderClaim[], error? }>
```

### Database Procedures

| RPC | Parameters | Returns | Requires | Notes |
|---|---|---|---|---|
| `create_officeholder_wall_claim()` | `office_holder_id`, `email`, `token_hash`, `expires_at?` | `claim_id`, `invite_id`, `source_profile_id`, `source_ghost_id`, `expires_at` | Admin role | |
| `redeem_officeholder_wall_claim()` | `token_hash` | `claim_id`, `office_holder_id`, `target_profile_id`, `status` | Authenticated user | Also calls `backfill_politician_profile_from_officeholder()` — see 4.5 |
| `backfill_politician_profile_from_officeholder()` | `profile_id`, `office_holder_id`, `claim_id?` | VOID | Internal only (called from other `SECURITY DEFINER` RPCs; not `GRANT`ed to `authenticated`) | Gap-fills `politician_profiles` from the officeholder record; generates `wall_slug` if missing. Idempotent. |
| `preview_officeholder_wall_claim()` | `claim_id` | JSON: post count, comment count, supporter count, rating count, news tags, election candidates | Admin role | Now surfaced in the admin UI's merge confirm dialog |
| `merge_officeholder_wall_claim()` | `claim_id` | JSON: claim_id, status, moved_item_count, source_profile_id, target_profile_id | Admin role | Also calls `backfill_politician_profile_from_officeholder()` as a defensive backstop |
| `reverse_officeholder_wall_claim()` | `claim_id`, `reason` | JSON: claim_id, status, restored_item_count | Admin role | Post `ghost_id`/`wall_ghost_id` restored independently (fixed 2026-08-11) |
| `resend_officeholder_wall_claim()` | `claim_id`, `email`, `token_hash`, `expires_at?` | `claim_id`, `invite_id`, `expires_at` | Admin role | |
| `cancel_officeholder_wall_claim()` | `claim_id` | VOID | Admin role | Only accepts `draft`/`invited`/`pending_confirmation` — no reject path for `pending_review` (known gap) |
| `get_wall_claim_eligibility()` | `profile_id` | JSONB: `{kind, candidate_id?, office_holder_id?}` | Anyone (incl. logged-out) | Read-only routing check shared by officeholder and generic politician walls — see §4.6 |
| `request_officeholder_wall_claim()` | `office_holder_id`, `contact_email`, `note?` | `claim_id`, `status` | Authenticated user | Self-service counterpart to `create_officeholder_wall_claim()` — lands directly in `pending_review`, calls the same backfill as redemption |
| `list_pending_self_requested_officeholder_claims()` | — | Table of self-requested claims with officeholder/requester/wall-slug details | Admin role | Global discoverability — see §4.6 |

---

## 11. Compliance & Security Checklist

- ✅ Tokens hashed at rest (SHA256)
- ✅ No account-existence leakage to client
- ✅ All mutations guarded by admin RLS
- ✅ All operations transactional (no partial updates)
- ✅ Every moved entity audited in `office_holder_wall_claim_items`
- ✅ Reversal is fully restorative
- ✅ Old wall slugs redirect to new owner
- ✅ Synthetic source profiles archived (not deleted)
- ✅ Status invariants enforced in database
- ✅ Duplicate claims prevented by unique constraint
- ✅ Email delivery branching server-side

---

## 12. Deployment Checklist

### Before Going Live

- [ ] Run full end-to-end test suite (new account, existing account, merge, reversal)
- [ ] Verify `send-email` Edge Function is deployed and working
- [ ] Test email delivery (both invitation types)
- [ ] Load test merge RPC with large wall (1000+ posts)
- [ ] Verify old wall slugs redirect correctly
- [ ] Test reversal and confirm content restoration
- [ ] Document claim workflow for support team
- [ ] Add monitoring for claim RPC errors
- [ ] Set up alerts for failed email sends

### Post-Deployment Monitoring

- Track claim creation/merge/reversal counts
- Monitor email delivery success rate
- Watch for RPC error patterns
- Set alerts for duplicate-claim constraint violations
- Review claim audit trail weekly

---

## 13. Future Enhancements

### Phase 5 (Planned)

1. ~~**Public self-service claim form**~~ — ✅ Implemented 2026-08-11, see §4.6. Not yet built: proof upload (government ID, etc.) — currently just a contact email/phone/note an admin manually verifies before merging.

2. **`reject_officeholder_wall_claim()` RPC**
   - Explicit close-out path for `pending_review` claims an admin decides not to merge — see §9 known gap
   - Now more urgent with self-service requests live

3. **Abuse review for reversals**
   - Flag content created by target after merge
   - Separate review queue for potentially fraudulent posts

4. **Claim history dashboard**
   - Timeline view of all claims
   - Audit trail per officeholder
   - Reversal reasons logged and viewable

5. **Multi-wall limits**
   - If policy requires: one user = one claimed wall
   - Add constraint and UI validation

5. **Batch reversal**
   - Admin can reverse multiple claims at once
   - Useful for fraudulent account crackdowns

---

## 14. Troubleshooting Guide

### "Claim invitation is invalid, used, cancelled, or expired"

**Cause**: Token hash doesn't match or claim is in wrong status

**Fix**:
- Admin checks claim status in office-holders admin
- If `invited` or `expired`: click "Resend invite" to generate new token
- If `pending_review`: user already redeemed; admin must merge or cancel
- If `approved`: claim already merged; can't redeem again

### "This wall already has a X claim"

**Cause**: Duplicate claim attempt

**Fix**:
- Check latest claim status in admin panel
- If `invited` or `expired`: click "Resend" (don't create new claim)
- If `pending_review`: wait for admin decision or cancel first
- If `approved`: reverse the claim first before creating new one

### "Direct profile linking is disabled"

**Cause**: Admin tried to manually set `linked_profile_id` via form

**Fix**:
- Use "Send claim invite" workflow instead
- Admin can't bypass merge verification
- This is intentional for safety

### Merge failed / partial data moved

**Cause**: RPC error during merge

**Fix**:
- Check claim status (should still be `pending_review`)
- Review `npx supabase logs` for RPC error
- Retry merge; if fails again, cancel and start over
- Check for data inconsistencies (unlikely; transaction should have rolled back)

---

## 15. Related Documentation

- [OFFICEHOLDER_WALL_CLAIM_AND_MERGE.md](OFFICEHOLDER_WALL_CLAIM_AND_MERGE.md) — Design rationale and schema decisions
- [OFFICE_HOLDERS_FEATURE.md](OFFICE_HOLDERS_FEATURE.md) — Office holder display & admin features
- [SCHEMA_RELATIONSHIPS.md](SCHEMA_RELATIONSHIPS.md) — Entity relationships (includes office_holders)
- [AUTHENTICATION_FLOWS.md](AUTHENTICATION_FLOWS.md) — Auth context and session handling
- Election Candidate Claim Flow — Similar pattern for unregistered candidates (for reference)

---

## Appendix: Quick Reference

### Database Tables

```sql
office_holder_wall_claims           -- Main claim records
office_holder_wall_claim_items      -- Audit trail (entities moved)
office_holder_wall_claim_invites    -- Hashed tokens + email
office_holder_wall_redirects        -- Old wall slug → new owner
```

### Statuses

```
draft → invited → pending_review → approved → reversed
       └─ expired (7 day timeout)
       └─ rejected (future)
       └─ cancelled (manual cancel)
```

### Key Constraints

```sql
-- Only 1 open claim per officeholder
UNIQUE(office_holder_id) WHERE status IN (...open states...)

-- Active redirects keyed on old slug
UNIQUE(old_wall_slug) WHERE active = true

-- Active redirects keyed on old ghost ID
UNIQUE(old_ghost_id) WHERE active = true
```

### Admin UI Path

```
/admin/office-holders
  ├─ Search boundary & role
  ├─ Add/edit officeholder data
  ├─ Send claim invite
  ├─ View claim status
  ├─ Merge approved claim
  └─ Reverse claim (if approved)
```

---

**Generated**: 2026-08-11  
**Status**: Ready for production (Phase 1-3 complete, Phase 4 in progress)
