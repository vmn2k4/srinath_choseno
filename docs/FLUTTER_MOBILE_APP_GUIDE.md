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
| **Public** (no account) | Home/landing (a product decision, not a default port — §4.A.1), News list/article/category/topic, Elections list, boundary "who represents me" detail (§4.A.6 — there is no separate "Boundary Directory" route, that was a mischaracterization in an earlier pass of this doc), Seat Detail (read + video interviews + **Community Support** vote-share panel, including an anonymous Support toggle when the admin flag is on), Candidacy Wall (read), Politician Wall (read) + its News-mentions sub-page, Find My District (+ "Set as my location" once signed in), global search, legal/static pages | anyone (some interactions upgrade once signed in) |
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
  is the primary path.
- **Google OAuth is live in production** (`signInWithGoogle()` in `auth.ts`, wired into
  `AuthPageClient.tsx` since 2026-08-04) — an earlier pass of this doc called it an unwired
  stub; it isn't. Port it as a real second sign-in button:
  `supabase.auth.signInWithOAuth(provider: OAuthProvider.google, redirectTo: <deep link>)`.
  On mobile this needs the `google_sign_in` package (native bottom-sheet account picker) or
  the same custom-URL-scheme browser-redirect handoff as password reset below — pick
  whichever `supabase_flutter`'s current OAuth guide recommends for a native app at build
  time, since this is exactly the kind of thing that changes between Supabase client
  versions. Web's `signInWithGoogle` also failing/succeeding fires `trackSignUpFailed`/
  a signup-funnel event for diagnostics (`signupFunnel.ts`) — worth a Flutter equivalent
  eventually, but purely observability, not a blocker for parity.
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
- **A second, narrower gate sits on top of that one** (`LocationRequiredGate.tsx`, added
  2026-09-14): a **politician** account whose `onboarding_completed = true` but whose
  `user_boundary_memberships` is empty gets hard-redirected to `/set-location` on *every*
  navigation until it saves one — see §4.I.8. This combination is only reachable via the
  claim-candidacy shortcut (§H), which sets `onboarding_completed = true` directly and
  skips the normal onboarding stepper's location step entirely; a normal signup can never
  end up in this state. Port this as a second `go_router` redirect layered on top of the
  session/onboarding one, checked once per signed-in user (not per navigation) with an
  explicit "I just satisfied you" signal the Set Location screen fires on save — recomputing
  from a raw state read on every route change is what caused a real redirect-loop bug on web
  (04ab883), don't reintroduce it in Flutter by polling instead of signaling.

### Universal Links / App Links for shared content — new infrastructure, not built anywhere yet

Distinct from the `choseno://auth/callback` custom scheme above (that one only ever needs
to work *inside* the app, for an email-originated recovery/claim link). This is about the
**other** direction: someone shares a link to a race, a wall, an article, or a post, and it
should open the installed app instead of a mobile browser — falling back to the browser/
website automatically when the app isn't installed. **Verified 2026-09-16: none of this
exists today.** There is no `apple-app-site-association` file and no `assetlinks.json`
anywhere in the repo (checked `public/` and the whole tree for `.well-known`) — every link
`ShareMenu` (§5) produces is a plain `https://www.choseno.com/...` URL with zero app-link
scaffolding behind it.

**What needs building, once the app has a real bundle/package id to register:**
- An `apple-app-site-association` file served (unversioned, no extension, correct
  `Content-Type`) from `https://www.choseno.com/.well-known/apple-app-site-association`,
  and an `assetlinks.json` at `https://www.choseno.com/.well-known/assetlinks.json` — both
  live on the **website's** Next.js deploy, not the Flutter app, since that's what iOS/
  Android fetch to verify the domain-to-app association. Add a route/static file for these
  to the web repo as part of this work, it doesn't ship inside the Flutter build at all.
- The Flutter side registers the same domain as an Associated Domain (iOS) / intent filter
  (Android) and handles the incoming link via `app_links` (or `go_router`'s own deep-link
  support) — dispatched straight into the existing route table from §1/§2, since every
  shareable path already has (or needs) a real `go_router` route; a Universal/App Link
  should never need a special parser separate from normal in-app navigation.
- **Every current `ShareMenu` call site needs this**, not just one screen: the Community
  Support "Share This Race" button (§4.I.7, `/elections/seat/[seatId]`), News articles
  (§4.A.3, `/news/[slug]`), and the Politician/Candidacy Wall share affordances implied by
  §4.A.8/§4.A.9's read side. No separate "app link" vs. "web link" — the exact same URL
  `ShareMenu` already generates today should open the app once this exists.
