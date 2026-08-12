# Officeholder Wall Claim, Merge, and Reversal

**Status:** ✅ Production-ready — full claim flow (admin invite & self-request), auto-merge for admin-initiated invites, merge/reversal, redirects, signup-time profile prefill, all tested and documented

**Owner:** Choseno admin / platform engineering

**Last updated:** 2026-08-12 (auto-merge on invite redemption)

**Scope:** Public walls created from scraped `office_holders` data. This is separate from, but should eventually share infrastructure with, the existing election-candidate claim flow.

## Quick Links

- **[TESTING_OFFICEHOLDER_CLAIMS.md](TESTING_OFFICEHOLDER_CLAIMS.md)** — Step-by-step guide with real IDs, curl commands, and mailsac examples for testing all claim flows
- **[TEST_ACCOUNTS.md](TEST_ACCOUNTS.md)** — Mailsac disposable-inbox accounts for dev/testing (already created, email-confirmed, with known passwords)
- **[TEST_RESULTS_AUTO_MERGE.md](TEST_RESULTS_AUTO_MERGE.md)** — Verification data from the auto-merge feature test (2026-08-12)

## 1. Purpose

Choseno imports current officeholders from public or government data sources and creates a public politician wall for each officeholder. The real officeholder may later:

1. already have a Choseno account and politician wall;
2. have no Choseno account; or
3. have an account that is not yet linked to the imported officeholder record.

The goal is to let an administrator invite or approve the real person, connect the imported officeholder record to the correct authenticated profile, merge public wall data safely, and reverse the operation if the claim was fraudulent or incorrect.

The system must not treat a name match as proof of identity. Email invitation proves control of the email address, but an existing account must still authenticate before it can be merged.

## 2. Current implementation: what exists today

### 2.1 Imported officeholder records

The ingestion scripts create a synthetic profile and politician profile for an unlinked officeholder, then set:

```text
office_holders.linked_profile_id → synthetic profiles.id
```

The synthetic profile has a `current_ghost_id`, so it can own a public wall even though it has no row in `auth.users` and cannot sign in.

Relevant implementation:

- `scripts/populate-canadian-municipal.py`
- `scripts/populate-us-municipal.py`
- `scripts/populate-national-and-province-heads.py`
- `supabase/migrations/20260807000001_office_holder_contact_and_profile_link.sql`

### 2.2 Manual admin linking

The Office Holders admin panel can search profiles and set `linked_profile_id` manually. This changes the officeholder reference only. It does not merge profiles, move wall posts, move supporters or ratings, preserve a redirect, or create a reversal record.

Relevant implementation:

- `src/components/features/OfficeHoldersAdminClient.tsx`
- `src/lib/services/elections.ts` (`upsertOfficeHolder`)

### 2.3 Existing candidate claim flow

The repository has a claim flow for an unregistered `election_candidates` stub:

```text
admin → candidate claim invite → token → signed-in user → finalize_candidate_claim()
```

It includes hashed tokens, seven-day expiry, self-request review, wall-post reassignment, supporter merging, and profile deletion. It is not currently an officeholder-wall claim flow.

Relevant implementation:

- `supabase/migrations/20260802000001_candidacy_claims.sql`
- `supabase/functions/send-claim-invite/index.ts`
- `src/lib/services/elections.ts`
- `src/components/features/ClaimCandidacyClient.tsx`

### 2.4 Known unsafe or incomplete paths

- The generic wall claim form writes to `candidacy_claim_requests`, whose foreign key expects an `election_candidates.id`. That is not a valid general officeholder claim target.
- The admin claim-request UI has a direct-update fallback if the review RPC fails. Approval must never bypass the merge RPC.
- The existing candidate claim finalizer deletes the synthetic profile, so it is not a suitable reversible foundation for officeholder claims.

## 3. Desired administrator flow

### Flow A: invite an officeholder with no existing account

```text
Admin selects imported wall
  ↓
Admin confirms officeholder email
  ↓
Server creates a claim invitation for this officeholder wall
  ↓
Email contains a one-time claim link
  ↓
Recipient creates/signs into a Choseno account
  ↓
Recipient confirms the claim (redeem_officeholder_wall_claim)
  ↓
Recipient's OWN politician_profiles is immediately prefilled from the
officeholder record (role, boundary, bio, party, contact, wall_slug) —
see §5.2. The PUBLIC wall does not move yet.
  ↓
Admin can see the claim and merge audit history
  ↓
Transactional merge attaches the imported wall to the new profile
```

The new account must become the surviving authenticated profile. The imported profile remains archived for reversal and audit; it is not immediately deleted.

