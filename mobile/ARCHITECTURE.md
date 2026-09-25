# Choseno Mobile — Architecture

How this Flutter app is structured, why, and how to extend it. Companion reading:
[DESIGN.md](DESIGN.md) (visual design system — colors, typography, the shared component
library) and, in the parent repo, [docs/FLUTTER_MOBILE_APP_GUIDE.md](../docs/FLUTTER_MOBILE_APP_GUIDE.md)
(the full screen-by-screen inventory, data/RPC mapping, and phased build plan this app is
implementing) and [docs/CODE_LAYERS.md](../docs/CODE_LAYERS.md) (the equivalent layering
rules for the Next.js website — this document is that same philosophy applied to Flutter,
not a different one).

Everything for this app lives under `mobile/` — it does not share tooling, dependencies, or
a build pipeline with the Next.js website in the parent repo. The only thing the two
projects share is the Supabase backend (same project, same schema, same RLS policies/RPCs)
and this documentation's cross-references back to the website's docs for *what* to build.

---

## Clean Architecture — the three layers

```
lib/
  core/            ← cross-cutting, feature-agnostic infrastructure
  domain/          ← pure Dart business rules — no Flutter, no Supabase
  data/            ← implements domain contracts against Supabase
  presentation/    ← Flutter UI + state management
```

**Dependency direction is one-way, inward:** `presentation` depends on `domain`, `data`
depends on `domain`, but `domain` depends on nothing else in this app. This is the one rule
that matters more than any folder name — a file under `lib/domain/` must never `import`
anything from `lib/data/` or `lib/presentation/`, and must never import `flutter/material.dart`
or `supabase_flutter`. If a domain file needs to import Flutter or Supabase, that's a sign
the code belongs in `data/` or `presentation/` instead.

```
presentation  ──depends on──▶  domain  ◀──depends on──  data
     │                                                      │
     └──────────────── never depends on ──────────────────┘
```

This mirrors the website's own layering rule (`docs/CODE_LAYERS.md`'s "dependency direction
is one-way, top to bottom") applied to a different stack: the website enforces "pages/
components never call `supabase.*` directly, only `src/services/` does"; this app enforces
the same idea one layer deeper — *nothing* outside `data/` ever imports the Supabase SDK.

### Why three layers instead of the website's two (services → components)