- **Feed posts have no share affordance on web at all today** (`PostCard.tsx` has no
  `ShareMenu`/copy-link of any kind — confirmed, not an oversight in this doc). Sharing a
  Feed post is new scope on both ends: it needs a real shareable URL/route (there isn't one
  — decide the path shape, e.g. `/feed/post/[postId]`, and add it to §2's slug/ID list) and
  a share button on `PostCardWidget` (§5) before a deep link into it means anything. Don't
  assume this is a straight port; it's a net-new feature this doc is flagging, not
  documenting.
- Build the association files + Associated Domains/intent-filter registration during
  **Foundation** (§7 phase 1), same reasoning as the `LocationRequiredGate` note there —
  cheap to wire the plumbing early even though most of the actual shareable screens (races,
  walls, articles, and the not-yet-built Feed-post share) don't exist until later phases.

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
| `anonymous_supporters` | **Signed-out** Community Support toggle on Seat Detail — keyed by a client-minted `anon_id`, not a real account | `add_anonymous_support`/`remove_anonymous_support` RPCs only (public read policy exists for count queries, but the app should read via `get_politician_engagement_summaries` instead); gated by `site_settings.anonymous_support_enabled` |
| `politician_ratings` | Rate a politician (1–5 stars + optional comment) | via `upsert_politician_rating`/`delete_politician_rating` RPCs (enforces no-self-rating + 6-month cooldown server-side) |
| `content_reports` | Reporting a post/comment/profile | via `report_content` RPC |
| `moderation_rules` | Read-only list of report reasons for the report-dialog dropdown | public read |
| `site_settings` (rule columns only) | Comment daily limit, politician daily post limit, **`anonymous_support_enabled`** + **`anonymous_support_rate_limit_per_hour`** (added 2026-09-10, gates the signed-out Support toggle) — read-only, used to show the right "you've hit your limit"/"sign in to support" message client-side (the RPCs enforce the real limit regardless) | public read |
| `political_parties` | Party dropdown for Onboarding's Political Details step and Edit Profile | public read |
| `election_role_types` | Role catalog (used indirectly via existing public reads) | public read |

`user_actions` and every genuinely Admin-panel-only write (`boundary_uploads` writes,
`country_boundary_types` writes, `entity_types` writes, moderation-queue admin actions,
`office_holder_wall_claims`/`office_holder_wall_redirects` **merge/reversal/global-review**
writes specifically — not the claim/self-request writes above, which are in scope) stay out.

### Full `src/lib/services/*.ts` audit — everything not named above, and why

Every service file in the web app was checked against this app's scope (2026-09-16). The
following are confirmed **not applicable** and deliberately absent from §3/§4 — not
overlooked:

| File | What it does | Why it's out |
|---|---|---|
| `campaigns.ts` | Bulk outreach — send/track claim-invite email campaigns to prospective candidates | Only imported by `CampaignAdminClient.tsx`, rendered solely at `/admin/campaign` — a site-admin growth tool, not a citizen/politician action |
| `calls.ts` | AI-voice outbound candidate calling (Twilio + xAI Grok Voice) | Only imported at `/admin/calls` — admin-triggered outreach, no citizen/politician-facing call surface exists |
| `census.ts` | Population/income/density lookups for a map shape | Its only consumer, `CensusDataDisplay.tsx`, is dead code — not imported or rendered anywhere in the app. Nothing to port; re-check if it's ever wired up on web first |
| `analytics.ts` | Platform engagement metrics (DAU/WAU/MAU, signup counts) | `/admin/analytics` only |
| `indexnow.ts`, `newsOgImage.ts` | Search-engine indexing pings, Open Graph image generation for News articles | Web-SEO-only concerns; a native app has no equivalent surface to build |
| `email.ts` | Transactional email sending (claim invites, etc.) | Server-side/Edge Function concern triggered by RPCs already covered (e.g. `send-claim-invite`) — no client screen calls this directly |
| `errorLog.ts`, `signupFunnel.ts` | Client-side error/signup-funnel logging to Supabase, mirrored to GA4 | Pure observability, no UI screen. Worth a Flutter analog eventually (crash reporting, funnel tracking) but it's an infra decision, not a screen to build — not blocking parity |

Everything else under `src/lib/services/` (`auth`, `boundaries`, `elections`, `feed`,
`profile`, `politicians`, `politicalParties`, `politicianWall`, `ratings`, `moderation`,
`news`, `settings`, `video`, `candidateSync`) has at least one call site named somewhere in
§3/§4 above. `candidateSync.ts` specifically is admin-only data-import tooling (the BC
CivicInfo sync, US House primary fixes, etc. referenced throughout `CANDIDATE_DATA_PULL_LOG.md`)
with zero citizen/politician-facing screen — confirmed out of scope for the same reason as
`campaigns.ts`/`calls.ts` above.

---

## 4. Screen-by-screen inventory

### A. Public screens

These need no auth. **Correction to an earlier pass of this document:** it deferred to "§4
entries 4.1–4.12 as originally written" for this section's detail, implying a prior draft
had already fully specified every public screen's routes/data/RPCs — that draft's content
was never actually present in this file. A.1–A.12 below is that detail, written fresh
against the current codebase (verified 2026-09-16), not reconstructed from the missing
original. What's unchanged from that earlier framing is still true: **every one of these
screens also grows a write/interactive layer** once a session exists — covered inline in
§4.I rather than repeated as separate screens, since it's the same page with extra
capability, not a new route.

#### A.1 Home / landing (`/`)
**Purpose:** The logged-out marketing page — animated hero, "how it works" explainer, role
cards, feature grid, closing CTA. **Product decision needed, not a default port:** this is a
scroll-driven marketing site, the kind of content an app store listing + the website already
cover; most native apps skip reproducing this and open straight to Auth (or a short
onboarding carousel) instead. If a splash/landing screen is wanted anyway, the one thing
worth actually porting is the **live locate widget** below, not the marketing copy.
**Web source:** [`src/app/page.tsx`](../src/app/page.tsx),
[`HomePageClient.tsx`](../src/components/features/HomePageClient.tsx),
[`home/HomeLocateWidget.tsx`](../src/components/features/home/HomeLocateWidget.tsx).
**Data:** `HomeLocateWidget` is a genuinely live, non-mocked "find your reps" card
(superseding an older description of this page as showing only fake/mocked seat data) —
`boundaries.ts` → `findBoundariesByPoint(lat, lng)`, `elections.ts` →
`getOfficeHoldersForShapes(shapeIds)`, `ratings.ts` →
`getPoliticianEngagementSummaries(politicianIds)`, plus `geocodeAddressFree()` (a free
address→lat/lng geocoder, `src/lib/utils/geocode.ts`) as a manual-entry fallback next to
"Detect My Location". Signed-out results are capped:
`ANON_REP_PREVIEW_LIMIT = 3`/`REP_LIST_GATING_ENABLED = true` in
`src/lib/constants/site.ts` truncate an anonymous visitor's rep list to 3 with a "sign up to
see the rest" gate; a signed-in viewer always sees the full list. **Decide deliberately
whether to port this gate** — it's a real web growth mechanic, but a mobile app already
requires a downloaded/installed app as its own funnel step, so the tradeoff is different;
don't port it reflexively just because the web has it.
**Notes:** Guest results are cached client-side (`guestLocation.ts`'s
`useGuestLocation`/`setGuestLocation`) so a repeat visit skips re-geocoding — same pattern
Find My District (§A.10) uses, worth sharing one repository method between the two.

#### A.2 News list (`/news`)
**Purpose:** Card grid of every published article, newest first, with a 🔴 Breaking News
badge on flagged articles.
**Web source:** [`src/app/news/page.tsx`](../src/app/news/page.tsx),
[`NewsPageClient.tsx`](../src/components/features/NewsPageClient.tsx),
[`NewsArticleCard.tsx`](../src/components/features/NewsArticleCard.tsx) (shared widget, §5).
**Data:** `news.ts` → `getPublishedNewsArticles({limit, offset, category?, country?})`.
**Notes:** Pagination is a client-side "Load more" over an offset, not infinite-scroll —
either works on mobile, infinite-scroll with a `ListView.builder` is the more native feel.

#### A.3 News article (`/news/[slug]`)
**Purpose:** Full article — hero image, markdown body, category, reading time, optional
author byline, structured data for web SEO (skip that part on mobile, it has no equivalent),
and a comment thread at the bottom.
**Web source:** [`src/app/news/[slug]/page.tsx`](../src/app/news/%5Bslug%5D/page.tsx),
[`NewsArticleDetailClient.tsx`](../src/components/features/NewsArticleDetailClient.tsx),
[`NewsArticleBody.tsx`](../src/components/features/NewsArticleBody.tsx) (markdown renderer —
a Flutter `flutter_markdown`/`markdown_widget` render of the same source, §5).
**Data:** `news.ts` → `getNewsArticleBySlug(slug)`; `comments` via `create_comment` for the
thread (RPC, same as every other comment thread in this app, see §6's "comments are
RPC-only" gotcha); `moderation.ts` → `reportContent()` for reporting the article/a comment.
**Notes:** The comment thread is anonymous/Ghost-ID and requires sign-in to post, same as
everywhere else — a signed-out reader can read comments but tapping to comment routes to
Auth, exactly like Feed/Wall commenting.

#### A.4 News category & topic browsing (`/news/category/[slug]`, `/news/topic/[slug]`)
**Purpose:** Two filtered variants of the News list — by editorial category (Politics,
Local, etc.) and by a free-text topic tag extracted from articles. Not mentioned as separate
screens in an earlier pass of this doc; they're real, separate routes.
**Web source:** [`src/app/news/category/[slug]/page.tsx`](../src/app/news/category/%5Bslug%5D/page.tsx),
[`src/app/news/topic/[slug]/page.tsx`](../src/app/news/topic/%5Bslug%5D/page.tsx), both reusing
`NewsArticleCard`/`NewsPager` from the plain News list.
**Data:** `news.ts` → `getPublishedNewsArticles(...)` filtered server-side; `newsTaxonomy.ts`
→ `resolveCategoryFromSlug`/`categoryToSlug` (category), `findArticlesByTagSlug`/
`collectTagFrequency` (topic — derives the tag list from article content, no separate
`tags` table to query).
**Notes:** Low build priority relative to the plain News list — same screen shape, just a
different filter chip pre-selected; build as one `NewsListScreen` parameterized by
`category`/`topic`, not three separate screens.

#### A.5 Elections list (`/elections`)
**Purpose:** Every currently-open seat, personalized once signed in (own boundary
memberships only) vs. platform-wide for a signed-out visitor or one with no memberships yet.
**Web source:** [`src/app/elections/page.tsx`](../src/app/elections/page.tsx),
[`ElectionsPageClient.tsx`](../src/components/features/ElectionsPageClient.tsx).
**Data:** `elections.ts` → `getActiveSeats()` (platform-wide, SSR shell), `getCandidatesBySeatIds(seatIds)`;
personalization (own-boundary scoping) happens client-side after mount against the real
session, same pattern as §A.6/§A.10 below — don't try to SSR-personalize this in Flutter
either, just show the platform-wide list first paint, then narrow once the auth provider
resolves.
**Notes:** Citizens get a "Become a Politician" nudge card at the top, linking to Profile.

#### A.6 Boundary detail / "who represents me" (`/elections/[boundarySlug]`)
**Purpose:** **This is the screen an earlier pass of this doc called "Boundary Directory" as
if it were its own top-level route — it isn't.** There is no standalone `/boundaries` route
in this app. What exists is this per-boundary detail page (reached from search, Find My
District, or a boundary chip anywhere), built around a shared **representation branch
tree** widget that's also embedded in Find My District (§A.10) and the Home locate widget
(§A.1) — one component, three entry points, not three screens.
**Web source:** [`src/app/elections/[boundarySlug]/page.tsx`](../src/app/elections/%5BboundarySlug%5D/page.tsx),
[`BoundaryDirectoryClient.tsx`](../src/components/features/BoundaryDirectoryClient.tsx),
[`RepresentationBranchTree.tsx`](../src/components/features/RepresentationBranchTree.tsx).
**Data:** `boundaries.ts` → `getMapShapeById(shapeId)`, `getShapeContainers(shapeId)` (the
boundary's parent chain — e.g. a municipality's province/state and country, for breadcrumbs
and the tab strip); `elections.ts` → `getElectionRoleTypes()`, `getActiveSeatsByShapeIds()`,
`getCandidatesBySeatIds()`, and the key one: `resolveRepresentationBranch(shape)` — resolves
who currently holds every relevant role for this boundary (mayor/councillor/MP/etc., falling
back up the boundary hierarchy — e.g. a national head of state — when this specific shape
has no directly-elected head role) into a `top`/`bottom` node structure `RepresentationBranchTree`
renders as a card stack, each card linking to that holder's Politician Wall.
**Notes:** A signed-in visitor's *other* civic branches (their own provincial riding,
municipal ward, etc. beyond the one this URL names) are resolved client-side after mount and
appended to the tab strip — the SSR-equivalent first paint only ever needs to resolve the
one boundary the route itself names. Each holder card has its own Report action
(`ReportDialog`, §5) for a factual-error report on that specific representation.

#### A.7 Seat Detail — read side (`/elections/seat/[seatId]`)
**Purpose:** Already covered in depth for its write-side capability in §4.I.5 (Election
Administrator tools) and §4.I.7 (Community Support panel) — this entry is the read-only
scaffold those sit inside. Two tabs: **Community Support** (§4.I.7's panel, plus a
citizen-facing "Become a Politician" nudge and a politician-facing "Nominate Yourself"/
candidacy-status shortcut) and **Candidate Interview** (the video-question carousel, §5's
`QuestionAnswerCarousel`/`PlayInterviewReel`) — siblings of one seat, not separate pages.
**Web source:** [`src/app/elections/seat/[seatId]/page.tsx`](../src/app/elections/seat/%5BseatId%5D/page.tsx),
[`ElectionSeatPageClient.tsx`](../src/components/features/ElectionSeatPageClient.tsx).
**Data:** `elections.ts` → `getSeatById(seatId)`, `getCandidatesBySeatIds([seatId])`,
`getElectionQuestions(electionId)`; `politicalParties.ts` → party lookups for each
candidate's row.
**Notes:** A second URL form, `/elections/seat/[seatId]/candidate/[candidateId]`, is the
same screen pre-scoped to one candidate for SEO/deep-linking (see
[`.../candidate/[candidateId]/page.tsx`](../src/app/elections/seat/%5BseatId%5D/candidate/%5BcandidateId%5D/page.tsx))
— not a distinct screen, just an alternate slug form to add to §2's slug-resolution list
(`buildSeatSlug` + `buildCandidateSlug` together).

#### A.8 Candidacy Wall — read side (`/candidacy/[candidateId]`)
**Purpose:** A candidate's campaign page — profile card, video gallery, questionnaire
answers with per-answer comment threads, and a post feed. Works standalone at this URL or
embedded inline inside Seat Detail's candidate switcher (same component either way).
**Web source:** [`src/app/candidacy/[candidateId]/page.tsx`](../src/app/candidacy/%5BcandidateId%5D/page.tsx),
[`CandidacyWall.tsx`](../src/components/features/CandidacyWall.tsx).
**Data:** `elections.ts` → `getCandidateById`, `getElectionQuestions`, `getCandidateAnswers`;
`profile.ts` → `getPoliticianProfile`; `politicianWall.ts` → `getSupporterCount`; `posts`/
`comments` for the wall feed (read side of the same calls §4.I's write table documents).
**Notes:** The bio's trailing "Website: ... \| Facebook: ..." line renders through
`BioLinks`/`parseBioLinks` (§5) — same widget the Community Support panel (§4.I.7) uses.

#### A.9 Politician Wall — read side (`/wall/[ghostId]`, `/wall/[ghostId]/[slug]`) + News mentions (`/wall/[ghostId]/news`)
**Purpose:** A politician's standing social presence (distinct from any one election's
campaign page). A third route, **not mentioned in an earlier pass of this doc at all**,
lists every News article that mentions this politician.
**Web source:** [`src/app/wall/[ghostId]/page.tsx`](../src/app/wall/%5BghostId%5D/page.tsx)
(canonical UUID/ghost-id form), `src/app/wall/[ghostId]/[slug]/page.tsx` (the human-readable
`wall_slug` form — same content, redirects/canonicalizes to whichever the profile's real
`wall_slug` is), [`src/app/wall/[ghostId]/news/page.tsx`](../src/app/wall/%5BghostId%5D/news/page.tsx)
(the mentions list), [`PoliticianWallClient.tsx`](../src/components/features/PoliticianWallClient.tsx).
**Data:** `politicianWall.ts` → `getSEOProfileSummary(ghostId)`/`getSEOProfileSummaryBySlug(slug)`,
`getSupporterCount`, `getSupportersList` (owner-only), `addSupport`/`withdrawSupport`;
`news.ts` → **`getNewsArticlesByPolitician(politicianId)`** (powers the News-mentions
sub-page specifically — add this to the data-layer list, it wasn't previously named
anywhere in this doc); `elections.ts` → `getOpenSeatsNearShapeIds` (a "seats near this
politician" module); `boundaries.ts` → `getShapeContainers`.
**Notes:** News-mentions is a simple paginated list (`NewsPager`, §A.4's pattern) reusing
`NewsArticleCard` — build it as a filtered instance of the same News list screen, parameterized
by politician instead of category/topic, once §A.2/§A.4 exist.

#### A.10 Find My District (`/find-my-district`)
**Purpose:** The standalone, full version of Home's locate widget (§A.1) — detect or
manually search a location, see every boundary it falls in, and (once signed in) the new
"Set as my location" action (§4.I).
**Web source:** [`src/app/find-my-district/page.tsx`](../src/app/find-my-district/page.tsx),
[`FindMyDistrictClient.tsx`](../src/components/features/FindMyDistrictClient.tsx),
[`InteractiveLocationPicker.tsx`](../src/components/features/InteractiveLocationPicker.tsx)
(Leaflet/OSM on web — see §8's native-map recommendation for the Flutter equivalent),
embeds `BoundaryDirectoryClient` (§A.6) for the resolved boundaries' representation view.
**Data:** `boundaries.ts` → `findBoundariesByPoint`, `syncUserBoundaryMemberships`;
`elections.ts` → `getActiveSeatsByShapeIds`, `getCandidatesBySeatIds`,
`resolveRepresentationBranch`; `profile.ts` → `getOwnProfile`, `upsertProfileCore` (the "Set
as my location" write, signed-in only, §4.I); guest results cached via
`guestLocation.ts` — same helper §A.1's Home widget uses.
**Notes:** A signed-in politician who lands here via `LocationRequiredGate`'s redirect
(§1, §4.I.8) is a different flow — that's Set Location, a separate, narrower screen; Find My
District itself has no hard gate and is reachable by anyone, signed in or not.

#### A.11 Global search
**Purpose:** Not a route of its own — a search field mounted in the nav chrome, present on
every screen. Searches politicians, candidates, and unclaimed office-holder stubs in one
unified list; a result routes either to a Politician Wall (has a linked profile) or a
boundary's representation page (§A.6, office-holder stub with no profile yet).
**Web source:** [`GlobalPoliticianSearch.tsx`](../src/components/features/GlobalPoliticianSearch.tsx).
**Data:** `politicians.ts` → `searchPoliticians(query)` (RPC `search_politicians_and_officeholders`,
already in the Appendix's public-read RPC list).
**Notes:** Build as a persistent search entry point in the app shell (§8 recommends a
full-screen native search experience with cached recent searches over the web's inline
dropdown) rather than a page-specific widget — every screen should be able to reach it.

#### A.12 Legal & static pages
**Purpose:** Plain static content, no client-side interactivity or data calls at all — the
lowest-priority, cheapest screens in the whole app.
**Web source:** [`/about`](../src/app/about/page.tsx) (`AboutPageClient.tsx` — the only one
of these five with any client component, and even that's just scroll-triggered animation, no
data), [`/privacy`](../src/app/privacy/page.tsx), [`/terms`](../src/app/terms/page.tsx),
[`/corrections-policy`](../src/app/corrections-policy/page.tsx),
[`/editorial-standards`](../src/app/editorial-standards/page.tsx).
**Data:** None — every one of these five renders static/hardcoded copy server-side.
**Notes:** Render as plain Flutter widgets (or a single generic `StaticContentScreen` fed by
an enum) with no repository layer involved at all; not worth building a CMS-backed version
of these for a v1.

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
`create_comment`), `uploadPostImage()`, `video.ts` → `uploadVideo(bucket, fileName, blob)` +
`getVideoPublicUrl(bucket, fileName)` (the actual video-upload service backing every
`VideoRecorderWidget` use — not previously named in this doc), `getActiveElectionsForUser()` (RPC, falls back to a
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

### I.7 Community Support / anonymous voting — extends Seat Detail (`/elections/seat/[seatId]`)
**Purpose:** Added 2026-09-10 through 2026-09-14. A "who's leading" poll rendered on Seat
Detail below the candidate roster — vote-share bars derived from the *same*
`politician_supporters` count already shown elsewhere via the heart icon (no new metric),
plus, when an admin flag is on, a **Support** toggle that works for a signed-out visitor
with no account at all. This is a genuinely new class of write action for this app: the
first one that doesn't require a session.
**Web source:** [`ElectionResultsPanel.tsx`](../src/components/features/ElectionResultsPanel.tsx)
(the panel itself), wired into
[`ElectionSeatPageClient.tsx`](../src/components/features/ElectionSeatPageClient.tsx)'s
`handleToggleSupport`; anon-id minting in
[`src/lib/utils/anonSupporter.ts`](../src/lib/utils/anonSupporter.ts).
**Data:**
- **Read**: `elections.ts`/`politicians.ts` → `getPoliticianEngagementSummaries(politicianIds)`
  (RPC `get_politician_engagement_summaries`) — its `supporter_count` already folds
  authenticated `politician_supporters` and anonymous `anonymous_supporters` counts into one
  number; don't sum them client-side. `settings.ts` → read
  `anonymous_support_enabled`/`anonymous_support_rate_limit_per_hour` off `site_settings` to
  decide whether the toggle is available to a signed-out viewer at all.
- **Write, signed-in**: same `addSupport`/`withdrawSupport` as the existing Support/Follow
  action (§4.I table) — nothing new here, this panel just gives it a second entry point.
- **Write, signed-out**: `politicians.ts` (or a new `anonymousSupport.ts`) →
  `addAnonymousSupport(politicianId, anonId)` (RPC `add_anonymous_support`),
  `removeAnonymousSupport(politicianId, anonId)` (RPC `remove_anonymous_support`). Both take
  a client-minted `anon_id` — a random UUID the app mints once and must persist durably
  across app restarts (web persists it in both `localStorage` *and* a 2-year cookie so
  either surviving alone repopulates the other; Flutter's equivalent is a value written to
  `shared_preferences` on first use and read back every launch — `flutter_secure_storage` is
  overkill here, this identity is deliberately weak/anonymous, not a credential). Do not
  regenerate it per session. `add_anonymous_support` is `SECURITY DEFINER`-enforced: it
  checks the feature flag, hashes the caller's IP server-side against an admin-only pepper
  for a per-hour rate limit, and rejects if the flag is off — a client-side "is it enabled"
  check is only for UI, never trust it to gate the call itself. `remove_anonymous_support`
  is **not** flag-gated, so a visitor who supported while the feature was on can still
  withdraw after an admin turns it off.
**Notes:** If `!user && !anonymous_support_enabled`, tapping Support routes to `/auth`
exactly like the existing Support/Follow button elsewhere — this panel doesn't change that
fallback, it just adds a path around it when the flag is on. The panel also reuses the
existing Share menu (§5), an inline expand for rating a candidate
(`PoliticianInlineRating` — same widget News and the Wall already use), and the new BioLinks
chip widget below for a candidate's parsed website/social links. Sort order, "Leading"/"Tied"
labeling, and the vote-share percentages are pure client-side derivations from the same
`engagementSummaries` map the rest of the page already fetches — no extra query beyond what
Seat Detail already needed.

### I.8 Set Location — `/set-location`
**Purpose:** A narrow, standalone screen added 2026-09-14 — the location-only counterpart to
Onboarding's location step, reached only via the `LocationRequiredGate` hard-redirect
described in §1's Route guarding section (a politician account that claimed its candidacy
through the interview-invite flow, which sets `onboarding_completed = true` directly and
skips normal onboarding's location step, leaving `user_boundary_memberships` empty forever
otherwise). Not part of `/onboarding` itself — that flow's multi-step state assumes a
brand-new account still choosing a role and name, which this account already has.
**Web source:** [`src/app/set-location/page.tsx`](../src/app/set-location/page.tsx),
[`SetLocationClient.tsx`](../src/components/features/SetLocationClient.tsx).
**Data:** `boundaries.ts` → `findBoundariesByPoint(lat, lng)`,
`syncUserBoundaryMemberships(lat, lng)` (RPC — same two calls Onboarding's location step and
Find My District's "Set as my location" all funnel through, see §4.I's note on reuse);
`profile.ts` → `getOwnProfile` (to preserve the existing `full_name` — this is a full-row
upsert, not a partial patch, so omitting it would null the name out),
`upsertProfileCore(...)`.
**Notes:** On successful save, call the route-guard's "satisfied now" signal (the
`useLocationGate().clearNeedsLocation()` equivalent — see §1) before navigating to the
`next` query param, then navigate. Reads a `next` path so it can return the user to wherever
the gate intercepted them (default: `/feed`) — a raw, validated relative path only, never an
absolute URL, to avoid an open-redirect.

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
| "Set as my location" | Find My District, once a lookup resolves — **signed-in users only** | `boundaries.ts` → `syncUserBoundaryMemberships(lat, lng)`, `profile.ts` → `upsertProfileCore(...)` (the exact same two calls Onboarding/Set Location use, see §4.I.8) — added 2026-09-15. Deliberately opt-in: a lookup alone never touches the account, only tapping this button does, and it resets to unset on every new lookup so it can't show "already set" for a location that was never saved (a candidate scoping a future race, or a citizen checking a different address, must be able to look without writing) |
| Community Support vote / anonymous Support toggle | Seat Detail, below the candidate roster | See §4.I.7 — works signed-out too, when `site_settings.anonymous_support_enabled` is on |

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
| `BioLinks.tsx` (+ `parseBioLinks` in `bioLinks.ts`) | `BioLinksRow` — parses a bio's trailing "Website: ... \| Facebook: ..." line into clickable chips; a value that can't be resolved to a safe URL still renders as plain text instead of being dropped | Candidacy Wall, Politician Wall, Seat Detail's Community Support panel (§4.I.7) |
| `ElectionResultsPanel.tsx` | `CommunitySupportPanel` — vote-share bars + Support toggle (auth or anonymous) + inline rating expand + share menu, sorted by supporter count | Seat Detail (§4.I.7) |
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
  two flows can't drift on which fields exist or what a null vs. omitted field means. **Set
  Location (§4.I.8) and "Set as my location" (§4.I) are a third and fourth call site for the
  exact same `syncUserBoundaryMemberships` + `upsertProfileCore` pair** — keep all of these
  as one shared repository call, not parallel reimplementations.
- **The anonymous Support identity is deliberately weak, don't "fix" it.** `anon_id` is a
  random UUID with no server-side proof of uniqueness — a visitor who clears storage or
  switches devices can support the same candidate again. The real backstop is server-side:
  an IP-hashed-with-a-secret-pepper rate limit (`add_anonymous_support`), not client dedup.
  Persist the id once and reuse it; don't build a "stronger" fingerprinting scheme client-side,
  that's explicitly out of scope for what this feature is trying to be.
- **`get_politician_engagement_summaries`'s `supporter_count` already includes anonymous
  supporters** (since the 2026-09-10 migration) — it is not just `politician_supporters`
  anymore. Anywhere this RPC's count is displayed (Feed, Politician Wall, Community Support
  panel), it's already the combined number; don't add `anonymous_supporters` on top of it
  again or the count will double.
- **`LocationRequiredGate`'s hard redirect only fires for a narrow, specific combination**
  (politician + `onboarding_completed=true` + zero boundary memberships) and is checked once
  per signed-in user, not per navigation — Set Location's own save must explicitly signal
  the gate that it's satisfied (§1), because nothing about a successful save alone changes
  the inputs the gate's check depends on. Building this as a plain recompute-on-navigate
  will reproduce the redirect-loop bug the web version already hit and fixed.

---

## 7. Suggested implementation phases

Revised for the full-auth scope — Foundation and the public-screen phases from the original
design (News → Search/Boundary Directory/Find My District → Elections/Seat Detail →
Candidacy/Politician Wall) still apply and still make sense to build first, since they need
no auth and validate the repository-layer pattern cheaply. From there:

1. **Foundation** (as before) — now also: `supabase_flutter` auth init (PKCE flow, deep-link
   scheme registered for both email confirmation and password recovery), the root auth
   `AsyncNotifier`, `go_router` redirect guards (including the narrower `LocationRequiredGate`
   layer from §1 — cheap to add now since it's the same guard mechanism, even though the
   screen it redirects to, Set Location, isn't built until phase 6/8), and the Universal
   Links/App Links registration from §1 (Associated Domains + `apple-app-site-association`/
   `assetlinks.json` on the web deploy) — also cheap to wire now against whichever routes
   already exist, so every later phase's new routes are deep-linkable the moment they ship
   instead of needing a retrofit pass at the end.
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
   Candidacy Wall and Politician Wall, report-content sheet everywhere, "Set as my location"
   on Find My District, and the Community Support panel + anonymous Support toggle on Seat
   Detail (§4.I.7 — the anon-id persistence helper is a small, self-contained build). Small,
   high-leverage: most of this is "the read-only screen already exists, add a button."
7. **My Elections + Candidate Application** (Politician only). Build `VideoRecorderWidget`
   here if it wasn't needed earlier for Feed — the *required* intro video makes this the
   phase where video recording can no longer be deferred.
8. **Election Administrator tools** (§I.5) — apply/status check first (cheap), then the
   management panel (Search & Send Invite, Add Candidate, Manage Candidates, Pending Claim
   Requests) as one unit once Seat Detail's read side is solid. This is comparable in scope
   to My Elections; don't treat it as a footnote.
9. **Claim Candidacy + Officeholder Claim + Set Location (§4.I.8) + the remaining
   static/legal pages.** The two claim flows share the deep-link/universal-link
   infrastructure from §1 — build that infrastructure once, wire both flows to it. Set
   Location is small (a standalone location-only form reusing Onboarding's step) but must
   land in this phase or earlier, since without it a politician account that claimed via
   interview invite has no way to satisfy `LocationRequiredGate` and gets stuck. Lowest
   build priority otherwise, but not optional: these are real actions accounts genuinely
   need, just lower-traffic than the core loop.

---

## 8. Native-app UX upgrades — per-screen recommendations

Everything above (§§0–7) is about **parity**: every screen and write action the web offers,
built for a phone. This section is the opposite direction — where a straight port would
feel like "the website in a webview" and a few native-only capabilities would make it feel
like a real app instead. None of these are required for parity; treat them as a backlog to
pull from once each screen's parity build (§7) is done, roughly in the order listed within
each screen (cheapest/highest-leverage first).

### Cross-cutting (not tied to one screen)

- **Push notifications are a real gap today, not a nice-to-have.** The web has zero
  server-initiated notification surface — a citizen finds out about a comment reply, a
  candidate finds out about a claim request or an approved Election Administrator
  application, only by opening the app and looking. A phone can do what a browser tab
  can't: `firebase_messaging` (or APNs directly on iOS) with Edge Functions triggering sends
  on `create_comment` replies, `review_candidacy_claim` outcomes, `apply_for_election_admin`
  approval, and claim-invite emails landing. This is the single highest-leverage divergence
  from the web in this whole list — start it early enough that its Edge Function
  infrastructure exists before Feed (§4.D) ships, since comment-reply notifications are the
  most-used case.
- **Replace the web's custom `ShareMenu` (Copy Link, X, WhatsApp, LinkedIn, Facebook,
  Telegram, Pinterest, Email — a hand-rolled dropdown) with the OS share sheet**
  (`share_plus`). One call (`Share.share(text, subject:)`) gets every app actually installed
  on the device, including ones the web menu doesn't enumerate (iMessage, Signal, native
  Mail) — strictly more capable and it's what a phone user already expects a share icon to
  do. Every place §5 lists `ShareMenu`/`ShareData` (Feed posts, Community Support panel §4.I.7,
  News articles) gets this for free once one wrapper exists.
- **Biometric re-auth for a returning session**, not full sign-in every cold start.
  `supabase_flutter` already persists the session (§1); layer `local_auth` (Face ID / Touch
  ID / Android biometric) as an app-open gate on top of an already-valid session, with a
  fallback to the device passcode — this is standard for anything holding a real account
  (the web has no equivalent because a browser has no comparable concept).
- **Haptics on every optimistic-update tap** — vote, Support toggle (§4.I.7), Burn Identity
  confirm, rating submit. `HapticFeedback.lightImpact()`/`.mediumImpact()` on success,
  `.heavyImpact()`/`vibrate()` before a genuinely destructive confirm (Burn Identity, Rotate
  Ghost ID, Withdraw Candidacy). Free feedback the web literally cannot provide.
- **The map picker and location detection should be genuinely native, not a ported web
  widget.** `InteractiveLocationPicker.tsx` on web is Leaflet + raw OpenStreetMap tiles
  loaded dynamically — reasonable for a browser, but a phone has a real system location
  permission prompt and (on iOS) Apple Maps / (on Android) Google Maps rendering already
  available. Use `geolocator` for the actual "where am I" call (already in §1's stack table)
  and `google_maps_flutter`/`apple_maps_flutter` (or `flutter_map` if staying tile-based
  matters for parity with the OSM data source) for the interactive picker itself — pinch-zoom
  and pan should feel like Maps, not like a webpage with a map embedded in it. Applies to
  Onboarding's Location step (§4.C), Find My District (§4.A), Edit Profile's re-detect
  (§4.E), and Set Location (§4.I.8) — one native map widget, four call sites.
- **Video recording should use the platform camera UI, not a ported `getUserMedia`/
  `MediaRecorder` web flow.** `VideoRecorder.tsx` on web calls raw
  `navigator.mediaDevices.getUserMedia` + `MediaRecorder` because a browser has nothing
  better to reach for. Flutter's `camera` package (already in §1's stack table) gets a real
  native recording surface — front/back toggle, tap-to-focus, a proper countdown/timer
  overlay for the capped durations (90s intro video, default 30s per-answer) — instead of
  reproducing a web `<video>` preview + a manual progress bar. Applies everywhere §5 lists
  `VideoRecorderWidget`: Feed's politician video pitch, Candidate Application's intro + per-
  answer videos (§4.G).
- **Background, resumable upload for video/image, with a persistent notification.** A
  90-second video is a large upload; on web, closing the tab mid-upload just fails silently.
  On mobile, an upload can and should survive the app being backgrounded — `flutter_uploader`
  (or a foreground service + `WorkManager` on Android, `URLSession` background config on
  iOS) with a progress notification, so switching apps mid-upload during Candidate
  Application (§4.G) doesn't lose the whole take.
- **Respect system text-size and reduced-motion settings.** The web has no equivalent
  concept to check against; on mobile, `MediaQuery.textScalerOf(context)` and
  `MediaQuery.disableAnimationsOf(context)` are real, commonly-set accessibility
  preferences. Worth a pass once the shared widgets in §5 exist, before they're copy-pasted
  across every screen with a fixed assumption baked in.

### A. Public screens

- **Feed's vertical video-story strip and Seat Detail's video interviews (§4.A, §5's
  `QuestionAnswerCarousel`/`PlayInterviewReel`) should support swipe-to-advance and
  swipe-down-to-dismiss**, matching the gesture vocabulary every phone user already has from
  Instagram/TikTok Stories, Reels, and YouTube Shorts — the web's version is necessarily
  click-driven (next/prev buttons) since a mouse has no swipe gesture to reuse.
- **Global search as a native search experience**: a persistent search field with recent
  searches cached locally (not server round-tripped) and a debounced-as-you-type result list
  that opens full-screen on focus (`showSearch`/a custom full-screen route), rather than the
  web's inline dropdown-under-a-navbar-input pattern, which assumes a mouse-hover dismiss
  model that doesn't map cleanly to touch.
- **Boundary Directory's list of shapes benefits from `flutter_map`/native-maps clustering**
  when a country has hundreds of small boundaries — pinch-zoom to a region and see markers
  cluster/expand, instead of the web's flat scrollable list being the only navigation model.

### B. Auth

- **Native password-manager/autofill integration**: `TextFormField` with
  `autofillHints: [AutofillHints.email]`/`[AutofillHints.password]` so iOS Keychain/Android
  autofill (and third-party managers like 1Password) offer to fill and save credentials —
  this is a system-level feature a browser gets automatically that a Flutter form must
  explicitly opt into.
- **Google Sign-In via the native account picker** (`google_sign_in` package's native
  bottom-sheet chooser) rather than the OAuth browser-redirect handoff, wherever the current
  `supabase_flutter` OAuth guidance supports it (§1) — one tap against already-signed-in
  device accounts, no browser hop at all.

### C. Onboarding

- **"Detect My Location" should fire the system location permission prompt immediately on
  reaching that step**, not require a manual "allow" tap first followed by a second in-app
  button — the web can't request device GPS at all without an in-page trigger, so it always
  needed that extra tap; a native app can ask once, contextually, and proceed straight to
  the `findBoundariesByPoint` call on grant.
- **Swipeable step transitions** (`PageView` with a physical swipe between Role → Location →
  Username → Political Details, not just a Continue-button `Next`) so a user can flick
  backward to fix a typo without hunting for a Back button — cheap once the steps are built
  as a `PageView` per §4.C's stepper note.

### D. Feed

- **Pull-to-refresh** on every tab (`RefreshIndicator`) instead of the web's implicit
  "reload the page" — Feed is the screen a user returns to most often, so this is the
  highest-traffic place a native refresh gesture pays off.
- **Swipe between the boundary/Country/International tabs** (a `TabBarView`'s native swipe,
  not just tapping a tab chip) — the web's tabs are click-only because there's no horizontal
  swipe gesture on a page; a phone user expects the content to drag with their finger.
- **Double-tap-to-vote on a post's image**, mirroring the now-universal Instagram/Twitter
  gesture, as a shortcut alongside (not replacing) the explicit vote buttons — optional
  polish, easy to add once `PostCardWidget`'s vote-bar (§5) exists and is wired to
  `voteOnPost`.
- **Long-press a post for a native context menu** (report, copy link, share) instead of the
  web's always-visible icon row competing for space in a phone-width card.

### E. Profile

- **A home-screen/app-shortcut quick action** ("New Post", "View My Score") via
  `quick_actions` (long-press the app icon) — a phone-only affordance with no web analogue.
- **Share Profile / Wall link through the native share sheet** (see Cross-cutting above)
  rather than a copy-link button, and consider a generated QR code (`qr_flutter`) for a
  politician's Wall specifically — useful in person (a campaign event, a doorstep
  conversation) in a way a desktop share button never needs to be.

### F. My Elections / G. Candidate Application

- **Push notifications on status change** (candidacy approved, Election-Administrator
  application approved/auto-approved after 48h, a claim request reviewed) — see
  Cross-cutting; this screen is the primary beneficiary since a politician account checks it
  specifically to learn "did anything change."
- **Local draft autosave for the questionnaire and statement**, keyed offline
  (`shared_preferences`/`hive`) as a safety net if the app is killed mid-edit before the
  existing autosave-on-blur network call lands — a phone is far more likely to be
  backgrounded/killed mid-task than a desktop browser tab.
- **A dedicated in-app camera countdown/retake flow for the required intro video**, with a
  script-teleprompter option (scrolling `narration_text`-style hint text, borrowed from the
  admin's `GenerateQuestionVideosFlow` narration concept, adapted for a candidate recording
  their own pitch) — genuinely easier to build well natively than in a browser tab, and this
  is the single most consequential video in the whole app (it gates application submission).

### H. Claim Candidacy / I.6 Officeholder Claim

- **Offer QR-code scanning as an alternate entry point** alongside the emailed deep link —
  an election administrator or admin handing someone a physical claim link (a printed flyer,
  a business card at a campaign event) can hand over a QR code instead, opened via the
  device camera or an in-app scanner (`mobile_scanner`). The token-redemption RPC underneath
  (`claim_candidacy_via_token`/`redeem_officeholder_wall_claim`, §4.H/§4.I.6) doesn't care how
  the token arrived.

### I.5 Election Administrator tools

- **Swipe-to-approve/reject on the Pending Claim Requests list**, the email-triage gesture
  pattern (swipe right to approve, left to reject, both revealing a confirm) instead of the
  web's inline approve/reject buttons — this list is exactly the kind of "process a queue of
  items" UI that gesture works well for, and the underlying call
  (`review_candidacy_claim(requestId, approve)`, §4.I.5) already takes a single boolean.
- **Push notification the moment a new claim request or interview-invite click lands** —
  see Cross-cutting; an election administrator is otherwise only prompted by revisiting the
  seat.

### I.7 Community Support / anonymous voting

- **Haptic tap on Support/un-Support** (see Cross-cutting) — this is the single most-tapped
  button on this screen and currently has zero physical feedback on web beyond a CSS
  animation.
- **A native share sheet for "Share This Race"** (see Cross-cutting) instead of the ported
  `ShareMenu` dropdown — this panel's whole second half is built around getting a visitor to
  forward the race to someone else, which the OS share sheet does more completely than any
  fixed list of platforms.

### I.8 Set Location

- No screen-specific native upgrade beyond the shared native map picker (Cross-cutting) —
  this screen is small and mechanical by design (§4.I.8's own note); keep it that way rather
  than over-investing in polish for a rarely-hit recovery flow.

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
| `add_anonymous_support` | Seat Detail's Community Support panel (§4.I.7) — **anon-callable, no session required** | Flag-gated (`site_settings.anonymous_support_enabled`) + server-side IP-hash rate limit; granted to both `anon` and `authenticated` roles |
| `remove_anonymous_support` | Community Support panel | **Not** flag-gated — withdrawal always works even if the flag is later turned off |
| `get_politician_engagement_summaries` | Feed, Politician Wall, Community Support panel | `supporter_count` already sums authenticated + anonymous supporters — don't add `anonymous_supporters` again client-side |

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