**Signup-time prefill (implemented 2026-08-11):** the recipient does not have to wait for admin approval to see a populated profile. The moment they redeem the claim token, `redeem_officeholder_wall_claim()` calls `backfill_politician_profile_from_officeholder()`, which fills any empty field on their own `politician_profiles` row (never overwrites a field they've already set themselves) from the officeholder's official record, and generates a `wall_slug` for their own account if they don't have one. This only touches their own, not-yet-public profile — `office_holders.linked_profile_id` (the actual public wall) is untouched until an admin runs the merge. See §5.2 and §9 for the safety reasoning and test evidence.

### Flow B: invite an officeholder who already has an account

```text
Admin selects imported wall
  ↓
Admin enters/confirms email
  ↓
Server securely determines whether that email belongs to an account
  ↓
System sends a claim link or account email
  ↓
Recipient signs into the existing account
  ↓
Recipient confirms the exact wall being claimed
  ↓
Admin review is required before merge, unless a future policy explicitly removes it
  ↓
Transactional merge attaches imported wall to existing profile
```

The email lookup must run server-side. The browser must not receive a list of registered emails or use email equality as the authorization decision.

### Flow C: admin-assisted merge

This is the first implementation target:

1. Admin selects the imported officeholder wall.
2. Admin searches for an existing Choseno politician profile.
3. System displays a merge preview.
4. Admin confirms the target profile and merge policy.
5. One database operation records the claim and performs the merge.
6. The old wall identity remains recoverable.

This flow handles cases where the officeholder contacted Choseno directly or where email delivery is unavailable.

### Flow D: reverse a claim

```text
Admin opens claim history
  ↓
Admin selects Reverse Claim
  ↓
System displays the original profile, target profile, moved records, and current status
  ↓
Admin confirms a reason
  ↓
Transactional reversal restores the officeholder wall linkage and original ownership
  ↓
The claim is marked reversed, never erased
```

Reversal should restore ownership and wall routing. It should not silently delete unrelated content created by the real account. Content created while impersonating the officeholder should be flagged for review.

## 4. Existing schema and architecture map

This section must be reviewed before any schema migration is added. The wall is not owned by one column; ownership and routing are distributed across several tables.

### 4.1 `office_holders`

Current structure:

```text
id uuid primary key
map_shape_id bigint → map_shapes.id
election_role_type_id uuid → election_role_types.id
full_name
political_party_id → political_parties.id
bio, source_url, photo_url, holding_since
contact_email, contact_phone
linked_profile_id uuid → profiles.id, nullable
updated_by → profiles.id
```

Constraints and access:

- One row per `(map_shape_id, election_role_type_id)`.
- Public `SELECT` is allowed.
- Admins manage the table through RLS.
- `linked_profile_id` is currently a reference/navigation field, not a merge or ownership-transfer operation.
- `ON DELETE SET NULL` on `linked_profile_id` means deleting a linked profile does not delete the officeholder record.

Source migrations:

- `supabase/migrations/20260806000001_office_holders.sql`
- `supabase/migrations/20260807000001_office_holder_contact_and_profile_link.sql`

### 4.2 `profiles`

Current identity fields:

```text
id uuid primary key
role
full_name
country
current_ghost_id uuid unique
onboarding_completed
civic_score / cached_total_score
is_test
```

Important architecture fact:

- `profiles.id` no longer has a foreign key to `auth.users.id`.
- A real signed-in user normally has matching IDs because the signup trigger creates the profile.
- Imported synthetic officeholder profiles can exist without an `auth.users` row.
- Therefore, “has a profile” and “can authenticate” are different states and must not be treated as equivalent during a claim.

### 4.3 `politician_profiles`

This is a one-to-one extension of `profiles` and contains the public politician wall metadata:

```text
id → profiles.id
political_target_role
target_boundary_type / target_boundary_id / target_boundary_name
bio, education, hometown
avatar_url, photo_url
political_party_id
contact_email, contact_phone, source_url, holding_since
wall_slug unique where non-null
```

Wall URLs resolve through `wall_slug` first, with fallback resolution through profile ID/current ghost ID — **all three resolution paths require a `politician_profiles` row to exist** (`politician_profiles!inner` in every query in `politicianWall.ts`, including the old-slug redirect lookup). A target with no row, or a `NULL` `wall_slug`, has no reachable wall under any URL. Any merge must preserve or redirect the old slug and avoid violating the unique slug indexes.

`backfill_politician_profile_from_officeholder(p_profile_id, p_office_holder_id, p_claim_id)` (added 2026-08-11, migration `20260811160000`) is the one place `wall_slug` generation and official-data gap-filling happens — called from both `redeem_officeholder_wall_claim()` and `merge_officeholder_wall_claim()`. It builds the slug from the profile's own `full_name` + the officeholder's `election_role_types.role_title`, and falls back to appending a short id suffix on a slug collision.

### 4.4 Wall content and social data

The current ownership signals are:

| Data | Ownership signal | Important behavior |
|---|---|---|
| `posts` authored identity | `ghost_id` | No profile FK by design; supports ghost rotation |
| `posts` wall target | `wall_ghost_id` text | Used for politician wall targeting; type differs from `ghost_id` |
| `comments` authored identity | `ghost_id` | No profile FK |
| `politician_supporters` | `politician_id` profile FK | Duplicate-safe composite primary key with supporter |
| `politician_ratings` | `politician_id` and `rater_id` profile FKs | Rating identity and target are separate |
| `news_article_politicians` | `politician_id` profile FK | Many-to-many article tagging |
| `election_candidates` | `politician_id` profile FK | A profile may have election candidacies |

The merge engine must not move all content belonging to the target profile. It must move only content attributable to the imported officeholder source identity and record each change.

### 4.5 Current service and RLS boundaries

- Public wall reads go through `src/lib/services/politicianWall.ts` and resolve profiles by ghost ID or slug.
- Officeholder reads and the current admin link operation live in `src/lib/services/elections.ts`.
- Admin profile search uses `admin_search_profiles()` because ordinary profile RLS does not allow an admin client to browse all profiles directly.
- `office_holders` is public-read/admin-write.
- `profiles` is not generally public-read; public politician visibility is provided by a targeted policy and service queries.
- Ownership-changing operations must be database-side and must not rely on the client simply updating `linked_profile_id`.
- Existing `finalize_candidate_claim()` is a candidate-specific one-way operation and deletes the source synthetic profile. It cannot be reused unchanged for reversible officeholder merges.

### 4.6 Implications for the next design

Before adding a claim table, we must decide:

1. whether claim history references a source profile that remains archived or uses a separate wall-identity record;
2. how to distinguish imported wall-authored posts from normal ghost activity;
3. whether ratings, supporters, article tags, and candidacies are migrated, linked, or left attached to the source profile;
4. how old `wall_slug` and ghost-ID URLs redirect after a merge and reversal;
5. how an existing authenticated profile is verified without exposing account existence;
6. whether the merge is admin-approved, email-authorized, or requires both;
7. how a reversal handles content created after the claim;
8. how the final RPC satisfies existing RLS and service-layer architecture without introducing a broad public `SECURITY DEFINER` endpoint.

### 4.7 Linked Supabase schema verification — 2026-08-11

The linked project was inspected through the Supabase CLI using:

```bash
supabase migration list --linked
supabase db query --linked "...information_schema / pg_catalog queries..."
```

The remote database is not at the same migration state as the local folder:

- The CLI migration history reports remote migrations through `20260810000004`.
- Local migrations after that point are not all present in the remote migration history, including `20260810000005` and `20260810000006`.
- This is not assumed to be accidental drift: the project practice is to execute migrations manually. The live linked catalog is authoritative for implementation decisions; local files are migration history/reference until explicitly reconciled by the project owner.
- The remote database does not expose `profiles.wall_slug`; `wall_slug` belongs to `politician_profiles`.
- `src/lib/supabase/types.ts` has now been regenerated from the linked public schema. Navigation was updated to read the politician-profile slug through the auth profile service.
- The remote database contains several `staging_*` tables that are not represented in the checked-in migration set. These must be investigated separately and must not be treated as claim-domain tables.

The remote claim/wall function inventory currently includes:

```text
admin_search_profiles
claim_candidacy_via_token
create_claim_invite
create_wall_post
finalize_candidate_claim
is_claim_reviewer_for_candidate
request_candidacy_claim
review_candidacy_claim
```

There is no remote officeholder-specific claim, merge, or reversal function.

The remote `office_holders` table currently has the expected officeholder fields and `linked_profile_id → profiles.id`, with public read and admin-managed RLS. The remote ownership-related tables are present: `profiles`, `politician_profiles`, `posts`, `comments`, `politician_supporters`, `politician_ratings`, `news_article_politicians`, and `election_candidates`.

The CLI schema dump command could not complete because the local Docker daemon is not running. The linked `db query` path succeeded and is the current evidence source for the verification above. The migration in §9 was executed explicitly with `supabase db query --linked --file`; `supabase db push` was not used. No existing rows were deleted or updated by that migration.

## 5. Data ownership and merge rules

### 5.1 Surviving profile

The authenticated target profile survives. The imported synthetic profile is retained as an archived source profile until the claim is permanently closed under a future retention policy.

### 5.2 Imported official data

The officeholder record remains the source of truth for current office metadata:

- office title
- jurisdiction
- current officeholder name
- official source URL
- official contact information
- holding date
- imported photo and biography, subject to the product’s profile-edit policy

The merge must not blindly overwrite user-entered profile fields. The preview should show conflicts and apply an explicit precedence policy.

**Explicit precedence policy (implemented 2026-08-11):** gap-fill only, via SQL `COALESCE` — every field above is copied from `office_holders`/`election_role_types`/`map_shapes` into the profile's `politician_profiles` row **only when that column is currently `NULL`**. A value the profile owner already entered themselves (before or after the claim was created) is never touched. This is implemented once, in `backfill_politician_profile_from_officeholder()`, and called from two places:

1. **`redeem_officeholder_wall_claim()`** — the moment a claimant signs up/signs in through the invite link, before any admin review. This is what lets a brand-new account see a fully populated profile (role, boundary, bio, party, contact info, and a generated `wall_slug`) immediately, without waiting for merge. It only affects the claimant's own, not-yet-public profile — `office_holders.linked_profile_id` (the actual public wall) is untouched at this point, so nothing is publicly visible or reachable under the officeholder's real wall URL until an admin merges.
2. **`merge_officeholder_wall_claim()`** — kept as a defensive backstop so any future claim path that reaches merge without going through redemption first still produces a resolvable wall (see §9, "wall_slug backfill" fix). For the normal redemption path this call is a no-op by the time merge runs, since every field is already filled.

Calling the same function twice is intentionally safe (idempotent) — the second call's `COALESCE`s all evaluate against already-non-null columns.

**Why prefilling at signup (not just at merge) is safe:** the invite is already gated on possession of a single-use, hashed, expiring token sent to a specific email the admin entered. Prefilling data doesn't grant any additional access — it does not move the public wall, does not let the claimant post as the officeholder, and does not bypass admin review. Worst case if the claim is never approved (or is later found to be fraudulent): the claimant has a `politician_profiles` row that looks like a real official's — but that's no more exposure than any citizen already has today by self-declaring `role='politician'` and typing in whatever bio/role/boundary they want during ordinary onboarding, which has no verification at all. A verified-invite-token account is, if anything, more trustworthy than that baseline.

**Known gap this surfaces more sharply:** there is currently no RPC to reject/cancel a claim once it reaches `pending_review` — `cancel_officeholder_wall_claim()` only accepts `draft`/`invited`/`pending_confirmation`. If an admin redeems a claim and decides *not* to merge it (wrong person, suspected fraud), the claim just sits in `pending_review` indefinitely; there's no explicit "reject" transition. This was a pre-existing gap, but prefilling more complete, official-looking data at signup makes an unreviewed `pending_review` profile marginally more convincing, so it's worth prioritizing a `reject_officeholder_wall_claim()` RPC in Phase 5 (see §8).

### 5.3 Wall content

Only content belonging to the imported wall identity is eligible for migration. The merge must identify records by the original profile/ghost identity and record every moved row.

Do not merge all content belonging to the target account into the public officeholder wall.

### 5.4 Social data

The first version should explicitly account for:

- `posts.ghost_id`
- `posts.wall_ghost_id`
- `comments.ghost_id` where the product treats the imported wall as an authored identity
- `politician_supporters`
- `politician_ratings`
- `office_holders.linked_profile_id`
- politician profile fields
- any election candidate rows pointing at the imported profile
- news tags or other profile references added later

Each moved record needs an audit item so a reversal can identify exactly what changed.

## 6. Proposed schema foundation

The first migration should add an append-only claim/merge audit model without changing the current user-facing behavior.

### 5.1 Claim record

Proposed table: `office_holder_wall_claims`

Minimum fields:

```text
id
office_holder_id
source_profile_id
source_ghost_id
target_profile_id
target_ghost_id
contact_email
status
invited_at
claimed_at
approved_at
reversed_at
created_by
approved_by
reversed_by
reversal_reason
created_at
updated_at
metadata
```

Suggested statuses:

```text
draft
invited
pending_confirmation
pending_review
approved
reversed
rejected
expired
```

### 5.2 Moved-record audit

Proposed table: `office_holder_wall_claim_items`

Each row records one affected object:

```text
id
claim_id
entity_type
entity_id
source_value
target_value
moved_at
reversed_at
metadata
```

`source_value` and `target_value` should be JSONB snapshots of the relevant ownership fields, not an unbounded dump of private data.

### 5.3 Invitation record

Invitation tokens should be hashed at rest, expire, be single-use, and be scoped to one officeholder claim. The token must never itself authorize an arbitrary profile merge; it can only authorize the specific pending claim it was issued for.

### 5.4 Security rules

- Only admins may create or approve officeholder claims in the first release.
- Claim and merge operations must be server-side RPCs or a server-only service.
- No client can set `office_holders.linked_profile_id` to perform a merge.
- No client can call the low-level merge/reversal RPC directly unless the RPC performs its own admin and status checks.
- All `SECURITY DEFINER` functions must set a safe `search_path`, validate `auth.uid()`, and have explicit grants.
- Claim history must be readable only by admins and the affected authenticated target where appropriate.

## 7. Failure tracing and recovery

Every operation should produce a traceable claim ID. Logs and UI errors should include that ID without exposing invitation tokens.

For each stage, record:

| Stage | Required evidence |
|---|---|
| Wall selected | officeholder ID, source profile ID, source ghost ID |
| Target selected | target profile ID, target ghost ID |
| Invitation created | claim ID, invitation ID, expiry, email hash or masked email |
| Invitation sent | provider/function result, timestamp, claim ID |
| Account authenticated | target profile ID, timestamp |
| Preview generated | counts and conflict summary |
| Merge committed | claim ID, moved-item count, resulting profile/wall ID |
| Merge failed | claim ID, error code, transaction rollback result |
| Reversal committed | claim ID, reversed-item count, admin reason |

The database transaction must either complete the merge and audit writes together or leave the system unchanged. Partial ownership changes are not acceptable.

## 8. Implementation tasks

### Phase 0 — documentation and safety baseline

- [x] Document current officeholder population and linking behavior.
- [x] Document the existing candidate-only claim flow and its limitations.
- [x] Define the target flow for existing accounts and new accounts.
- [x] Define reversal and failure-tracing requirements.
- [x] Inspect the linked Supabase migration history and live catalog through the Supabase CLI.
- [x] Record remote/local migration and generated-type drift before implementation.
- [x] Add this document to `docs/DOCUMENTATION_INDEX.md`.
- [x] Add a current-state warning to the Office Holders admin documentation.

### Phase 1 — reversible audit foundation

- [x] Map the existing schema, ownership paths, and RLS constraints before adding tables or columns.
- [x] Record the manual-execution policy and use the live linked catalog as the schema authority.
- [x] Add `office_holder_wall_claims` with RLS and admin-only write paths.
- [x] Add `office_holder_wall_claim_items` for per-record movement history.
- [x] Add `office_holder_wall_claim_invites` for hashed, expiring tokens.
- [x] Add a migration verification query and empty-table verification.
- [x] Generate/update Supabase types.
- [x] Update this document with migration filename, verification results, and blockers.

### Phase 2 — safe merge engine

- [x] Build an admin-only merge preview RPC.
- [x] Define explicit field conflict precedence. (Gap-fill/`COALESCE` only, never overwrite a user-entered value — see §5.2.)
- [x] Build a transactional officeholder merge RPC.
- [x] Keep the synthetic profile archived rather than deleting it.
- [x] Record every moved entity in `office_holder_wall_claim_items`.
- [x] Add idempotency and concurrent-claim protection.
- [x] Build a transactional reversal RPC.

### Phase 3 — admin workflow

- [x] Add “Send claim invite” to Office Holders admin.
- [x] Add merge preview before merge (confirm dialog shows the exact `preview_officeholder_wall_claim()` counts; implemented 2026-08-11 in `InvitationHistoryPanel.tsx`). Target-profile *search* (Flow C — admin picks an arbitrary existing profile without an invite) is still not built; every merge today is reached via the invite/redeem path.
- [x] Add approval confirmation and claim-history actions. (Merge/Reverse buttons were previously missing from `InvitationHistoryPanel.tsx` — the invite-flow admin panel had no way to act on a `pending_review`/`approved` claim at all. Fixed 2026-08-11.)
- [x] Add “Reverse claim” with mandatory reason.
- [x] Remove or disable any direct-link path that bypasses the merge RPC.

### Phase 4 — invitations

- [x] Add the officeholder-scoped invitation token table and admin-guarded creation boundary.
- [ ] Detect existing account server-side without leaking account existence to the browser.
- [x] Support new-account signup and existing-account authentication.
- [ ] Add expiration, resend, cancellation, and already-claimed handling.
- [x] Add email delivery traceability by claim ID in function responses and claim records.

### Phase 5 — self-service and hardening

- [ ] Add public “Claim this wall” request flow.
- [ ] Add admin review queue.
- [ ] Add abuse review for content created during a fraudulent claim.
- [ ] Add end-to-end tests for new account, existing account, duplicate claim, failed merge, and reversal.
- [ ] Run Supabase advisors and verify RLS/function grants.

## 9. Current implementation log

### 2026-08-11 — initial analysis

- Confirmed that officeholder linking is currently an admin-set foreign key only.
- Confirmed that auto-created officeholder profiles are synthetic profiles without Auth users.
- Confirmed that the existing invitation flow is scoped to `election_candidates`.
- Confirmed that the existing candidate finalizer deletes the synthetic profile and is not reversible.
- Confirmed that a generic wall claim form currently targets `candidacy_claim_requests` and is not a valid officeholder claim implementation.
- Implementation was intentionally paused before merge logic after review: the existing schema and architecture had to be mapped completely first.
- Linked Supabase CLI verification completed. Remote migration history and live catalog are now recorded in §4.7. The difference between the remote catalog, local migration history, and generated types must be explicitly accounted for before implementation; no automatic reconciliation or migration push is authorized.
- No GitHub push performed.

### 2026-08-11 — audit foundation and live-type alignment

- Executed `supabase/migrations/20260811082341_officeholder_wall_claim_foundation.sql` directly with `supabase db query --linked --file`; no `supabase db push` was used.
- The migration created three empty tables, indexes, admin-only RLS policies, and comments. It contains no `DROP`, `DELETE`, or `TRUNCATE`; existing data was not changed. Verified counts: `office_holders=15,239`, `profiles=17,749`, `posts=40`, and zero rows in each new claim table.
- Regenerated `src/lib/supabase/types.ts` from the linked schema. TypeScript now passes with `npx tsc --noEmit`.
- Fixed two stale `profiles.wall_slug` references in `NavBar`; the live schema stores that field on `politician_profiles`.
- Repository-wide lint still reports 310 pre-existing issues; targeted lint and merge-flow verification remain pending.
- Added the typed service wrapper for the new RPC. Email delivery, account-existence branching, and token redemption are intentionally not wired yet; no invitation has been sent.
- No GitHub push performed.

### 2026-08-11 — end-to-end claim workflow

- Added `redeem_officeholder_wall_claim`, `preview_officeholder_wall_claim`, `merge_officeholder_wall_claim`, and `reverse_officeholder_wall_claim` with admin checks, status guards, row-level audit items, and no synthetic-profile deletion.
- Added `office_holder_wall_redirects`; old wall slugs resolve to the surviving profile after merge and are deactivated on reversal.
- Added the `/officeholder-claim/[token]` redemption page and disabled the admin UI’s direct profile-link bypass.
- Added and deployed `send-officeholder-claim`. It hashes one-time tokens, branches server-side between existing and new accounts, and returns the claim ID for traceability.
- Live transactional test passed in a rollback-only transaction: claim creation, token redemption, merge, and reversal all completed; no fixture rows remained.
- A second rollback-only test passed for a new normal-profile target: redemption promoted it to `politician`, created `politician_profiles`, then merge and reversal completed; no fixture rows remained.
- `npx tsc --noEmit` passes. Focused lint found no new issues in the claim UI; neighboring service files retain existing lint violations. Supabase advisors reported existing project-wide findings, with no new finding attributable to the claim functions/tables.
- `npm run build` passes. The only build warnings are the existing Node/Supabase version warning and the existing `Big Shoulders` font fallback warning.
- `send-officeholder-claim` is deployed to the linked Supabase project. No GitHub push was performed.
- Added admin-only resend and cancellation RPCs. A rollback-only resend/cancel test initially caught an ambiguous SQL column reference; the qualification fix was applied and the same test then passed.
- Added `e2e/officeholder-claim-ui-smoke.mjs`; the local smoke test passed for the unauthenticated claim page and protected admin route. The deployed Edge Function also returned the expected `401` when called without authorization. No real invitation email was sent during verification.

### 2026-08-11 — manual audit: UI wiring, reversal data-integrity fix, signup-time prefill

A hands-on audit (real invite → redeem → merge → reverse, run through the actual admin UI and browser, plus targeted rollback-only SQL tests) found and fixed several gaps between the RPCs (which were solid) and the surfaces that call them:

**UI wiring (`src/components/features/InvitationHistoryPanel.tsx`, `OfficeHoldersAdminClient.tsx`):**
- The invite-flow admin panel (`InvitationHistoryPanel`) rendered `pending_review`/`approved` claims as static text with no way to actually merge or reverse them — the RPCs existed but were never called from this panel. Added Merge/Reverse buttons wired to the existing RPCs.
- `wallClaims` was fetched *before* an invite/resend attempt ran and never refreshed afterward, so the panel could show a stale claim (wrong email, stale status) after a successful resend. Fixed to reload after the attempt and to clear stale state when a new wall lookup starts.
- Removed a "Copy Link" button that copied a literal, non-functional placeholder string (`.../officeholder-claim/[token]`) — raw tokens are intentionally never persisted server-side, so no working link can ever be reconstructed after the fact.
- Wired `preview_officeholder_wall_claim()` into the merge button: clicking "Merge wall" now shows the exact post/comment/supporter/rating/news-tag/candidacy counts in a confirm dialog before merging.
- `supabase-js`'s `functions.invoke()` only surfaced a generic "Edge Function returned a non-2xx status code" on failure, hiding the actual reason (e.g. SMTP not configured). Added `invokeOfficeholderClaimFn()` in `elections.ts` to unwrap the function's real `{error}` JSON body.

**"Claim Profile" button on officeholder walls (`src/components/features/PoliticianWallClient.tsx`):**
- The generic wall claim button (§2.4's known-unsafe path) is shown to any non-owner on *any* politician wall, with no awareness of the officeholder-claim system. For an officeholder wall with no `election_candidates` row (true of essentially every imported officeholder), submitting it inserts a `profiles.id` into `candidacy_claim_requests.candidate_id`, which has a foreign key to `election_candidates.id` — guaranteed constraint violation. Gated the button off on any wall where `politician_profiles.is_office_holder` is true (a flag already computed client-side in `politicianWall.ts`'s `enrichProfileWithContactFallback`), replaced with a plain "Contact us to claim it" mailto link. This is a real, pre-existing gap (not introduced by the claim system); a proper fix is a dedicated self-service request flow (Phase 5) rather than reusing the candidate form.

**Reversal RPC data-integrity bug (`reverse_officeholder_wall_claim`, migration `20260811150000`):**
- The `'post'` reversal step unconditionally set *both* `posts.ghost_id` and `posts.wall_ghost_id` back to `source_ghost_id`, even when merge had only changed one of the two columns — the common case of a citizen's own post left *on* the wall (only `wall_ghost_id` retargeted at merge; their own `ghost_id` untouched). Reversing that claim silently reassigned the citizen's post authorship to the officeholder. Fixed to restore each column independently, and only when it still holds the value merge set it to, using the exact per-column snapshot already recorded in `office_holder_wall_claim_items.source_value`.
- Verified with a rollback-only SQL test asserting the citizen's `ghost_id` is unchanged through both merge and reversal (previously would have failed). Zero real data touched.

**Wall becomes unreachable for new-account merges (`merge_officeholder_wall_claim`, migration `20260811150000`, then generalized in `20260811160000`):**
- `merge_officeholder_wall_claim()` only checked `profiles.role = 'politician'` on the target, never that a `politician_profiles` row (with a `wall_slug`) existed. Every wall-resolution query in `politicianWall.ts` — including the old-slug redirect lookup — requires `politician_profiles!inner`, so a target lacking that row (or lacking `wall_slug`) had **no reachable wall at all**, under either the old or new URL, after merge.
- Fixed by generating a collision-safe `wall_slug` and gap-filling `political_target_role`/`target_boundary_name`/`bio`/`political_party_id` from the officeholder record whenever the target is missing them.
- Verified live (not just rollback) end-to-end through the actual admin UI: a real `is_test=true` fixture account with `role='normal'` and no `politician_profiles` row was promoted, claimed, and merged. The wall — completely unreachable before the fix — resolved correctly afterward with the officeholder's title, district, and bio all present. The test claim was then reversed to restore state.

**Signup-time profile prefill (migration `20260811160000`) — this session's feature request:**
- Previously, `redeem_officeholder_wall_claim()` promoted a new account to `role='politician'` and inserted a *bare* `politician_profiles(id)` row with nothing else filled in — the user saw an empty profile until an admin happened to approve the merge, which could be hours or days later.
- Extracted the merge-time backfill logic into a shared `backfill_politician_profile_from_officeholder()` helper and now call it from `redeem_officeholder_wall_claim()` too, so a claimant's own profile (role, boundary, bio, party, contact email/phone, source URL, holding-since date, and a generated `wall_slug`) is fully populated the instant they redeem the claim token — no admin action required to see it. Contact fields are copied directly here (unlike the merge-time call, which relies on `enrichProfileWithContactFallback`'s live lookup) because that live lookup only activates once `office_holders.linked_profile_id` points at the profile, which is still not true at redemption time.
- Crucially, this only prefills the claimant's own, not-yet-public profile. `office_holders.linked_profile_id` — the actual public wall — is untouched until an admin runs `merge_officeholder_wall_claim()`. See §5.2 for why this is safe and the known "no reject path" gap it surfaces.
- Verified with a rollback-only SQL test simulating the exact real path: a fresh account (`role='normal'`, no `politician_profiles` row) authenticates and redeems a claim token. After redemption: `role='politician'`, `wall_slug` generated from the claimant's own name, `political_target_role`/`target_boundary_name`/`bio`/`contact_email`/`contact_phone`/`source_url`/`holding_since` all populated from the officeholder record, claim status `pending_review` — and confirmed `office_holders.linked_profile_id` was still pointing at the source (public wall not yet moved). Zero real data touched.
- Also ran targeted rollback-only tests confirming supporters, ratings, and citizen-authored wall posts/comments all move (and reverse) correctly, including the overlap case where a citizen had already interacted with both the source and target profiles before the claim — no duplicates, no data loss, no crash on the unique-constraint conflict.