The website's service layer (`src/lib/services/*.ts`) is a "thin wrapper... the same query
the caller would've written" (`docs/SERVICES.md`) — it doesn't separate "the shape of a
business rule" from "how Supabase happens to expose it," because in a web app calling
`supabase.from(...)` directly from a page would violate the one rule that actually matters
there (see `docs/CODE_LAYERS.md`'s "hard rule"). A mobile app run over a real network on a
real device has different pressures — testability without hitting a live backend, and
being able to swap what a `Repository` talks to without touching UI code — that justify the
extra domain/data split. If a given feature's domain layer only ever does
`return _repository.someCall(...)` with zero actual business logic, that's fine and expected
(see the `usecases/` note below) — the value of the layer is the *boundary* it draws, not
that every use case has to do real work to earn its place.

### `core/` — cross-cutting infrastructure, not feature-specific

```
core/
  config/     Supabase URL/anon key from a git-ignored .env (see env_config.dart)
  errors/     Result<T> + AppFailure — the typed error-handling contract every
              repository method returns instead of throwing
  router/     go_router config + the auth/onboarding/location redirect guards
              from the Flutter guide's §1
  theme/      ThemeConfig — see DESIGN.md, the single source of truth for
              every color/font/spacing/radius value in the app
  widgets/    The shared component library (AppButton, AppCard, AppBadge, ...)
              — every screen's UI is built from these, mirroring the
              website's src/components/ui/ (DESIGN.md rule #2/#3)
```

Nothing in `core/` knows about a specific feature (auth, feed, elections, ...) — if a file
under `core/` starts importing something from `domain/auth/` or referencing "candidate" or
"post" by name, it's grown feature-specific and belongs somewhere else.

### `domain/<feature>/` — one folder per feature, pure Dart

```
domain/
  auth/
    entities/       Plain Dart classes — what the rest of the app knows about
                     "a user," independent of how Supabase represents one
    repositories/    Abstract interfaces (`abstract interface class AuthRepository`)
                     — the CONTRACT, never an implementation
    usecases/        One class per named action (SignInWithPassword, SignOut, ...),
                     each a thin `call()` that delegates to the repository
```

**Feature folders mirror the website's service domains 1:1** — `docs/FLUTTER_MOBILE_APP_GUIDE.md`
already organizes the whole app by the same domains the website's `src/lib/services/*.ts`
files use (`auth`, `boundaries`, `elections`, `feed`, `profile`, `politicians`,
`politicalParties`, `politicianWall`, `ratings`, `moderation`, `news`, `settings`, `video`).
When adding a new feature, check that list and the guide's data-layer bullets for the
screen you're building before inventing a new domain folder name — the guide has already
done the work of grouping "what data does this screen need" by domain.

**The `usecases/` layer is the one piece of ceremony this project treats as optional.** For
a genuinely pass-through action (`SignOut` just calls `repository.signOut()`, nothing else),
a use-case class earns its keep by keeping "one class, one named action" consistent as the
app grows, not because it does real work today. If a team finds this adds friction without
value, the alternative is calling the repository directly from the Riverpod controller
(`presentation/features/<feature>/providers/`) — just be consistent about which pattern the
whole app uses, don't mix both within one feature.

### `data/<feature>/` — implements the domain's contracts against Supabase

```
data/
  auth/
    datasources/    The raw Supabase calls — a near-1:1 port of the matching
                     src/lib/services/<domain>.ts file on the website
    models/         Maps a Supabase SDK type / raw JSON row to a domain entity
                     (and back, for writes) — the ONLY files allowed to import
                     supabase_flutter's types directly
    repositories/   Implements the domain interface: calls the data source,
                     maps the result through the model, translates any thrown
                     exception into a typed AppFailure (core/errors/)
```

**Porting a website service file is mechanical, by design:** `data/auth/datasources/
auth_remote_data_source.dart` is deliberately structured to read like a Dart transliteration
of `src/lib/services/auth.ts` — same function names, same call shape, same order — so a
future change to the website's service file (a new parameter, a new RPC) is easy to spot and
mirror here. Do not "improve" a data source's shape relative to its website counterpart
without a reason; staying a faithful mirror is the point.

**Repositories are the only place a try/catch around a Supabase/Postgres error belongs.**
Everything above the repository (`domain/`, `presentation/`) works with `Result<T>`
(`core/errors/result.dart`) — a sealed `Ok<T>` / `Err<T>` type, not a thrown exception. This
mirrors the website's service-layer convention of returning `{ data, error }` and letting
the caller decide what an error means, rather than throwing across a layer boundary
(`docs/SERVICES.md`'s framing, ported to Dart's type system instead of a loose JS object).

### `presentation/` — Flutter UI + state management (Riverpod)

```
presentation/
  common/
    providers/    App-wide providers with no single feature owner
                   (e.g. supabaseClientProvider)
  features/
    <feature>/
      providers/   Riverpod providers wiring datasource → repository → use
                   cases → the AsyncNotifier/Controller a screen actually
                   watches. A screen never imports a repository or data
                   source directly — only this file's exported providers.
      screens/     One file per screen (matches the Flutter guide's
                   screen-by-screen §4 lettering — see its per-screen
                   "Web source" line for which website route/component a
                   given screen ports)
      widgets/     Screen-specific widgets that don't belong in the shared
                   core/widgets/ library (used by only this one feature)
```

**State management is Riverpod**, per `docs/FLUTTER_MOBILE_APP_GUIDE.md` §1's stack table —
one root provider per cross-cutting concern (auth state, see
`presentation/features/auth/providers/auth_providers.dart`'s `authStateChangesProvider`,
mirroring the website's single root `AuthContext`), a scoped
`AsyncNotifier`/`Provider` per screen for everything else. A screen's `build()` method
should read as: watch a provider, render based on its `AsyncValue` (`.when(loading:, error:,
data:)`), call a controller method on user action. If a screen's `build()` method contains a
`try/catch` or calls `Supabase.instance.client` directly, something is wired wrong — trace
back through `providers/` to find where the layering broke.

---

## Feature status

| Feature | Layers built | Screen(s) | Notes |
|---|---|---|---|
| **Auth** (§4.B) | domain + data + presentation | Sign in / sign up | Missing: Google OAuth, password-recovery deep link, founder-count nudge — see below |
| **Profile** (§4.E, partial) | domain + data + presentation | — (no Profile screen yet) | Only what Onboarding/the router guard need so far: `fetchOrHealProfile`, `upsertProfileCore`, `upsertPoliticianProfile`. `getUserBoundaryMemberships`, avatar upload, Ghost ID rotation, Civic Score not ported |
| **Onboarding** (§4.C) | domain (via Profile) + data (via Profile + Boundaries) + presentation | 3/4-step flow | "Detect My Location" only — no manual fallback (search-by-name / raw lat-lng) yet, see `step_location.dart`'s header comment |
| **Boundaries** (§3) | domain + data | — (no standalone screen; used by Onboarding, Elections, Find My District) | `findBoundariesByPoint`, `syncUserBoundaryMemberships`, `getMapShapeById`, `getShapeContainers`, `getNationalShapeForCountry` |
| **Political Parties** (§3, partial) | domain + data | — (used by Onboarding's step 4) | Only `getPoliticalParties` ported |
| **Elections** (§3/§4.A.5/§4.A.6/§4.A.7, partial) | domain + data + presentation | Find My District, Elections list | `resolveRepresentationBranch` (full port, including the national/container superior lookup), `getActiveSeatsByShapeIds`, `getActiveSeats`, a lightweight per-seat candidate count. **Not ported**: `enrichOfficeHolders`'s name-matching contact fallback (see `elections_remote_data_source.dart`'s header), Seat Detail's full read side, `getSeatById`'s slug-resolution fallback chain |
| **Find My District** (§4.A.10) | — | Full screen | GPS detect → representation branch tree (tabbed by branch) + "Candidates in Your Area" seat cards. Missing: manual search/raw-lat-lng fallback, "Set as my location" (§4.I), anonymous rep-list preview cap (deliberately — see the provider's header comment) |
| **Politician Wall** (§4.A.9, partial) | domain + data + presentation | Read side + Support toggle | `getWallOwnerProfile`/`getWallOwnerProfileBySlug` (full fallback chain: redirect → exact slug → name match → UUID), `getSupporterCount`, `getWallPosts`, signed-in support toggle. **Not ported**: the composer (`createWallPost`), owner-only View Supporters dashboard + realtime, QR-code share, News-mentions sub-page, anonymous support (§4.I.7), `enrichProfileWithContactFallback` |
| **Posts** (shared domain) | domain + data | — (used by Feed + Politician Wall) | Full `Post`/`Comment` entities with voting fields and embedded comments |
| **Feed** (§4.D) | domain + data + presentation | Full screen — the app's home shell | Per-boundary + Country + International tabs, text-only composer, vote (optimistic), comments, politician-engagement sort. **Not ported**: All-Feeds master tab + boundary-type filter chips, active-election banner, image/video/link-preview composer, @mentions, civic-score header, Burn Identity shortcut (that's on Profile instead) |
| **Profile** (§4.E) | domain + data + presentation | View + Edit | View: General Info, Political Details (+ Switch to Citizen), Privacy & Ghost ID (score + Rotate/Burn). Edit: reuses Onboarding's step widgets (Basic Info → Location → Political Details). **Not ported**: avatar upload/display, rotation-history line |
| **Set Location** (§4.I.8) | — (reuses Profile + Boundaries) | Full screen | Small by design — detect location, sync memberships, save |
| **Router guards** (§1) | — | — | **All three layers now built**: signed-in → `/auth`, `onboarding_completed` → `/onboarding`, `needsLocationProvider` (politician + zero memberships) → `/set-location` |
| **News** (§4.A.2/§4.A.3) | domain + data + presentation | List + article detail | Body renders as plain text (no markdown renderer yet). **Not ported**: category/topic browsing (§4.A.4), tagged-politician strip, comment thread |
| **Seat Detail + Community Support** (§4.A.7/§4.I.7) | domain + data + presentation | Full screen | Vote-share bars, Leading/Tied badges (ported the tie-detection fix from `ElectionResultsPanel.tsx`), signed-in Support toggle (optimistic + rollback), reuses `PoliticianWallRepository`'s support methods rather than duplicating them. **Not ported**: Candidate Interview tab (video), Nominate Yourself, Election Administrator panel, anonymous support, rating |
| **My Elections** (§4.F) | domain + data + presentation | Full screen — Politician only | My Candidacies (withdraw with confirm) + Open Seats Near You (apply) + My Admin Applications (read-only list, see Election Administrator row below). **Not ported**: "Browse a Different Area" (needs a country→container→type search UI this app has no widget for yet). Note: `apply_for_election_admin` has no role restriction (any signed-in user can volunteer), but this screen is only reachable from Profile's politician-only "My Elections" button — a citizen has no nav path to it yet |
| **Candidacy Wall** (§4.A.8) | domain + data + presentation | Full screen | Profile card (avatar, party, role/boundary, statement, bio) + Support toggle (reuses `PoliticianWallRepository`'s support methods directly, keyed by politician id — no separate "candidacy support" concept), questionnaire section ported from `getPublicCandidateAnswers` rendering all 5 question types (`AnswerValue.tsx`'s single/multiple choice, text, rating, ranking). Seat Detail's candidate rows now open here (not the standing Wall) on tap, matching the web's "click a candidate → see their candidacy" flow. **Not ported**: Candidacy Wall's own post feed + pitch videos, answer comments, inline star-rating review — need video/nested-comment infra this app doesn't have yet |
| **Claim Candidacy** (§4.H, Flow B only) | domain + data + presentation | Inline on Candidacy Wall | `request_candidacy_claim` RPC — a citizen/politician says "this is me" on an admin-added, unclaimed candidate row, reviewed later by an election admin. Gated on `CandidacyDetail.isUnclaimedStub` (`added_by_election_admin_id != null && claimed_at == null`) — the real schema condition, **not** the web's own `candidate.is_unregistered` (a dead field: not a real column, and no query in `src/lib/services/elections.ts` ever sets it, so `CandidacyWall.tsx`'s claim-form branch is unreachable on the website as currently written). **Not ported**: Flow A (`claim_candidacy_via_token`, the email-invite deep link) — needs Universal Links (§1) this app's router doesn't handle yet |
| **Election Administrator** (§4.I.5, self-service half only) | domain + data + presentation | Inline on Seat Detail + My Elections | Collapsible "Seat Administrator" panel on Seat Detail: `get_seat_admin_status` RPC drives the approved/pending/rejected/volunteer states, `apply_for_election_admin` RPC submits the volunteer form (any signed-in user, no role check server-side). My Elections lists the viewer's own applications read-only. **Not ported**: application review (`review_election_admin_application` requires `profiles.role = 'admin'` — a site-admin role this app has no UI for at all, per profile_screen.dart) and the admin console an approved administrator would use (Add Candidate Stub, review claim requests, search/invite-to-claim, the Twilio/Grok voice-call flow) — same "separate, larger effort" bucket as Candidate Application |
| **Legal & static pages** (§4.A.12) | — | 5 screens (About/Privacy/Terms/Corrections/Editorial Standards) | One generic `StaticContentScreen` fed by an enum, no data layer — linked from Profile's footer |
| **Shared avatar handling** (`core/widgets/app_avatar.dart`) | — | — | Every network avatar in the app goes through `AppAvatar`, which catches a failed image load (caught live: a broken Supabase Storage URL threw an uncaught exception and left a blank circle) and falls back to initials/an icon instead of a raw `CircleAvatar`+`NetworkImage` pair |
| **Haptics** (`core/utils/haptics.dart`) | — | — | `AppHaptics.tap()` on every vote/Support toggle, `AppHaptics.destructiveConfirm()` on Burn Identity/Withdraw Candidacy confirms — the free physical feedback §8 of the parent guide calls out as something the web literally cannot provide |
| **Candidate Application** (§4.G, Written Questionnaire mode only) | domain + data + presentation | Full screen, reachable from My Elections' candidacy rows (edit icon) and from Candidacy Wall (owner-only "Answer Application Questions" nudge) | Statement (explicit save), intro-video recording via `image_picker`'s `pickVideo(source: ImageSource.camera)` — delegates to the OS's native camera app rather than a custom in-app camera preview, uploaded to the `politician_videos` storage bucket — and the full questionnaire, editable per type: single/multiple choice, free text, 1–5 rating, and drag-to-reorder ranking (`ReorderableListView`, replacing the web's manual HTML drag-and-drop). Submits via `submit_candidate_application` (auto-approves server-side). **Not ported**: the Video Interview reels-style player (`CandidateVideoInterviewPlayer.tsx` — a full-screen, one-question-at-a-time flow with its own per-answer video recording), the "choose your questions" screen, `upsertAnswerPitchPost` (posting a video answer to the wall as a feed post), and answer comments — all built on the same `election_candidate_answers` rows this screen already writes, so none of it needs a schema change if it's added later |
| Everything else in the Flutter guide's §4 inventory | — | — | Not started: the Election Administrator console (see row above), Officeholder Claim (needs the same email-invite deep-link infra Claim Candidacy Flow A does), global search (the header's search pill is currently a stub) |

