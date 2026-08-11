# Officeholder Wall Claim, Merge, and Reversal

**Status:** Implemented — claim, invitation, merge, reversal, and redirect workflow live; hardening continues

**Owner:** Choseno admin / platform engineering

**Last updated:** 2026-08-11

**Scope:** Public walls created from scraped `office_holders` data. This is separate from, but should eventually share infrastructure with, the existing election-candidate claim flow.

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
Recipient confirms the claim
  ↓
Transactional merge attaches the wall to the new profile
  ↓
Admin can see the claim and merge audit history
```

The new account must become the surviving authenticated profile. The imported profile remains archived for reversal and audit; it is not immediately deleted.

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

Wall URLs resolve through `wall_slug` first, with fallback resolution through profile ID/current ghost ID. Any merge must preserve or redirect the old slug and avoid violating the unique slug indexes.

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
- [ ] Define explicit field conflict precedence.
- [x] Build a transactional officeholder merge RPC.
- [x] Keep the synthetic profile archived rather than deleting it.
- [x] Record every moved entity in `office_holder_wall_claim_items`.
- [x] Add idempotency and concurrent-claim protection.
- [x] Build a transactional reversal RPC.

### Phase 3 — admin workflow

- [x] Add “Send claim invite” to Office Holders admin.
- [ ] Add target-profile search and merge preview.
- [x] Add approval confirmation and claim-history actions.
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

## 10. Definition of done

The officeholder claim system is not complete until all of the following are true:

- an admin can safely select an imported wall and target profile;
- a new-account invite works;
- an existing-account claim works;
- the merge is atomic and auditable;
- duplicate claims are prevented;
- old wall URLs remain handled by redirects or an explicit archived state;
- an admin can reverse a claim;
- failed operations leave no partial ownership changes;
- tests verify that unrelated target-account content is not moved;
- documentation records the final schema, RPCs, UI path, and verification evidence.