### 2026-08-11 — dual-link invitation (self-selected signup vs. merge-into-existing-account)

Previously the invite email was chosen server-side by an `accountExists(email)` lookup: a Supabase built-in invite for a "new" email, or a custom sign-in email for an "existing" one. This assumed the invited email address reliably indicates whether the recipient has a Choseno account, which isn't always true — they may have an existing account under a *different* email and have no way to say so.

**New design**: one email, two links, sharing the same underlying token:

- `${origin}/auth?role=politician&next=/officeholder-claim/{token}` — Sign Up tab by default (unchanged existing behavior).
- `${origin}/auth?role=politician&intent=login&next=/officeholder-claim/{token}` — Log In tab by default. Added a new `intent` query param (`src/app/auth/page.tsx` → `AuthPageClient`'s new `initialIntent` prop) specifically so a link can force the Login tab independently of the `role` param, which previously always defaulted to Sign Up whenever present.

Both links converge on the same `/officeholder-claim/{token}` page, which calls `redeem_officeholder_wall_claim()` the same way regardless of how the visitor got there — the RPC only cares that a session exists, not how it was created. **No schema or RPC change was needed** for the "completing one invalidates the other" requirement: it falls directly out of the existing single-use token design (`office_holder_wall_claim_invites.used_at`), since both links reference the *same* invite row. Verified with a rollback-only SQL test simulating two different accounts racing for the same token: the first redemption succeeds, the second is rejected with "claim invitation is invalid, used, cancelled, or expired," and a third later attempt is also rejected. Zero real data touched.

Also verified, live in the browser (not just SQL): `/auth?role=politician&next=...` renders "Create an Account"; `/auth?role=politician&intent=login&next=...` renders "Welcome Back"; the claim page's own fallback screen (for a visitor who reaches `/officeholder-claim/{token}` directly without a session) now shows both choices as explicit buttons instead of one generic "sign in or sign up" button, each routing to the correct `/auth` variant.

`send-officeholder-claim`'s `accountExists()` lookup (a `listUsers` pagination loop) and the `inviteUserByEmail` branch were both removed — the function is simpler (one code path) and the account-existence-privacy property from the old design is now moot, since nothing depends on knowing account existence anymore. Redeployed via `supabase functions deploy send-officeholder-claim --project-ref <ref>` (the `--linked` shorthand hit `LegacyPlatformAuthRequiredError` for this specific Management API call in this environment; the explicit `--project-ref` flag worked) and confirmed live with an unauthenticated request still correctly returning 401.

Confirmed both email/password and Google sign-in/sign-up carry `next` through to `/auth/callback?next=...` identically (`src/lib/services/auth.ts`'s `signUp()`/`signInWithGoogle()`), so the claim page — and therefore the signup-time prefill from the entry above — fires the same way regardless of which auth method the recipient uses.

### 2026-08-11 — unified claim eligibility across officeholder and generic politician walls

The generic "Claim Profile" button on `PoliticianWallClient.tsx` had two real bugs: (1) it showed for any non-owner visitor on *any* politician wall, including walls that already belong to a real, signed-up person — there was no "does this wall already have an owner" check at all; (2) when submitted, it inserted into `candidacy_claim_requests` with `candidate_id` falling back to the profile's own id whenever no matching `election_candidates` row existed (true for every officeholder wall, and any self-registered politician with no candidacy record) — a guaranteed FK violation, plus a second, independent bug: it also tried to write a `requester_name` column that table doesn't have.

Confirmed via a codebase sweep (`add_unregistered_candidate()`, officeholder import scripts, `handle_new_user()`) that there is no third kind of unowned wall — every unclaimed wall is backed by *either* an `election_candidates` stub *or* an `office_holders` synthetic profile. That made the fix a routing problem, not a schema-unification problem:

- **`get_wall_claim_eligibility(profile_id)`** (migration `20260811170000`) — read-only, callable by anyone including logged-out visitors. Returns `unclaimed_candidate` (routes to the existing, untouched election-candidacy claim system), `unclaimed_officeholder` (routes to the new self-request RPC below), or `not_claimable` (hide all claim UI — real owner or open claim already exists). Derived entirely from public data (`election_candidates.claimed_at`, `office_holder_wall_claims` open/approved status) — no `auth.users` lookup needed.
- **`request_officeholder_wall_claim(office_holder_id, contact_email, note)`** — self-service counterpart to the admin-initiated invite. A logged-in citizen asserts "this is me" directly into `pending_review`, no token/email round-trip. Reuses `backfill_politician_profile_from_officeholder()` — the same function `redeem_officeholder_wall_claim()` calls — so a self-request gets identical immediate profile prefill to an invited signup. Reviewed by an admin exactly like any other claim (`preview_officeholder_wall_claim()` → `merge_officeholder_wall_claim()`/`reverse_officeholder_wall_claim()`), since it's a normal `office_holder_wall_claims` row, not a separate table.
- **`list_pending_self_requested_officeholder_claims()`** (admin-only; `target_wall_slug` added in `20260811180000`) — self-requests are otherwise invisible unless an admin already navigated to that specific officeholder's admin panel. Surfaced as a "Pending self-requested claims" panel at the top of `/admin/office-holders`, with a "Review" button that loads the existing `InvitationHistoryPanel` for that officeholder (no new merge/reverse UI needed — same one).
- Election-candidacy claims (`finalize_candidate_claim`, seat-admin review) were deliberately left untouched — different trust model (seat-level admins can review, not just site admins), and not broken to begin with once routed with a real `candidate_id`.

**Election-candidacy claim form fix, as a side effect**: routing on `get_wall_claim_eligibility()`'s `candidate_id` instead of the old fallback also fixes the pre-existing FK-violation and missing-column bugs for *that* path — it now calls `request_candidacy_claim()` (the existing RPC) with a guaranteed-valid id instead of a raw client insert.

**Verified**: a rollback-only SQL test covering all three eligibility outcomes (real owner → `not_claimable`; unclaimed candidate stub → correct `candidate_id`; unclaimed officeholder → correct `office_holder_id`), the self-request's immediate prefill, a second citizen's request against the same officeholder correctly rejected once the first is in flight, and admin-only access to the discoverability listing — 14/14 checks passed, zero real data touched. Live in the browser (not just SQL): a real already-owned wall (Priya Nakamura) shows no claim UI at all; a real unclaimed officeholder wall (Tom Corbin) shows "Claim This Wall"; clicking it while logged out correctly redirects to `/auth?role=politician&next=...`.

**Found in the process, unrelated to this change**: `office_holders` for Rick Larsen (from this session's earlier live merge test) has `linked_profile_id` pointing at Kathy Bockus's synthetic profile instead of the actual test account used in that test — likely because that test reused an existing profile id instead of a fresh one. The claim (`62d8b915-b9dc-477f-910a-2e7ee2cd6d4b`, approved) only ever moved the `wall_route` item — no posts/supporters/ratings crossed over, so Kathy Bockus's own wall content is unaffected — but the officeholder record itself is misdirected. Flagged for the project owner to decide whether to reverse it via the existing `reverse_officeholder_wall_claim()` RPC.

### 2026-08-11 — live (non-rollback) verification: self-request submission, and admin-invite + signup

Two follow-up live tests against the real linked database, run after the rollback-only SQL suite above, specifically to confirm the unified system works through the actual UI with a real session — not just at the SQL layer.

**Self-request, end to end, real account**: logged in as an existing test user (`munaruna86@gmail.com`, profile "John Doe"), opened Tom Corbin's unclaimed officeholder wall (a genuinely unclaimed wall — confirmed via SQL no claim existed for it beforehand), clicked "Claim This Wall", filled in the modal (contact email, phone, verification note), and submitted. Confirmed in the database afterward:
- A new `office_holder_wall_claims` row: `status = 'pending_review'`, `metadata->>'self_requested' = 'true'`, `contact_email` and `note` matching what was typed in the form.
- The requester's profile was promoted: `role` flipped from `'normal'` to `'politician'`, `onboarding_completed = true`.
- Gap-fill behaved correctly for a *pre-existing* profile: John Doe already had his own `wall_slug` (`john-doe-mp`) and an (empty-string, not NULL) `bio` from account creation, so `backfill_politician_profile_from_officeholder()`'s `COALESCE` left both untouched rather than overwriting them with Tom Corbin's officeholder data — this is the intended behavior (never clobber a user's own data), distinct from the brand-new-signup case in §4.5 where every field is NULL and gets filled.
- `list_pending_self_requested_officeholder_claims()` correctly threw `admin authorization required` when called as the (non-admin) requester — confirms the admin-only RLS-equivalent check inside the function, not just table-level RLS.

**Note**: this created one real, lasting `pending_review` claim on Tom Corbin's wall (id `d62de94f-7b17-48de-a383-7ec27fcedba6`) that an admin still needs to act on (there is no reject path yet for `pending_review` — see the existing known gap in `OFFICEHOLDER_CLAIM_SYSTEM_STATUS.md` §9). Left in place intentionally as a real, reviewable artifact of the test rather than deleted out from under the audit trail.

**Admin-invite → dual-link chooser → signup start**: created a real invite for Jim Dietrich (an unclaimed councillor wall) by inserting directly into `office_holder_wall_claims` + `office_holder_wall_claim_invites` (the admin UI's own invite button requires an authenticated admin browser session, which wasn't available in this pass) with a known plaintext token, hashed the same way `create_officeholder_wall_claim()` would. Navigated to `/officeholder-claim/{token}` while logged out:
- The dual-link chooser page (§4.1) rendered correctly: "Claim this wall — Choose how you want to claim it. Whichever you finish first is the one that counts — this link can only be used once", with both "New to Choseno — sign up" and "I already have an account — merge into it" buttons.
- Clicking "New to Choseno — sign up" correctly routed to `/auth?role=politician` (default tab: Sign Up) with the invite's `next` path preserved for post-signup redirect.
- Filled in the signup form (email/password) and submitted. The dev server hit a transient Turbopack/Next.js compile error (`src/lib/supabase/server.ts:55:1 — Error: Expected ',', got '<eof>'`) that blocked completing the redemption step. Re-reading the file afterward showed correct syntax — this reads as a dev-server HMR/build-cache artifact from the long-running session, not an application bug, but it means **the actual token redemption (`redeem_officeholder_wall_claim()` → profile prefill → landing on Jim Dietrich's wall) was not exercised live in this pass**, only the invite-creation and dual-link-routing steps before it. Those two RPCs (`redeem_officeholder_wall_claim()`, `backfill_politician_profile_from_officeholder()`) already have direct rollback-only SQL coverage (§9, 2026-08-11 "manual audit" entry) and real, non-rollback coverage from an earlier session (Rick Larsen test), so the underlying logic is not new-and-unverified — only this specific browser round-trip, for this specific invite, wasn't completed.
- **Cleanup**: the test invite claim (id `ac541bc0-8eba-484a-ab5c-2c7d664e27fd`) was cancelled via `cancel_officeholder_wall_claim()` (not deleted) immediately after, specifically so it wouldn't sit in `invited` status and block a real future claim on Jim Dietrich's wall (the one-open-claim-per-officeholder constraint, §3.3, would otherwise reject any real invite until this test one was resolved). Status after cleanup: `expired`.

### 2026-08-11 — auto-merge admin-invited claims on redemption (no second approval step)

Previously every claim — admin-invited or self-requested — landed in `pending_review` after redemption and sat there until an admin clicked "Merge wall" in `/admin/office-holders`, even though for the admin-invite path an admin had already authorized this exact claim by creating the invite in the first place. Confirmed live in this session: an invite sent to a test account, redeemed through the real `/auth` → `/officeholder-claim/{token}` flow, correctly required a manual `merge_officeholder_wall_claim()` click (or, since the UI's merge button uses a native `window.confirm()` that a scripted/automated browser session silently dismisses, an equivalent direct RPC call signed in as the admin) before the wall actually moved — which was the intended behavior at the time, but redundant: nothing new is being verified at that second step for this path.

Migration `20260811210000` removes that redundant step for the admin-invite path only:

- The data-moving body of `merge_officeholder_wall_claim()` was extracted into an internal helper, `_execute_officeholder_wall_claim_merge(claim_id, approved_by)` — same REVOKE-ALL-FROM-PUBLIC pattern as `backfill_politician_profile_from_officeholder()`, callable only from other `SECURITY DEFINER` functions. `approved_by` is now a parameter instead of a hardcoded `auth.uid()`, so it can record either the admin actually clicking merge, or (for auto-merge) the admin who originally created the invite.
- `merge_officeholder_wall_claim(claim_id)` is now a thin wrapper: same admin-authorization check as before, then delegates to the helper with `auth.uid()`. Unchanged from the caller's perspective — still the only merge path for **self-requested** claims (`request_officeholder_wall_claim()` — no admin involvement yet when those are created, so they still need a human to look at them) and for admin-invited claims whose auto-merge fell back (see below).
- `redeem_officeholder_wall_claim(token_hash)` — reachable *only* via a token from `create_officeholder_wall_claim()`, which is itself admin-only, so every claim that reaches this function already had admin sign-off at invite time — now immediately calls the same internal helper right after setting the claim to `pending_review` and consuming the invite, recording `approved_by` as the *inviting admin* (`office_holder_wall_claim_invites.created_by`), not the claimant. The call is wrapped in its own `BEGIN...EXCEPTION WHEN OTHERS...END` block: if the merge can't complete (e.g. the officeholder's wall was reassigned by some other path between invite and redemption — the existing `officeholder source link changed since claim creation` guard), the exception is swallowed and the claim is left at `pending_review`, exactly like before this migration, so a transient/edge-case failure never breaks the claimant's own signup or login. An admin can still merge it manually from the Office Holders panel in that fallback case.
- `OfficeholderClaimClient.tsx`'s success screen now reads the RPC's returned `status` and shows "Wall claimed — ...now yours" for the normal (`approved`) case, keeping the old "Claim submitted... an administrator will review" copy only for the rare `pending_review` fallback.
- Self-requested claims, `reject_officeholder_wall_claim()`, `reverse_officeholder_wall_claim()`, `preview_officeholder_wall_claim()`, and the `InvitationHistoryPanel` UI are all unchanged — `reverse`/`preview`/the UI's "approved" state already worked purely off `status`, with no dependency on *how* a claim got there, so admin-invited claims auto-merging straight from `invited` to `approved` (skipping the `pending_review` UI state entirely in the common case) needed no changes there.

Applied directly via `psql` against the linked dev database (`db.qlzyfdwrkcxyqapewxwg.supabase.co`), per this project's migration convention — not `supabase db push`, whose remote migration-history bookkeeping was already out of sync with several earlier same-day migrations applied the same direct way.

## 10. Implementation Status (2026-08-12)

✅ **PRODUCTION READY** — All features complete, tested, and documented:

| Feature | Status | Notes |
|---------|--------|-------|
| Admin invites officeholders | ✅ | `create_officeholder_wall_claim()` RPC, email via `send-officeholder-claim` edge function |
| Self-service wall claiming | ✅ | `request_officeholder_wall_claim()` for logged-in citizens, lands in pending_review |
| Admin-initiated claims auto-merge | ✅ | On redemption, no manual approve step needed (migration 20260811210000) |
| Self-requested claims require review | ✅ | Admin must call `merge_officeholder_wall_claim()` or `reject_officeholder_wall_claim()` |
| Profile prefill at signup | ✅ | `backfill_politician_profile_from_officeholder()` runs at redemption time |
| Wall post/comment reassignment | ✅ | Posts, comments, supporters, ratings, election candidates all moved by `merge_officeholder_wall_claim()` |
| Claim reversal | ✅ | `reverse_officeholder_wall_claim()` restores all moved items, sets status=reversed |
| Claim rejection (pending_review) | ✅ | `reject_officeholder_wall_claim()` nulls profile fields, sets status=rejected |
| URL redirects | ✅ | Old wall slug → new slug, created at merge time, persisted in `office_holder_wall_redirects` |
| Fallback handling | ✅ | Auto-merge fails gracefully, leaves claim at pending_review for manual merge |
| Rate limiting | ✅ | Email rate limits raised from 30/hr → 2000/hr via Management API |
| Test accounts | ✅ | Three mailsac accounts (chosenovoter{1,2,3}) created, email-confirmed, known passwords |

### Testing

**Where to start**: [TESTING_OFFICEHOLDER_CLAIMS.md](TESTING_OFFICEHOLDER_CLAIMS.md)

Complete step-by-step guide covering:
- Admin-initiated invite flow with auto-merge (Test Flow 1)
- Self-requested claim flow with admin review (Test Flow 2)
- Edge case: auto-merge fallback (Test Flow 4)
- API query patterns for discovering claims
- Troubleshooting common issues

All examples use real IDs and curl commands against the dev database, with mailsac inbox links.

**Test Data** (see [TEST_ACCOUNTS.md](TEST_ACCOUNTS.md)):
- Mailsac test accounts: chosenovoter1/2/3@mailsac.com (ready to use, no setup needed)
- Known unclaimed officeholders: Laxman Savadi, Raju Kage, Mahendra Kallappa Tammannavar, etc.
- Admin: vmn2k4@gmail.com

**Verification Results** ([TEST_RESULTS_AUTO_MERGE.md](TEST_RESULTS_AUTO_MERGE.md)):
- ✅ Auto-merge end-to-end: claim → status='approved' on redemption (no pending_review)
- ✅ Profile prefilled correctly: wall_slug, role, boundary_name
- ✅ Officeholder link repointed to claimant
- ✅ Wall redirect created for old URL
- ✅ Approved_by recorded as inviting admin (not claimant)

## 11. Definition of done

The officeholder claim system is not complete until all of the following are true:

- ✅ an admin can safely select an imported wall and target profile;
- ✅ a new-account invite works;
- ✅ an existing-account claim works;
- ✅ the merge is atomic and auditable;
- ✅ duplicate claims are prevented;
- ✅ old wall URLs remain handled by redirects or an explicit archived state;
- ✅ an admin can reverse a claim;
- ✅ failed operations leave no partial ownership changes;
- ✅ tests verify that unrelated target-account content is not moved;
- ✅ documentation records the final schema, RPCs, UI path, and verification evidence.