`domain/auth/`, `data/auth/`, and `presentation/features/auth/` remain the reference
vertical slice to copy for folder structure and naming — Profile/Boundaries/Onboarding
follow the same shape, just with a `Notifier`-based form controller (`OnboardingController`)
instead of Auth's simpler `AsyncNotifier<void>`, since Onboarding has real in-progress form
state to hold (see `onboarding_providers.dart`'s header comment on why).

What Auth intentionally does NOT include yet (see the inline `// Not yet ported` comment at
the top of `sign_in_screen.dart` and `docs/FLUTTER_MOBILE_APP_GUIDE.md` §4.B/§1 in the parent
repo for the full spec of what's still missing):
- Google OAuth (needs the `google_sign_in` package + native platform config)
- The password-recovery deep link (needs `app_links` wired to a route — see
  `core/router/app_router.dart`'s routing TODO and the parent repo's Flutter guide §1's
  Universal Links section)
- The founder-count signup nudge (cosmetic, explicitly marked skippable in the guide)

## How to add the next feature (e.g. Onboarding, or Feed)

1. Read that screen's entry in `docs/FLUTTER_MOBILE_APP_GUIDE.md` §4 (parent repo) — it
   already names the exact website source files and every service/RPC call the screen needs.
2. `domain/<feature>/entities/` — model the shape of the data as plain Dart classes. Look at
   `domain/auth/entities/app_user.dart` for the pattern: only what the rest of the app
   actually needs to know, not a 1:1 copy of the Postgres row.
3. `domain/<feature>/repositories/<feature>_repository.dart` — the abstract interface,
   `Future<Result<T>>` for every method.
4. `data/<feature>/datasources/` — port the matching `src/lib/services/<domain>.ts`
   function(s) as near-verbatim Dart.
5. `data/<feature>/models/` + `data/<feature>/repositories/<feature>_repository_impl.dart` —
   map + implement, exactly like `data/auth/`.
6. `presentation/features/<feature>/providers/` — wire the above into providers a screen can
   watch, exactly like `presentation/features/auth/providers/auth_providers.dart`.
7. `presentation/features/<feature>/screens/` — build the screen. Reach for `core/widgets/
   widgets.dart` and `ChosenoTheme.of(context)` for every visual decision; never a raw
   `Container` with a hand-picked color (see DESIGN.md).
8. Register the route in `core/router/app_router.dart`, extending the redirect guard if the
   screen has a new gating rule (onboarding-completed, a role check, etc. — see that file's
   header comment for the two guard layers not yet added).

## App shell — bottom navigation, no top app bar (product direction)

The five primary destinations (Feed, Find My District, Elections, News, Profile) live behind
one persistent bottom `NavigationBar`, built with go_router's `StatefulShellRoute.indexedStack`
(`presentation/common/widgets/app_shell.dart`) rather than a plain `IndexedStack` driven by
hand — the shell variant preserves each tab's own navigation stack and scroll position when
switching tabs for free. Per explicit product direction ("Snapchat-style: only bottom nav bar,
no app bar on top"), **none of these five screens use a Material `AppBar`** — each renders
`presentation/common/widgets/screen_header.dart`'s `ScreenHeader` instead (Snapchat-style: no
elevation, blends into the page background) as the first thing in its body.

**This only applies to the five shell screens.** Everything reached by pushing from one of them
(Seat Detail, Politician Wall, News Article, Edit Profile, Onboarding, Auth, Set Location) keeps
a real `AppBar` with a back button — those aren't primary destinations, and covering the bottom
nav while a detail screen is open (the standard "hide chrome on drill-down" pattern) is the
correct behavior, not an inconsistency to fix. When adding a new top-level destination, add it
as a `StatefulShellBranch` in `app_router.dart` and use `ScreenHeader`, not `AppBar`, inside it;
when adding a detail/push screen, use a normal `AppBar`.

**`ScreenHeader` is the Snapchat Chat-style bar:** `[avatar] [search]   Title   [action] [action]`.
Every control is a round 40pt softly-filled button (`HeaderIconButton` for the trailing actions);
the screen title is centred between the two clusters. An earlier version deliberately had no
title text (a brand mark + a wide search pill, and Feed stacked a second "What's happening"
pill under it) — that read as cluttered and was replaced per feedback asking for the Snapchat
layout. The avatar is the signed-in politician's photo, or the brand mark (`_ProfileButton` — a
plain themed circle/letter, since there's no logo image asset yet) for citizens, who are
anonymous and have none; either one opens the Profile tab. Search is still a stub (a "coming
soon" snackbar; the real backend isn't ported yet, §4.A.11). Because the bar now names the
screen, a screen's own `SectionHeader` must not repeat that title (News and Elections dropped
theirs). The widget lives under `presentation/`, not `core/widgets/`, because it reads the
signed-in profile and `core/` stays feature-agnostic.

**"My Wall" is a pseudo-tab in the bottom nav itself** (not a `ScreenHeader` action — an earlier
version put a redundant wall-shortcut icon in Feed's header, removed per feedback since it
duplicated the bottom nav's own Profile tab concept). It's spliced in at visual position 1
(right after Feed/Home), politician-only, and — as of the "My Wall isn't showing" bug fix below —
resolves even when `politician_profiles.wall_slug` is null. `UserProfile.myWallSlug` mirrors the
website's own `profile.politician_wall_slug || buildPoliticianWallSlug(fullName, designation)`
fallback (`NavBar.tsx`); without it, a freshly-onboarded politician with no `wall_slug` assigned
yet never saw the tab at all. Ported as `Slugs.buildPoliticianWallSlug`
(`core/utils/slugs.dart`) — the same utility `upsertPoliticianProfile` already used on the write
side to recompute `wall_slug` on every save. Because the pseudo-tab is spliced into the middle
of the list rather than appended at the end, `AppShell`'s `_visualIndexForBranch`/
`_branchIndexForVisual` translate between `NavigationBar`'s visual index and
`navigationShell`'s real branch index — see that file's header comment before changing the
destinations list.

**The bottom nav bar itself is a frosted, icon-only overlay**, not a solid strip — `AppShell`
wraps `NavigationBar` in a `BackdropFilter` blur over a semi-translucent `palette.surface`,
`labelBehavior: alwaysHide`, and sets `Scaffold(extendBody: true)` so each screen's content
actually scrolls underneath it. Every shell screen's scrollable content therefore adds
`kBottomNavClearance` (`app_shell.dart`) as its bottom padding — without it, the last item in a
list sits permanently hidden behind the floating bar. Copy this padding pattern for any new
scrollable content added to one of the five shell screens.

## Feed's composer is a header button that opens a sheet, not a permanent multi-line box

An earlier version of the feed composer was an always-expanded `TextField` inside a card, visible
and taking real vertical space above every post whether or not anyone was about to write one —
flagged directly ("Post [box] taking 1/4th of screen — check Facebook, they have like one line
only when user clicks post expands"). It then became a single-line pill under the header, and is now the
compose button in `ScreenHeader`'s trailing slot (Snapchat's "new chat" position) — one less
full-width bar stacked on the search. `showFeedComposeSheet` opens a `showModalBottomSheet`
containing the actual multi-line compose UI (`_ComposeSheet`, same
file), which manages its own local submitting/error state independent of `FeedController` —
simpler than threading the parent's `AsyncNotifier` state into a sheet that's built once at
open time and wouldn't naturally see later rebuilds. `FeedController.submitPost`'s
`Future<bool>` return value is exactly what the sheet needs: await it, pop on `true`, show an
inline error and stay open on `false`.

## Feed's tabs are a real `TabController` + `TabBarView`, not just a tappable `TabBar`

An earlier version of `FeedScreen` used a `TabBar` whose `onTap` flipped a variable, with the
post list rendered separately below — tapping a tab worked, but swiping between tabs did
nothing, a real gap caught in testing on a real device. `FeedScreen` now owns an explicit
`TabController` (`SingleTickerProviderStateMixin`) wired to both `TabBar` and `TabBarView`,
with a listener that calls `FeedController.selectTab` on every index change regardless of
whether it came from a tap or a swipe. Copy this pattern (an explicit `TabController`, not
`DefaultTabController` + a lone `TabBar`) anywhere else tabbed content needs to feel native —
`DefaultTabController` alone is fine when nothing outside the tab bar needs to react to the
selected index, but Feed's per-tab lazy post-fetching does.

## State of the route guard (`core/router/app_router.dart`)

Two of three guard layers the Flutter guide specifies are implemented:

| Layer | Status | Add when |
|---|---|---|
| Signed-in vs. signed-out → `/auth` | ✅ Built | — |
| `profiles.onboarding_completed` → `/onboarding` | ✅ Built | — |
| `LocationRequiredGate` → `/set-location` (politician, claimed via interview invite, zero boundary memberships — Flutter guide §1/§4.I.8) | ⬜ Not built | Claim Candidacy (§4.H) exists — this gate only matters once that flow can produce the edge case it guards against |

Add the remaining layer as its own check inside the existing `redirect:` callback, following
the same pattern the onboarding check already uses (`ref.read` a provider, branch on its
value, add a `ref.listen` hookup in `_RouterRefreshListenable` if the underlying data isn't
already covered by an existing listener) — don't recompute it on every navigation, see the
guide's note on the redirect-loop bug that caused on web.

## Environment / running the app

1. `cp .env.example .env` and fill in your Supabase project's URL + anon key.
2. `flutter pub get`
3. `flutter run`

`.env` is git-ignored but declared as a Flutter asset (`pubspec.yaml`) so
`flutter_dotenv` can bundle it — the app will throw a clear `StateError` on startup
(`core/config/env_config.dart`) if it's missing or incomplete, rather than failing with an
opaque Supabase connection error.

## Testing

`test/` mirrors `lib/`'s folder structure. Two kinds of test exist so far, and both patterns
should continue: a pure-Dart unit test for anything in `domain/`/`core/theme/` (no Flutter
widgets involved, see `test/core/theme/theme_config_test.dart`), and a `testWidgets` test for
a shared widget wrapped in just enough `MaterialApp`/`Theme` to render it (see
`test/core/widgets/app_badge_test.dart`) — never pump the whole `ChosenoApp`, since that
requires a real `Supabase.initialize()` call. A repository implementation is the natural
place for a mocked-datasource unit test once a feature's data layer is non-trivial; none
exists yet because `AuthRepositoryImpl` has no branching logic of its own beyond
exception-to-`AppFailure` mapping.

## Location, environment, and profile-write rules (learned the hard way)

**Dev vs. release data (`core/config/app_environment.dart`).** The web's `isDevEnvironment()` neither
hides `is_test` rows on reads nor writes `is_test = false` — a developer's own test account
(`profiles.is_test = true`) has to be able to open its own wall. The mobile data layer used to
hardcode `is_test = false` everywhere, so such an account's wall/posts/candidacy could never
resolve ("politician wall not found for my profile"). `AppEnvironment.isDev` (`!kReleaseMode`) now
gates every `is_test` read filter and write flag; a release build hides test data like production
web. Any new query on a table with `is_test` must go through it.

**Location is one shared layer (`presentation/features/location/`).** Address search (Nominatim,
`us,ca,in`, 450ms debounce — `AddressSearchField`), tap-to-pick map (`flutter_map`, CARTO dark
tiles — `LocationPickerMap`), and `resolveAndSyncLocation` (find boundaries, then sync memberships —
the web's `lookupBoundaries`) are used by Find My District, Onboarding, Edit Profile, Set Location,
and the Elections "look up a location" sheet. `accountDistrictsProvider` is the account's saved
districts — the app-wide "my location".

**Elections is scoped to the account's districts, never the platform.** Same as the web's
`ElectionsPageClient`: saved districts → `getActiveSeatsByShapeIds`; no districts → an empty state
pointing at Find My District. `electionsScopeOverrideProvider` holds an in-session "look up another
place" override that never touches the profile.

**Profile writes are merges.** `profiles`/`politician_profiles` are upserted as whole rows, so a
form that omits a field nulls it. `ProfileRepository.upsertPoliticianProfile` now merges with the
stored row (null argument = keep, empty string = clear) and keeps a database-disambiguated
`wall_slug`; Edit Profile pre-fills from `getPoliticianDetails` and only overwrites
country/constituency/target boundary when a new location was actually picked. Onboarding now also
writes the target boundary and the avatar (`politician-avatars` bucket), as the web does.

**Candidate Application submit gates** mirror `submit_candidate_application`: intro video required,
every required question answered, and a ranking counts only when every option is ranked — default
rankings are persisted on load, the statement is saved on submit, and text answers save on blur.
