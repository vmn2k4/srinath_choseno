# Flutter Mobile App — Architecture & Screen-by-Screen Implementation Guide

Blueprint for a **Flutter companion app** to Choseno. Scope, fixed with the user: **full
parity with the website for citizens and politicians** — auth, onboarding, the Feed,
Profile, every write action (posting, voting, commenting, rating, supporting, running for
office, volunteering as an Election Administrator and managing a seat, claiming a
candidacy or an officeholder record) — **minus only the Admin panel**, which stays
web-only. There is no separate "mobile edition" of the product and nothing is trimmed for
convenience: this is the same app the web already serves to signed-in citizens and
politicians, built for a phone, with the seven `/admin/*` routes and the `role='admin'`
account type left out and nothing else.

Companion reading, not duplicated here: [SCREENS_AND_FEATURES.md](SCREENS_AND_FEATURES.md)
(every screen on the web, admin included), [SERVICES.md](SERVICES.md) (the web's
service-layer conventions — see its own "Flutter-port framing" section, which anticipated
this document), [SCHEMA_TABLE_INDEX.md](SCHEMA_TABLE_INDEX.md) /
[SCHEMA_RELATIONSHIPS.md](SCHEMA_RELATIONSHIPS.md) (full schema),
[AUTHENTICATION_FLOWS.md](AUTHENTICATION_FLOWS.md), and [../ARCHITECTURE.md](../ARCHITECTURE.md).

---

## 0. Scope

**Three account states drive the whole app, and the app must model all three:** signed-out
visitor, signed-in **Citizen** (`profiles.role = 'normal'`), signed-in **Politician**
(`profiles.role = 'politician'`). A citizen can switch to a politician account (and back)
from their own Profile at any time — it's a role flip on one account, not a separate signup
path, so the Flutter app doesn't need two different auth flows, just role-aware screens
after sign-in. The fourth role, **Admin**, is explicitly excluded — nowhere in this app does
a user see an Admin nav item, and no `/admin/*` table/RPC listed in `docs/ADMIN_FEATURES.md`
is called from this app.

### In scope

| Area | Screens | Who |
|---|---|---|
| **Public** (no account) | News list/article, Elections list, Boundary Directory, Seat Detail (read + video interviews), Candidacy Wall (read), Politician Wall (read), Find My District, global search, legal pages | anyone |
| **Auth** | Sign in / Sign up, Forgot Password, Reset Password | signed-out |
| **Onboarding** | Role select → Location → Username → (Politician only) Political Details | first-run, both roles |
| **Feed** | The main home screen once signed in — composer, tabs, video stories, vote/comment | Citizen + Politician (different composer capabilities, different sort order) |
| **Profile** | View + Edit (wizard reusing onboarding steps), Ghost ID tools, Civic Score | Citizen + Politician (different sections) |
| **Elections — write actions** | Nominate Yourself, Withdraw, "This is me" candidacy claim request, Rate a politician, Support/Follow a politician, volunteer as Election Administrator | Citizen + Politician (nomination is Politician-only) |
| **My Elections** | Candidacies dashboard, Election-Administrator applications, Open Seats Near You, Browse a Different Area | **Politician only** |
| **Candidate Application** | Statement, questionnaire, required intro video, per-answer video | **Politician only** |
| **Claim Candidacy** | Redeem an emailed claim-invite token | Politician (usually a brand-new signup) |
| **Officeholder Claim** | Redeem an emailed officeholder claim-invite token, or self-request "this is me" on an unclaimed officeholder wall | Politician |
| **Election Administrator tools** | Volunteer for the per-seat role; once approved, manage that seat directly from Seat Detail — Search & Send Interview Invite, Add Candidate Directly, Manage Candidates (remove), review Pending Claim Requests | Citizen + Politician (anyone can volunteer; capability activates once approved) |
| **Comments, votes, reports** | Post/comment anywhere a thread exists, upvote/downvote Feed posts, report content | Citizen + Politician |

### Out of scope

**Only the seven `/admin/*` routes** (Boundaries, Analytics, Elections lifecycle
management, Election Admins review queue, Visualizer, Theme, News authoring) and anything
gated to `profiles.role = 'admin'` specifically. Nothing else is skipped: every citizen- or
politician-facing interaction the website offers — including the **Election Administrator**
role (a per-seat volunteer capability any signed-in citizen/politician can apply for and,
once approved, use to manage that seat's roster: send interview invites, add stub
candidates, remove candidates, approve/reject "this is me" claim requests) and the
**Officeholder Claim** flow (a real elected official claiming their auto-generated wall) —
is a normal user action reachable from a public page, not part of the Admin panel, and
belongs in this app. The distinction that matters is the route, not who else happens to be
able to see the same panel: a site admin also sees the Election Administrator panel on any
seat without needing to be its approved administrator, but that's the *admin* getting a
bypass on a *user-facing* screen, not the screen becoming admin-only — build the
user-facing version (gated on `getSeatAdminStatus`/approval) and don't worry about
replicating the admin bypass, since this app has no admin role to begin with.

The only things genuinely left out are the **review side** of applications made *to* a site
admin specifically (the `/admin/election-admins` and `/admin/claim-requests` global review
queues — these list every pending application platform-wide for an admin to triage, distinct
from an election administrator managing their own one seat) and the officeholder-claim
**merge/reversal** admin tooling (`previewOfficeholderWallClaim`, `mergeOfficeholderWallClaim`,
`reverseOfficeholderWallClaim`, `listPendingSelfRequestedOfficeholderClaims` — all admin-only
RPCs, called only from `/admin/office-holders`).

---

## 1. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Flutter app (iOS/Android)                                        │
│                                                                     │
│  Screens (Public + Auth + Onboarding + Feed + Profile +           │
│           Elections + My Elections + Candidate Application)        │
│        ↓                                                           │
│  Repositories  (Dart port of src/lib/services/*.ts — one file      │
│                 per domain: news_, elections_, wall_, boundaries_, │
│                 politicians_, feed_, profile_, auth_,               │
│                 political_parties_, ratings_, moderation_repository)│
│        ↓                                                           │
│  supabase_flutter client — REAL session now (persistSession: true, │
│  auto token refresh), anon key + email/password auth               │
│        ↓                                                           │
└──────────────────────────────────────────────────────────────────┘
                          ↓  HTTPS / PostgREST + RPC + Realtime + Storage
┌──────────────────────────────────────────────────────────────────┐
│  Existing Supabase project (unchanged)                             │
│  Postgres + PostGIS · RLS (public read + `auth.uid()`-scoped write │
│  policies, already in place) · SECURITY DEFINER RPCs (create_post, │
│  create_comment, vote_on_post, apply_for_seat, ...) · Storage       │
│  (post-images, politician-avatars, videos)                         │
└──────────────────────────────────────────────────────────────────┘
```

**The backend is still completely unchanged.** Every write path below already goes through
either an RLS policy scoped to `auth.uid()` (e.g. "Authenticated users can insert posts") or
a `SECURITY DEFINER` RPC that enforces the real business rule server-side (rate limits,
cooldowns, ownership, "can't rate yourself") — exactly per
[CODE_LAYERS.md](CODE_LAYERS.md)'s rule that anything security- or correctness-critical
belongs in Postgres, not client code, "because client-side checks can always be bypassed."
That rule protects a Flutter client identically to how it protects the web client today —
neither app has to re-implement any of that logic, both just call the same RPC.

### Auth & session (new vs. the public-only design)
Use `supabase_flutter`'s real auth, not the anon-only pattern from a public-only build:

```dart
await Supabase.initialize(
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  authOptions: const FlutterAuthClientOptions(
    authFlowType: AuthFlowType.pkce, // required for a mobile app's deep-link callback
  ),
);
```
- **Sign up / sign in**: `supabase.auth.signUp(email:, password:)` /
  `signInWithPassword(...)` — direct 1:1 port of `src/lib/services/auth.ts`. Email+password
  only; the web has no other provider live in production copy despite a `signInWithGoogle`
  stub existing in the service file — verify against the current `/auth` page before
  building a Google button, don't assume the stub is wired up.
- **Password reset** is a two-hop deep link (`resetPasswordForEmail` → email link →
  `/auth/callback?next=/auth/reset-password` → a short-lived "recovery" session →
  `updateUser({password})`). A mobile app needs a **custom URL scheme or universal
  link** (e.g. `choseno://auth/callback`) registered so the emailed link reopens the app
  instead of a browser tab — this is the one piece of auth plumbing that's genuinely
  different from the web, not a straight port. `supabase_flutter`'s
  `Supabase.instance.client.auth.onAuthStateChange` fires `AuthChangeEvent.passwordRecovery`
  when that deep link lands, which is the trigger to show the "set new password" screen.
- **Session state**: mirror `AuthContext.tsx`'s shape as a Riverpod `AsyncNotifier` —
  `session`, `user`, `profile` (fetched via `fetchOrHealProfile()`, ported verbatim — it
  self-heals a missing `profiles` row on first login and folds in `politician_profiles.wall_slug`
  for politician accounts), `loading`. Subscribe to `onAuthStateChange` once at app root;
  **do not** re-fetch the profile on every `TOKEN_REFRESHED` for the same user id — the web
  code has a specific fix for exactly that redundant-refetch bug (a same-user token refresh
  or app-resume event must not flash a full loading state), worth carrying over so the app
  doesn't visibly "reload" every time it comes back from the background.
- **Route guarding**: every screen except the Public group and Auth itself requires a
  session; every screen except Onboarding itself additionally requires
  `profile.onboarding_completed = true`. Model this as `go_router` redirect logic reading
  the auth `AsyncNotifier`, the same job `ProtectedRoute`/`MainLayout` does on the web.

### Recommended Flutter stack (supersedes the public-only version of this doc)
| Concern | Recommendation | Notes |
|---|---|---|
| Backend + auth | `supabase_flutter` | Real session now — `persistSession: true` (the default), PKCE flow, deep-link redirect URLs registered for both the email-confirmation and password-recovery links. |
| State management | Riverpod (`flutter_riverpod`) | One root `AsyncNotifier` for auth/profile (mirrors `AuthContext`), per-screen `FutureProvider`/`AsyncNotifier` for everything else — same shape as before, now with a real global auth dependency other providers can `watch`. |
| Routing | `go_router` | Add the auth-required routes (`/feed`, `/onboarding`, `/profile`, `/politician/elections`, `/apply/:candidateId`, `/claim/:token`) to the route table from the public-only design, with `redirect:` guards per the rule above. |
| Forms | `flutter_form_builder` or hand-rolled `TextFormField` + validators | Sign up/in, Onboarding steps, Edit Profile, Candidate Application's questionnaire (4 answer types: single-select, multi-select, free-text, 1–5 rating). |
| Video recording | `camera` + `video_player`/`chewie` for playback | Required intro video (90s cap) on Candidate Application, optional per-answer video (per-question cap, default 30s, admin-set), Feed video pitches (Politician only). This is new work relative to the public-only build, which only ever *played back* video — recording, encoding to a web-compatible format, and uploading to Storage all need building. |
| Geolocation | `geolocator` | Onboarding's "Detect My Location" step, Edit Profile's re-detect, Find My District. |
| Image picking/upload | `image_picker` + Supabase Storage `upload()` | Post images (5MB cap, same as web), avatar upload. |
| Realtime | `supabase_flutter`'s `.channel().onPostgresChanges()` | Now genuinely useful, not just optional polish: an owner viewing their **own** Politician Wall gets the live "View Supporters" dashboard the web has (`subscribeToSupportChanges` in `politicianWall.ts`) — in scope now that authenticated, owner-specific views are in scope. |
| Local secure storage | `flutter_secure_storage` (supabase_flutter's default session storage) | No action needed beyond accepting the package default — just don't override it with plain `shared_preferences` for the session token. |

---

## 2. Slug & ID resolution (unchanged from the public-only design — still required)

Every shareable URL still uses a slug, not a raw UUID — see the full breakdown of
`slugifyText`, `buildPoliticianWallSlug`, `buildSeatSlug`, `buildCandidateSlug`,
`buildBoundarySlug`, `extractIdFromSlug` in `src/lib/utils/slugs.ts`. Port these regardless
of the auth-scope expansion; a signed-in user still opens the exact same shared links a
signed-out visitor would.

---

## 3. Schema — now the (almost) full public + own-account surface

Beyond the public-readable subset already covered (news, elections, seats, candidates,
questions/answers, posts/comments on public branches, map/office-holder data, ratings,
supporters — see the original table, unchanged), a signed-in app also touches:

| Table | Purpose | Access pattern |
|---|---|---|
| `profiles` | The signed-in user's own row (full read/write of their own row only — `auth.uid() = id`) | own-row RLS |
| `user_locations` | User's saved lat/lng | own-row RLS |
| `user_boundary_memberships` | Which boundaries the user belongs to (drives Feed tabs, "Open Seats Near You") | own-row RLS for writes; `sync_user_boundary_memberships`/`add_user_boundary_membership` RPCs own the actual writes |
| `politician_profiles` | Politician's own extended profile (party, bio, hometown, education, `wall_slug`) | own-row RLS (`auth.uid() = id`) |
| `posts` | Now also written to — Feed posts (`create_post` RPC), Wall posts (`create_wall_post` RPC), candidate posts (direct insert, see §6) | insert requires `auth.role() = 'authenticated'`; RPC path adds ghost-id resolution + rate limiting |
| `comments` | Written via `create_comment` RPC everywhere (Feed, Wall, Candidacy Wall, News article, per-answer threads) | RPC-only write (direct insert blocked by RLS per `docs/SERVICES.md`) |
| `post_votes` | Upvote/downvote on Feed posts | via `vote_on_post` RPC |
| `election_candidates` | Politician's own candidacy row — statement, intro video, withdraw | `auth.uid() = politician_id` scoped update/delete, insert via `apply_for_seat` RPC |
| `election_candidate_answers` / `_options` | Politician's own questionnaire answers | scoped to the candidate row the caller owns |
| `election_answer_comments` | Now also written to (voter discussion on a candidate's answer) | RPC (`create_answer_comment`) |
| `election_administrators` | A user's own volunteer application for a seat, and (once approved) that seat's full roster-management actions (add/remove candidates, review claim requests) | `apply_for_election_admin`/`get_seat_admin_status` RPCs to apply/check status; approved status then gates direct writes to `election_candidates` via `add_unregistered_candidate`/`remove_candidate` RPCs |
| `candidacy_claim_invites` / `candidacy_claim_requests` | Redeeming an emailed claim token, filing a "this is me" self-request, or (as an approved election administrator) reviewing requests on your own seat | `claim_candidacy_via_token`/`claim_candidacy_via_own_email`/`request_candidacy_claim`/`review_candidacy_claim` RPCs |
| `office_holder_wall_claims` | Redeeming an officeholder claim invite, or self-requesting "this is me" on an unclaimed officeholder wall | `redeem_officeholder_wall_claim`/`request_officeholder_wall_claim`/`get_wall_claim_eligibility` RPCs — the review/merge/reversal RPCs on this table stay admin-only |
| `politician_supporters` | Support/follow — insert scoped to `auth.uid() = supporter_id` | direct insert/delete, no RPC needed |
| `politician_ratings` | Rate a politician (1–5 stars + optional comment) | via `upsert_politician_rating`/`delete_politician_rating` RPCs (enforces no-self-rating + 6-month cooldown server-side) |
| `content_reports` | Reporting a post/comment/profile | via `report_content` RPC |
| `moderation_rules` | Read-only list of report reasons for the report-dialog dropdown | public read |
| `site_settings` (rule columns only) | Comment daily limit, politician daily post limit — read-only, used to show the right "you've hit your limit" message client-side (the RPCs enforce the real limit regardless) | public read |
| `political_parties` | Party dropdown for Onboarding's Political Details step and Edit Profile | public read |
| `election_role_types` | Role catalog (used indirectly via existing public reads) | public read |

`user_actions` and every genuinely Admin-panel-only write (`boundary_uploads` writes,
`country_boundary_types` writes, `entity_types` writes, moderation-queue admin actions,
`office_holder_wall_claims`/`office_holder_wall_redirects` **merge/reversal/global-review**
writes specifically — not the claim/self-request writes above, which are in scope) stay out.

---

## 4. Screen-by-screen inventory

### A. Public screens (unchanged from the original design)

These need no auth and were already fully specified in the original pass of this document —
News list/article, Elections list, Boundary Directory, Seat Detail (read side), Candidacy
Wall (read side), Politician Wall (read side, non-owner), Find My District, global search,
legal pages. Full detail — routes, exact web source files, table/RPC lists — is unchanged;
see §4 entries 4.1–4.12 as originally written. What's new in this revision is that **every
one of these screens also grows a write/interactive layer** once a session exists — covered
inline below rather than repeated as separate screens, since it's the same page with extra
capability, not a new route.

### B. Auth — `/auth`, `/auth/forgot-password`, `/auth/reset-password`
**Purpose:** Single form toggled between Sign In / Sign Up (one link at the bottom, no
separate screens); forgot/reset password as a two-step email-link flow.
**Web source:** [`src/app/auth/page.tsx`](../src/app/auth/page.tsx),
[`AuthPageClient.tsx`](../src/components/features/AuthPageClient.tsx),
[`ForgotPasswordClient.tsx`](../src/components/features/ForgotPasswordClient.tsx),
[`ResetPasswordClient.tsx`](../src/components/features/ResetPasswordClient.tsx).
**Data:** `auth.ts` → `signUp(email, password)`, `signInWithPassword(email, password)`,
`resetPasswordForEmail(email)`, `updatePassword(password)`; `profile.ts` →
`getFounderCount()` (drives a "be one of the first 1,000" nudge shown on the sign-up side —
purely cosmetic, safe to skip if not porting the founder-badge feature at all).
**Notes:** A brand-new account is **never** dropped straight into the app — the very next
screen is always Onboarding, gated by `profiles.onboarding_completed`. Build the deep-link
callback handling described in §1 before this screen is considered complete; without it,
"Forgot Password" is unusable on-device (the email link would open a browser to a page
expecting a browser session, not the app).

### C. Onboarding — `/onboarding`
**Purpose:** Required first-run flow. 3 steps for a Citizen, 4 for a Politician, gating
every other authenticated screen until done.
**Web source:** [`src/app/onboarding/page.tsx`](../src/app/onboarding/page.tsx),
[`OnboardingFlowClient.tsx`](../src/components/features/OnboardingFlowClient.tsx).
**Data:** `profile.ts` → `upsertProfileCore({role, fullName, country, constituency},
{onboardingCompleted:true})`, `upsertPoliticianProfile(...)` (politicians only),
`uploadAvatarImage()` (politicians only, optional); `boundaries.ts` →
`findBoundariesByPoint(lat, lng)` (RPC), `syncUserBoundaryMemberships(lat, lng)` (RPC — the
actual persistence step) with a manual fallback path (`searchMapShapesByName` +
`addUserBoundaryMembership`, or raw lat/lng entry); `politicalParties.ts` →
`getPoliticalParties({country})` (Politician step 4 only).
**Steps (build as a 4-step `PageView`/stepper, step 4 conditionally skipped for Citizens):**
1. **Role** — Citizen or Politician; advances immediately on tap, no confirm button.
2. **Location** — "Detect My Location" (`geolocator` → `findBoundariesByPoint`) resolves
   **every** boundary the point falls inside, not just one; matched boundaries render as
   chips. Manual fallback: search-by-name or raw lat/lng entry.
3. **Username** — Citizen: optional display name + a plain-language Ghost ID explainer
   (screen copy only, no extra data call). Politician: **required** public full name
   ("this will appear on your public Wall").
4. **Political Details** (Politician only) — party dropdown (scoped to the country
   resolved in step 2), education, hometown, free-text bio/platform. No office is chosen
   here.
**Notes:** On submit, the web hard-reloads to `/feed` — in Flutter, just navigate + let the
Riverpod auth provider's `refreshProfile()` equivalent re-fetch so `onboarding_completed`
flips and the route guard stops redirecting here.

### D. Feed — `/feed`
**Purpose:** The main citizen/politician home screen once signed in — everything scoped to
the boundaries the user belongs to. **This is the single largest screen to build** (the web
component is 1,000+ lines) and the one with the most role-conditional behavior.
**Web source:** [`src/app/feed/page.tsx`](../src/app/feed/page.tsx),
[`FeedPageClient.tsx`](../src/components/features/FeedPageClient.tsx).
**Data:** `profile.ts` → `getOwnProfile`, `getUserBoundaryMemberships`,
`calculateMyScore()` (RPC — Civic Impact Score), `getPoliticianProfileFull` (politicians);
`boundaries.ts` → `getBoundaryTypesForCountries` (ranks tabs by boundary specificity);
`feed.ts` → `getMembershipScopedPosts(shapeIds)`, `getCountryScopedPosts(country)`,
`getInternationalScopedPosts()` (three independently-fetched, separately-paginated sections
the caller merges — **do not** try to collapse these into one query, they're intentionally
separate per `docs/SERVICES.md`), `createFeedPost(...)` (RPC `create_post`),
`voteOnPost(postId, 1|-1)` (RPC `vote_on_post`), `createComment(postId, content)` (RPC
`create_comment`), `uploadPostImage()`, `getActiveElectionsForUser()` (RPC, falls back to a
manual membership+seat query), `burnGhostIdentityViaRpc()` (RPC `burn_ghost_identity`),
`hydratePoliticianAuthors()`/`hydratePostMentions()` (resolve @mentions and politician
authorship for display); `moderation.ts` → `reportContent()` (RPC `report_content`);
`settings.ts` → `getPlatformRuleSettings()` (read-only, for client-side "you're near your
daily limit" messaging).
**UI structure:**
- **Profile summary header**: avatar-initial, name, role badge, location, Ghost ID (first
  segment), Civic Impact Score with a manual recalculate action, **Burn Identity** button
  (destructive — confirm dialog, generates a new anonymous id, orphans all past
  posts/comments permanently).
- **Active-election banner** — one dismissible pill per open election in the user's
  boundaries, linking to that seat.
- **Composer** — always visible: text, optional image (5MB cap), optional link (auto-detect
  pasted URL → resolve preview metadata), and — **Politician accounts only** — an
  in-app-recorded video pitch.
- **Tabs**: one per boundary membership (most-local last, auto-selected default), plus
  Country, International, and an All-Feeds master tab with secondary boundary-type filter
  chips.
- **Politician video "stories"** — any post with attached video renders as a vertical
  thumbnail strip (tap → full-screen player), Instagram/TikTok-style.
- **Posts**: Ghost-ID byline, content, vote counts, civic-score badge, threaded comments.
  **Politician accounts see posts sorted by engagement** (likes+comments) instead of
  strictly newest-first, on every tab — this sort-order branch is role-conditional, not a
  user preference toggle.
**Notes:** Admin accounts see a locked-down notice instead of a real feed on the web — since
this app has no Admin role at all, that branch is simply never reachable and doesn't need
building.

### E. Profile — `/profile`, `/profile/edit`
**Purpose:** Own-account settings — read-only summary view plus an Edit modal/flow.
**Web source:** [`src/app/profile/page.tsx`](../src/app/profile/page.tsx),
[`ProfilePageClient.tsx`](../src/components/features/ProfilePageClient.tsx),
[`src/app/profile/edit/page.tsx`](../src/app/profile/edit/page.tsx),
[`EditProfileClient.tsx`](../src/components/features/EditProfileClient.tsx).
**Data (view):** `profile.ts` → `getOwnProfile`, `getPoliticianProfileFull` (politicians),
`getLatestUserLocation`, `getUserBoundaryMemberships`, `calculateMyScore()`,
`getFounderTier(signup_order)` (pure function, port directly); `feed.ts` →
`burnGhostIdentityViaRpc()` (same destructive action as Feed's — one shared repository
method, two call sites).
**Data (edit):** same `upsertProfileCore`/`upsertPoliticianProfile`/`uploadAvatarImage` as
Onboarding, plus `getPoliticalParties`/`getPoliticalPartyById` and
`findBoundariesByPoint`/`syncUserBoundaryMemberships` for the location re-detect step.
**Sections:**
- **General Info**: full name, account-type badge, every boundary membership as chips.
- **Political Details** (Politician only): party, hometown, bio, plus a one-tap **Switch to
  Citizen Account** downgrade (no heavy confirm flow).
- **Privacy & Ghost ID** (Citizen only): current Ghost ID, Civic Impact Score + recalculate,
  rotation history line, **Rotate Ghost ID** (same destructive/confirmed action as burn).
- **Edit** reuses the same step components as Onboarding: Basic Info → Location → Political
  Details (politicians only, 3 steps vs. 2 for citizens) — **build these as genuinely shared
  widgets between Onboarding and Edit Profile**, exactly as the web does (`EditProfileClient`
  explicitly reuses `OnboardingFlowClient`'s step components), not two parallel
  implementations that drift.

### F. My Elections — `/politician/elections` — **Politician only**
**Purpose:** A politician's control center for running for office.
**Web source:** [`src/app/politician/elections/page.tsx`](../src/app/politician/elections/page.tsx),
[`PoliticianElectionsClient.tsx`](../src/components/features/PoliticianElectionsClient.tsx).
**Data:** `elections.ts` → `getMyCandidacies(profileId)`, `getOpenSeatsNearShapeIds(shapeIds)`,
`findOpenSeatsInContainer(containerShapeId)` (the "Browse a Different Area" cross-country
search), `applyForSeat(seatId)` (RPC `apply_for_seat`), `deleteCandidacy(candidateId)`
(withdraw — RLS-scoped delete, no RPC); `boundaries.ts` → `getCountries`,
`listBoundaryTypes({isContainer:true})`, `getMapShapesByType`, `findBoundariesByPoint`;
`profile.ts` → `getUserBoundaryShapeIds`. (Election-Administrator applications, the
second dashboard section, reuse `applyForElectionAdmin`/`getMyElectionAdminApplications`
from `elections.ts`, already documented in §3's table.)
**Three sections:** My Candidacies (status + Withdraw + Campaign Page shortcut once
approved) → My Election-Administrator Applications (only shown if any exist) → Open Seats
Near You + Browse a Different Area (country → container → target-type → search).

### G. Candidate Application — `/apply/[candidateId]` — **Politician only**
**Purpose:** The step between "Nominate Yourself" and having a public campaign page — also
where a claimed-but-unclaimed candidate lands immediately after claiming.
**Web source:** [`src/app/apply/[candidateId]/page.tsx`](../src/app/apply/%5BcandidateId%5D/page.tsx),
[`CandidateApplicationClient.tsx`](../src/components/features/CandidateApplicationClient.tsx).
**Data:** `elections.ts` → `getCandidateById`, `getElectionQuestions(electionId)`,
`getCandidateAnswers(candidateId)`, `updateCandidateStatement` (autosaved on blur),
`upsertCandidateAnswer(candidateId, questionId, {...})`,
`setCandidateAnswerOptions`/`setCandidateAnswerRanking` (multi-select/ranking questions),
`updateCandidateIntroVideoUrl`, `submitCandidateApplication` (RPC — validates every required
question answered type-appropriately + intro video present before flipping status),
`upsertAnswerPitchPost(answerId)` (RPC — publishes a video answer as a wall post the moment
it's saved, and swaps the video in place on a retake without disturbing that post's
likes/comments).
**Notes:** Statement + questionnaire + a **required** 90s in-app-recorded intro video.
Four question types render with different controls (radio, checkboxes, free-text, 1–5
rating) — reuse the `AnswerValueWidget` design from the public-screen inventory's §5 "shared
building blocks" for the *display* side, and build a parallel input-side widget set here
for the *answering* side. Per-question video answers have an admin-set cap (default 30s,
shown on the record button). Already-submitted applications stay editable/resubmittable.

### H. Claim Candidacy — `/claim/[token]`
**Purpose:** Landing spot for an emailed claim-invite link — not a screen a user navigates
to directly.
**Web source:** [`src/app/claim/[token]/page.tsx`](../src/app/claim/%5Btoken%5D/page.tsx),
[`ClaimCandidacyClient.tsx`](../src/components/features/ClaimCandidacyClient.tsx).
**Data:** `elections.ts` → `claimCandidacyViaToken(token)` (RPC
`claim_candidacy_via_token`) — redeems on load against whoever is signed in when the link
opens (same trust model as a password-reset link), then routes straight to the new owner's
Candidacy Wall.
**Notes:** Needs the same deep-link/universal-link handling as password reset (§1) — the
token arrives via an emailed URL that must reopen the app, not a browser. If the link opens
while signed out, route through Auth first, then redeem, matching the web's "sign the
token's authorization off against whoever is logged in when the link is opened" behavior.
A second, rarer path exists (`claimCandidacyViaOwnEmail()`, RPC
`claim_candidacy_via_own_email`) for when the raw token doesn't survive an email client's
link-wrapping — a fallback matching by the just-authenticated user's own email instead of
the token; low priority to build, but the RPC already exists if a support issue calls for it.

### I.5 Election Administrator tools — extends Seat Detail (`/elections/seat/[seatId]`)
**Purpose:** The seat-level moderation/roster-management capability any signed-in
citizen or politician can earn by volunteering — not an Admin-panel feature, even though a
site admin also happens to see the same panel on every seat without needing to apply.
**Web source:** [`ElectionSeatPageClient.tsx`](../src/components/features/ElectionSeatPageClient.tsx)
(the panel is ~400 lines of this file, not a separate component — build it as a distinct
Flutter widget regardless, it's a coherent unit), [`SendInterviewInviteFlow.tsx`](../src/components/features/SendInterviewInviteFlow.tsx).
**Data:**
- **Apply**: `applyForElectionAdmin(seatId, {motivation, socialMediaInfo?, contactEmail})`
  (RPC `apply_for_election_admin`) — reviewed by a site admin, or **auto-approved after 48h**
  with no action (a background/cron concern on the backend, nothing the client needs to
  poll for beyond re-checking status).
- **Own status**: `getSeatAdminStatus(seatId)` (RPC `get_seat_admin_status`) — call this to
  decide whether to show the "Apply" form or the management panel below.
- **Search & Send Interview Invite** (`SendInterviewInviteFlow`): `politicians.ts` →
  `searchPoliticians(query)` (same unified search as the global nav search — registered
  politicians and unclaimed officeholder stubs alike), `elections.ts` →
  `addUnregisteredCandidate(seatId, {fullName, partyId?, education?, hometown?, bio?,
  avatarUrl?})` (RPC `add_unregistered_candidate` — creates a stub automatically if the
  searched person isn't already a candidate for this seat), `inviteCandidateToClaim(candidateId,
  email)` (Edge Function `send-claim-invite` — sends the claim link in one step);
  `politicalParties.ts` → `getOrCreatePoliticalParty(country, name)` (resolves the search
  result's plain-text party name to an id, creating the party row if needed).
- **Add Candidate Directly**: same `addUnregisteredCandidate` RPC, without the search step —
  a manual stub-creation form.
- **Manage Candidates**: `removeCandidate(candidateId)` (RPC `remove_candidate`) — works on
  any candidate on the seat regardless of who originally added them, once nominations are no
  longer self-service.
- **Pending Claim Requests**: `getClaimRequestsForSeat(seatId)` (candidacy_claim_requests
  where status='pending', scoped to this seat), `reviewCandidacyClaim(requestId, approve)`
  (RPC `review_candidacy_claim`) — approving hands over ownership of the stub the same way an
  emailed invite does; rejecting leaves the stub as-is and blocks that requester from
  resubmitting.
**Notes:** Gate the whole panel behind `getSeatAdminStatus`'s result — show the apply form
if unapproved/no application, the management panel if approved. This is genuinely the same
UI complexity tier as My Elections (§F) — plan for it in the same phase, not as an
afterthought bolted onto Seat Detail's read-only view.

### I.6 Officeholder Claim — `/officeholder-claim/[token]`, plus a self-request path on Politician Wall
**Purpose:** A real elected official claiming ownership of their auto-generated wall (the
platform creates a wall for every scraped officeholder automatically; nobody owns it until
the actual person claims it) — the officeholder equivalent of Claim Candidacy (§H).
**Web source:** [`src/app/officeholder-claim/[token]/page.tsx`](../src/app/officeholder-claim/%5Btoken%5D/page.tsx),
[`OfficeholderClaimClient.tsx`](../src/components/features/OfficeholderClaimClient.tsx) (the
emailed-invite redemption path); the self-request entry point lives inside
[`PoliticianWallClient.tsx`](../src/components/features/PoliticianWallClient.tsx) — a "This
is me" button shown on an unclaimed officeholder wall to any signed-in visitor.
**Data:** `elections.ts` → `redeemOfficeholderWallClaim(tokenHash)` (RPC
`redeem_officeholder_wall_claim` — token is SHA-256-hashed client-side before the call, same
pattern as `ClaimCandidacyClient`; **admin-sent invites auto-merge immediately on redemption**
since the admin who created the invite already authorized the match — "pending_review" only
surfaces for the rare fallback case where auto-merge can't complete cleanly, e.g. an
ambiguous name match), `getWallClaimEligibility(profileId)` (RPC
`get_wall_claim_eligibility` — checks before showing the self-request button at all),
`requestOfficeholderWallClaim(officeHolderId, contactEmail, note?)` (RPC
`request_officeholder_wall_claim` — self-service "this is me" with no token, lands in
`pending_review` for a site admin to approve, same posture as `requestCandidacyClaim`).
**Notes:** Needs the same deep-link handling as §H (Claim Candidacy) and §B (password
reset) — the token arrives by email and must reopen the app. Low-medium build priority:
fewer users hit this than the core Feed/Elections loop, but it's a real, non-admin action a
politician account genuinely needs, so it belongs in the same release as Claim Candidacy
rather than being deferred indefinitely.

### I. Write actions layered onto the public-screen inventory

These aren't new routes — they're the interactive capability that appears on the
already-documented public screens (§A) the moment a session exists.

| Action | Where it appears | Service call |
|---|---|---|
| Post/comment | Candidacy Wall, Politician Wall, News article thread | `createComment`/`createNewsArticleComment` (RPC `create_comment`/`create_post`); wall posts via `createWallPost` (RPC `create_wall_post` — **do not merge with `createFeedPost`**, see §6) |
| Support / follow a politician | Candidacy Wall, Politician Wall, Seat Detail roster | `politicianWall.ts` → `addSupport`/`withdrawSupport` (direct insert/delete, `auth.uid() = supporter_id` scoped) |
| Rate a politician | Politician Wall, (read-only summary elsewhere) | `ratings.ts` → `upsertPoliticianRating(politicianId, rating, comment?)` (RPC — blocks self-rating, enforces 6-month cooldown), `deletePoliticianRating` |
| Own Politician Wall — owner view | Politician Wall, when `ghostId` belongs to the signed-in user | Adds the **View Supporters** dashboard (`getSupportersList` + `subscribeToSupportChanges` realtime), QR-code share, and an owner-only tab split (All/My Posts vs. Reviews & Comments) |
| Nominate yourself | Seat Detail | `applyForSeat(seatId)` (RPC `apply_for_seat`) — only while the election is in its nominations-open window |
| "This is me" candidacy claim | Candidacy Wall, on an unclaimed stub candidate | `requestCandidacyClaim(candidateId, {motivation, contactEmail, socialMediaInfo?})` (RPC `request_candidacy_claim`) — files a request for the seat's election administrator to review; the review side itself is out of scope |
| Volunteer as Election Administrator | Seat Detail | `applyForElectionAdmin(seatId, {motivation, socialMediaInfo?, contactEmail})` (RPC), `getSeatAdminStatus(seatId)` to show the caller's own status |
| Report content | Any post/comment | `moderation.ts` → `reportContent(targetType, targetId, abuseType)` (RPC `report_content`), reasons list from `getModerationRules()` |

---

## 5. Shared building blocks worth porting as reusable widgets

Unchanged set from the original design, now joined by input-side counterparts where a
display-only widget needs a companion editing widget:

| Web component | Flutter equivalent | Used by |
|---|---|---|
| `AnswerValue.tsx` | `AnswerValueWidget` (display) + a new `AnswerInputWidget` (Candidate Application only) | Candidacy Wall, Seat Detail roster, Candidate Application |
| `QuestionAnswerCarousel.tsx` / `PlayInterviewReel.tsx` | Full-screen swipeable 9:16 video viewers | Seat Detail, Candidacy Wall |
| `PostCard.tsx` | `PostCardWidget` — now with the **vote-bar slot turned on** for Feed (it stays off for Wall/Candidacy Wall posts, matching the web) and a working comment composer | Feed, Candidacy Wall, Politician Wall, News article |
| `VideoRecorder.tsx` | `VideoRecorderWidget` (`camera` + upload) — genuinely new build, no public-only equivalent existed | Feed (politician pitches), Candidate Application (intro + per-answer video) |
| `LinkPreview.tsx` | `LinkPreviewCard` — now also the *composer's* paste-to-preview flow, not just display | Feed composer, Wall/Candidacy Wall posts |
| `MentionTextarea.tsx` | `MentionTextField` — `@`-triggered politician-search autocomplete via `searchTaggablePoliticians()` | Feed composer, Wall/Candidacy Wall composers |
| `ReportDialog.tsx` | `ReportContentSheet` | any post/comment |
| Onboarding step widgets (`StepRole`, `StepLocation`, `StepUsername`, `StepPoliticalDetails` equivalents) | Build these once, reuse verbatim in both Onboarding and Edit Profile | Onboarding, Profile Edit |
| `NewsArticleCard.tsx`, `NewsArticleBody.tsx` | unchanged from the public-only design | News screens |

---

## 6. Known divergences & gotchas to carry over

Everything from the public-only design's §6 still applies (`is_test` filtering, `!inner`
embeds, wall-slug redirects, caching TTLs) — plus, now that writes are in scope:

- **Two different post-creation paths, never merge them.** `feed.ts`'s `createFeedPost()`
  calls the `create_post` RPC. `politicianWall.ts`'s `createWallPost()` does a direct
  `posts.insert()` with `wall_ghost_id` set and is **exempt from the politician daily-post
  limit** `create_post` enforces (Wall posting is meant to stay unlimited; Feed posting
  isn't). Candidacy-wall posts (`elections.ts`'s `createCandidatePost()`) are a *third*
  direct-insert path, with @mentions attached as a separate second RPC call
  (`attachPostMentions`) afterward rather than inline. Keep all three as separate
  repository methods.
- **Comments are RPC-only, everywhere.** `create_comment` resolves `ghost_id` from
  `auth.uid()` server-side and enforces a rate limit (default: `comment_daily_limit_per_target`
  per user per target, read from `site_settings` for client-side messaging, enforced in SQL
  regardless of what the client shows). A direct `comments.insert()` will fail RLS — don't
  build a fallback path around that failure, route every comment through the RPC from the
  start.
- **Ghost ID burn is the only rotation path, and it's genuinely destructive.** One RPC
  (`burn_ghost_identity`), shared between Feed and Profile, banks the outgoing ghost's civic
  score contribution server-side before rotating and orphans all past posts/comments
  permanently. Build the confirm dialog to say exactly that — no soft-delete, no undo.
- **Ratings have a real cooldown, not just a UI nicety.** `upsert_politician_rating`
  enforces a 6-month recast window and blocks self-rating server-side —
  `getMyRatingTimestamp()` only ever returns the timestamp of the caller's own rating, never
  its value, so the UI can compute "you can re-rate on {date}" without ever being able to
  show/pre-fill what was previously voted (matches how a sealed ballot behaves even for the
  person who cast it — don't try to "improve" this by caching the value client-side after
  submission).
- **Video answers double as wall posts.** Saving a per-question video answer on Candidate
  Application immediately calls `upsert_answer_pitch_post`, which creates (first submission)
  or updates-in-place (retake) a real row in `posts` — so a candidate's answer video shows
  up in two places at once (inline on the questionnaire, and as a normal wall post with its
  own likes/comments). A retake swaps the video URL on that same post; it does not create a
  duplicate or reset engagement.
- **Onboarding and Edit Profile must call the exact same upsert functions** (`upsertProfileCore`,
  `upsertPoliticianProfile`) with the same field shape — the web deliberately shares these
  rather than having Edit Profile maintain a parallel "update" variant, specifically so the
  two flows can't drift on which fields exist or what a null vs. omitted field means.

---

## 7. Suggested implementation phases

Revised for the full-auth scope — Foundation and the public-screen phases from the original
design (News → Search/Boundary Directory/Find My District → Elections/Seat Detail →
Candidacy/Politician Wall) still apply and still make sense to build first, since they need
no auth and validate the repository-layer pattern cheaply. From there:

1. **Foundation** (as before) — now also: `supabase_flutter` auth init (PKCE flow, deep-link
   scheme registered for both email confirmation and password recovery), the root auth
   `AsyncNotifier`, `go_router` redirect guards.
2. **Public screens** (as before) — News, Search/Boundary Directory/Find My District,
   Elections/Seat Detail, Candidacy/Politician Wall (read side).
3. **Auth + Onboarding.** Gets a real account from zero to a completed profile. Build the
   4-step onboarding widgets as genuinely shared components (§4.E's note) since Edit Profile
   needs the same three of the four steps next.
4. **Feed.** The largest single screen — build the composer (text/image/link first, video
   pitch can land after `VideoRecorderWidget` exists), the three-section tab system, then
   voting/commenting last (needs `PostCardWidget`'s vote-bar turned on).
5. **Profile (view + edit).** Reuses Onboarding's step widgets directly — should be
   comparatively fast once step 3 exists.
6. **Write actions on the public screens** (§4.I) — support/rate/comment retrofit onto
   Candidacy Wall and Politician Wall, report-content sheet everywhere. Small, high-leverage:
   most of this is "the read-only screen already exists, add a button."
7. **My Elections + Candidate Application** (Politician only). Build `VideoRecorderWidget`
   here if it wasn't needed earlier for Feed — the *required* intro video makes this the
   phase where video recording can no longer be deferred.
8. **Election Administrator tools** (§I.5) — apply/status check first (cheap), then the
   management panel (Search & Send Invite, Add Candidate, Manage Candidates, Pending Claim
   Requests) as one unit once Seat Detail's read side is solid. This is comparable in scope
   to My Elections; don't treat it as a footnote.
9. **Claim Candidacy + Officeholder Claim + the remaining static/legal pages.** Both claim
   flows share the deep-link/universal-link infrastructure from §1 — build that
   infrastructure once, wire both flows to it. Lowest build priority, but not optional: both
   are real actions a politician account needs, just lower-traffic than the core loop.

---

## Appendix: full RPC reference for this app

Public-read RPCs from the original design (`find_boundaries_by_point`,
`search_politicians_and_officeholders`, `get_politician_engagement_summaries`,
`find_seat_id_by_short_hash`, `find_candidate_id_by_short_hash`, `sync_election_status`)
still apply unchanged. Added for the full-auth scope:

| RPC | Called by | Notes |
|---|---|---|
| `create_post` | Feed composer | Feed-only; daily post-limit enforced here (politicians) |
| `create_wall_post` | Politician Wall composer | Exempt from the Feed daily limit |
| `create_comment` | every comment thread | Enforces per-target daily comment limit |
| `vote_on_post` | Feed post vote buttons | `p_vote_type`: `1` or `-1` |
| `create_answer_comment` | Candidacy Wall per-answer thread | Fallback used only if a direct insert 42501s |
| `burn_ghost_identity` | Feed, Profile | Destructive — banks civic score, rotates id |
| `calculate_my_score` | Profile, Feed header | Recalculates + caches civic score |
| `apply_for_seat` | My Elections, Seat Detail "Nominate Yourself" | Only while nominations are open |
| `submit_candidate_application` | Candidate Application | Validates required questions + intro video |
| `upsert_answer_pitch_post` | Candidate Application (per-answer video save) | Creates/updates the linked wall post |
| `attach_post_mentions` | Candidacy Wall composer (after `createCandidatePost`) | Second-step call, not inline |
| `apply_for_election_admin` | Seat Detail | Volunteer for the per-seat role |
| `get_seat_admin_status` | Seat Detail | Caller's own status only |
| `request_candidacy_claim` | Candidacy Wall "This is me" | Files a reviewable request, doesn't grant ownership |
| `claim_candidacy_via_token` | Claim Candidacy | Redeems an emailed invite |
| `claim_candidacy_via_own_email` | Claim Candidacy (fallback) | Rare path, low build priority |
| `upsert_politician_rating` / `delete_politician_rating` | Politician Wall rate/review | Server-enforced cooldown + no-self-rating |
| `report_content` | Report dialog, anywhere | `p_target_type`: `post`\|`comment`\|`politician_profile`\|`office_holder` |
| `add_unregistered_candidate` | Election Administrator tools — Search & Send Invite, Add Candidate Directly | Creates a stub candidate; needs seat-admin approval to succeed (RLS/RPC-enforced) |
| `remove_candidate` | Election Administrator tools — Manage Candidates | Works on any candidate on the seat, self-added or admin-added |
| `review_candidacy_claim` | Election Administrator tools — Pending Claim Requests | `p_approve: boolean`; approving transfers stub ownership |
| `redeem_officeholder_wall_claim` | Officeholder Claim | Token is SHA-256-hashed client-side first; admin-sent invites auto-merge on redemption |
| `request_officeholder_wall_claim` | Politician Wall "This is me" (unclaimed officeholder wall) | Self-service, lands in `pending_review` for admin approval |
| `get_wall_claim_eligibility` | Politician Wall | Read-only check gating whether to show the "This is me" button at all |

Edge Function (not a Postgres RPC, called via `supabase.functions.invoke()`):
`send-claim-invite` — used by Election Administrator tools' Search & Send Interview Invite
to email the claim link in one step; unwrap the function's own JSON error body on failure
(supabase-js's default error surfaces only a generic non-2xx status otherwise — see the
`invokeOfficeholderClaimFn`/`inviteCandidateToClaim` wrapper pattern in `elections.ts`).

Direct-insert (no RPC, RLS-scoped to `auth.uid()`) write paths: `politician_supporters`
(support/withdraw), `election_candidates` delete (withdraw candidacy), `posts` insert for
Candidacy Wall posts (`createCandidatePost`), `election_candidate_answers` upsert
(questionnaire answers), `profiles`/`politician_profiles`/`user_locations` upsert (Onboarding
+ Edit Profile).
