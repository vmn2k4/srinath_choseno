# Next.js migration checklist

Working branch: `nextjs-migration`. New app lives in `next-app/` during the migration (so it
coexists with the untouched Vite app at repo root without file collisions); at cutover
(Phase 8) its contents move to the repo root and the old Vite `src/` tree is deleted. Full
architecture rationale: see the approved plan this file was seeded from (component library
split, services-layer client-param refactor, SEO/metadata strategy, etc.) — this file tracks
*progress*, not the *why*; don't duplicate that reasoning here as phases get checked off.

Every item below gets browser-verified against `next dev` before being checked off — no item
is done on code-review alone (project standard).

## Phase 1 — Foundation

- [x] New branch `nextjs-migration` created off `main`.
- [x] Next.js 16.3.0 (App Router) + TypeScript + Tailwind v4 scaffolded in `next-app/`
      (`create-next-app`, `--src-dir`, import alias `@/*`).
- [x] `.claude/launch.json` gained a `choseno-next-dev` config (`npm --prefix next-app run dev`).
- [x] Design tokens ported: `next-app/src/app/globals.css` — full `@theme` block + all 12
      `[data-theme]` overrides, elevation utilities, ambient background, orbs — copied verbatim
      from `src/index.css`. Verified rendering correctly in-browser (glass card, dark theme,
      radial gradient) via a placeholder `page.tsx`.
- [x] Fonts moved to `next/font/google` (`Public_Sans`, `Big_Shoulders`) instead of the old
      CSS `@import`. **Note for later phases**: the old CSS referenced "Big Shoulders
      *Display*" — Google Fonts merged that into the single variable "Big Shoulders"
      superfamily, and next/font/google's font list only recognizes the merged name. Using
      `Big_Shoulders` renders correctly; revisit if a specific static (non-variable) cut is
      ever needed.
- [x] Root metadata (`title`/`description`) set in `layout.tsx` via the `Metadata` export —
      confirmed rendering in the browser tab title.
- [x] `@supabase/supabase-js` + `@supabase/ssr` installed.
- [x] `next-app/.env.local` created (copied `NEXT_PUBLIC_SUPABASE_URL`/`_ANON_KEY` from the
      Vite app's `.env.local`; gitignored by default in the Next.js scaffold).
- [x] `src/lib/supabase/client.ts` (`createBrowserClient`) and `server.ts`
      (`createServerClient`, async `cookies()` per Next 16) written, following the
      `@supabase/ssr` documented pattern.
- [x] `src/lib/supabase/types.ts` generated from the **live linked project**
      (`supabase gen types typescript --linked` — the Supabase CLI is correctly linked to
      `qlzyfdwrkcxyqapewxwg`; the MCP Supabase connector in this environment points at an
      unrelated/wrong project per `ARCHITECTURE.md` §2 and must not be used for this).
- [x] `AuthContext` ported (`src/contexts/AuthContext.tsx`) — same self-healing-profile-row
      behavior, same TOKEN_REFRESHED/SIGNED_IN dedup logic, same stable-`user`-reference memo
      as the Vite version. Needed two service files as dependencies, ported early
      (`src/lib/services/auth.ts` in full; `profile.ts` partially — just `getOwnProfile` +
      `fetchOrHealProfile`, the rest lands in Phase 4 with the other service files).
- [x] `ThemeContext` ported (`src/contexts/ThemeContext.tsx`) — site-wide theme from
      `site_settings` via `src/lib/services/settings.ts` (+ `src/lib/utils/apiCache.ts`,
      ported unchanged). **Verified against the live database**: the placeholder home page
      rendered in a *non-default* theme (a light palette), matching whatever the real
      `site_settings` row currently holds — proof the fetch → context → `data-theme` DOM
      attribute → CSS round-trip works end-to-end against production data, not just a mock.
- [x] Root layout gets the real nav shell — `src/components/NavBar.tsx`, ported from
      `MainLayout.jsx`. Also added a **News** link visible in both the signed-in and
      signed-out branches (decided earlier in the News-feature brainstorm this migration grew
      out of — unlike Elections, which stays public-but-unlinked for logged-out visitors,
      News needs to be discoverable without an account). `ChosenoLogo` ported ahead of the
      rest of Phase 2 since the nav shell needed it (`src/components/primitives/ChosenoLogo.tsx`).
- [x] `npm --prefix next-app run lint` clean, `npx tsc --noEmit` clean (fixed 4 real type
      errors along the way: `onAuthStateChange`'s callback needed to be `async`, two
      Supabase-builder-return casts needed `as unknown as T` instead of a direct cast, and
      `fetchWithCache`'s fetcher param needed `PromiseLike` instead of `Promise` since
      Supabase query builders are thenables, not native Promises).
- [x] Verified clean in a fresh browser tab (no console errors, correct title, nav renders
      with real session-aware links, theme pulled from live data) — confirmed the earlier
      barrage of `</content>` parse errors seen mid-session (an artifact from how several
      files were initially written) were fully resolved and were not masking anything else.

**Phase 1 complete.**

## Phase 2 — Primitives + gap-fill components
- [x] `ChosenoLogo` (ported early in Phase 1 for the nav shell).
- [x] Ported the remaining 13 existing `ui/` components into `src/components/primitives/` with
      typed props: `Card`, `Button`, `Badge`, `Modal`, `StoryViewerModal`, `RemoveMediaButton`,
      `Input`, `Textarea`, `Select`, `Spinner`, `EmptyState`, `PageHeader`, `ContainerScroll`.
      Polymorphic `as` prop on `Card`/`Button` kept and properly generic-typed (`<T extends
      ElementType>`) rather than dropped, since `ThemeAdmin.jsx` (`as="button"`) and future
      link-styled buttons depend on it.
- [x] Built the 7 missing primitives found hand-rolled repeatedly in the inventory: `Alert`
      (no equivalent existed — AuthPage/ElectionSeatPage/CandidacyWall each hand-rolled their
      own status message), `Checkbox`, `Radio` (native-input-based, `accent-primary` themed),
      `Tabs` (supports both `href` route tabs for `AdminSubNav`-style nav and `onChange`
      in-page tabs for `FeedPage`/`PoliticianWall`-style switching, one component for both),
      `Avatar` (image-or-initial-on-gradient, was reimplemented independently 4×), `Popover`
      (anchored floating panel with click-outside-to-close — `PoliticianWall`'s QR button had
      none of that), `ConfirmDialog` (replaces every `window.confirm()` call — burn identity,
      withdraw candidacy, all the admin deletes — with a themed in-app modal; also closes the
      Flutter-parity gap native `confirm()` left, since it has no mobile equivalent).
- [x] Two real TS-only bugs caught and fixed that plain JS would have hidden: `Input`/`Select`
      intersecting a custom `size` prop with `ComponentPropsWithoutRef` collided with the
      *native* HTML `size` attribute both elements already have, collapsing the prop's type to
      `never` — fixed with `Omit<..., "size">`.
- [x] Verified all 20 primitives together in a temporary `/showcase` route (every variant of
      every component, plus interactive checks — clicked through `Popover` open/click-outside
      close and `ConfirmDialog` open/cancel/confirm) rendered against the **live theme** (the
      real `site_settings` row currently holds `sky-cyan`) with zero console errors, then
      deleted the route. `tsc --noEmit` and `eslint` both clean.

**Phase 2 complete.**

## Phase 3 — Feature components
All built under `src/components/features/` (the domain-aware tier, composing primitives —
see the architecture doc's two-tier split).
- [x] Two dependencies pulled forward that weren't on the original Phase 3 list but are hard
      requirements of `PostCard`: `LinkPreview` (ported as-is, still a client-side Microlink
      call — flagged as a good candidate to move server-side later, not a regression) and
      `src/lib/utils/ghostName.ts`/`ratingScale.ts` (pure utils, trivial ports).
- [x] `VoteBar`, `CommentComposer`, `ChipGroup` — small, independent.
- [x] **`PostCard`** — the single biggest reuse win identified in the inventory: unifies
      `FeedPage.jsx`'s inline post markup (vote bar, civic-score badge) and
      `WallPostFeed.jsx`'s card (owner spotlight section for candidate replies). One
      component, parameterized by `showVoteBar`/`onVote` (Feed) and `ownerGhostId` (Wall) —
      a plain Feed post just never sets `ownerGhostId`, so the spotlight logic is a no-op
      for it rather than a separate code path.
- [x] `StoryStrip` — extracted from FeedPage's video-story thumbnail strip.
- [x] `MediaAttachButton` and `AvatarUploader` — kept as two separate components rather than
      one, since they're genuinely different UX patterns despite superficial similarity:
      `MediaAttachButton` (FeedPage's composer) defers upload to submit time and hands back a
      local File + preview; `AvatarUploader` (StepPolitician) uploads immediately on
      selection and shows a spinner overlay. Neither has a direct Supabase dependency —
      `AvatarUploader` takes the actual upload call as an injected `onUpload` prop, wired to
      the real service in Phase 6.
- [x] `ChoiceCard` — unifies `StepRole.jsx`'s role picker and `EditProfileFlow`'s inline
      `StepBasicInfo` role cards.
- [x] `RatingScale` — unifies `AnswerValue.jsx`'s read-only display dots and
      `CandidateApplication.jsx`'s interactive selector (same `RATING_SCALE` constant, two
      previously-independent renderings); one component, `onChange` presence toggles mode.
- [x] `CascadingBoundarySelector` — presentational only (Country → container type →
      container selects); the page owns data-fetching via Phase 4's boundaries service. Unifies
      the pattern found hand-rolled in `PoliticianElections`, `ElectionsAdmin`,
      `BoundaryVisualizer`, and `RedistrictingPanel`.
- [x] `ProfileWizard` — **shell only** (progress bar/dots + Card frame), by design: the actual
      step content (`StepLocation`, `StepPolitician`, etc.) needs services not ported until
      Phase 4 and live browser APIs (geolocation), so it's composed as `children` in Phase 6
      rather than baked in here.
- [x] One real lint bug caught and fixed along the way: `LinkPreview`'s effect called
      `setState` synchronously for the "metadata already provided as a prop" case — React's
      `react-hooks/set-state-in-effect` rule flagged it. Fixed by deriving the rendered value
      as `metadata || fetched` instead of mirroring the prop into state, so the effect has
      nothing to do when metadata is already known. A follow-up fix was also needed for the
      `onMetadataFetched` callback dependency: moved it into a ref (updated via its own effect,
      not during render — a second, newer lint rule, `react-hooks/refs`, caught the naive
      "assign ref during render" version of this fix) instead of the dependency array, since
      it's a "notify me when done" callback, not a value the fetch should rerun for.
- [x] Verified all 11 components in a temporary `/showcase` route with mock data (both
      `PostCard` modes, `ChoiceCard`/`RatingScale` interactivity click-tested, all others
      visually confirmed against the live theme), zero console errors, then deleted the route.
      `tsc --noEmit` and `eslint` both clean.

**Phase 3 complete.**

## Phase 4 — Services layer port
- [x] All 11 files ported with the `supabase` client as first param: `auth.ts`, `settings.ts`
      (both done in Phase 1 as context dependencies), `boundaries.ts`, `elections.ts`,
      `feed.ts`, `politicalParties.ts`, `politicianWall.ts`, `profile.ts` (completed — the
      rest of the functions beyond Phase 1's `getOwnProfile`/`fetchOrHealProfile`),
      `video.ts`, `analytics.ts`, `candidateSync.ts`.
- [x] Two real bugs found and fixed during the port (not a mechanical copy where it mattered):
  - **`analytics.ts`'s DAU/WAU/MAU query was measuring nothing.** The original queried
    `posts`/`comments` for a `user_id` column that doesn't exist in this schema (both tables
    key on `ghost_id` only — deliberately unlinkable from a real profile, ARCHITECTURE.md §3).
    That query silently returned no rows rather than erroring, so active-user counts always
    fell through to the `dnu`/profile-count floor and never reflected real activity. Switched
    to `ghost_id` — confirmed against the live database post-fix: WAU jumped from what would
    have been a flat fallback number to a real `14`, MAU real, matching actual post/comment
    activity. `ghost_id` is an imperfect proxy for "unique person" (a burn rotates it), but
    it's the only signal available at all without breaking the anonymity model.
  - Several RPC calls (`insert_map_shape`, `apply_for_seat`, `apply_for_election_admin`,
    `add_unregistered_candidate`, `update_unregistered_candidate`, `request_candidacy_claim`)
    needed scoped `as unknown as {...}` casts at the call site: Supabase's generated types mark
    params without a SQL `DEFAULT` as required/non-nullable, which doesn't reflect the actual
    runtime behavior (Postgres accepts explicit NULL for a plain-typed param fine) — the
    original JS always passed `null` for these successfully. Preserved that real behavior
    with a documented cast rather than force the function's own external signature to lie
    about accepting non-null values it doesn't actually require.
- [x] **Verified against the live database**, not just type-checked: a temporary route called
      `getElections`, `getCountries`, `getPoliticalParties`, `getRecentMapShapes`,
      `getActiveSeats`, and `getAdminAnalyticsMetrics` directly. All returned real data except
      `getRecentMapShapes`, which hit a genuine Postgres statement timeout on the live
      `map_shapes` table — a **pre-existing data-scale condition** (this table holds hundreds
      of thousands of rows per ARCHITECTURE.md §§6/10-11), not a regression from this port
      (query is byte-identical to the original). Flagging here rather than silently fixing it,
      since changing query/indexing strategy is out of scope for a services port.
      `getActiveSeats` correctly hit PostgREST's 1000-row cap (unpaginated in the original
      too — faithful behavior, not a new bug).
- [x] `tsc --noEmit` and `eslint` both clean.

**Phase 4 complete.**

## Phase 5 — Public/SEO pages
- [ ] Home (`/`)
- [ ] Elections list (`/elections`)
- [ ] Election Seat (`/elections/seat/[seatId]`) — `generateMetadata` + `next/og`
- [ ] Candidacy Wall (`/candidacy/[candidateId]`) — `generateMetadata` + `next/og`
- [ ] Politician Wall (`/wall/[ghostId]`, `/wall/[ghostId]/[slug]`) — **auth-gate + null-safety
      fix included**, `generateMetadata` + `next/og`
- [ ] News (`/news`, `/news/[slug]`) — built fresh, no Vite version exists
- [ ] Claim (`/claim/[token]`)
- [ ] `robots.ts` / `sitemap.ts`

## Phase 6 — Authenticated app pages
- [ ] Onboarding (via `ProfileWizard`)
- [ ] Feed
- [ ] Profile + Edit (via `ProfileWizard`)
- [ ] Politician Elections
- [ ] Candidate Application

## Phase 7 — Admin pages
- [ ] `/admin` (+ `BoundaryUploadsPanel`, `RedistrictingPanel` sub-panels)
- [ ] `/admin/analytics`
- [ ] `/admin/elections` (largest page in the app)
- [ ] `/admin/election-admins`
- [ ] `/admin/visualize`
- [ ] `/admin/theme`

## Phase 8 — Cutover
- [ ] Full parity verification pass across every route above.
- [ ] SEO tooling pass on Phase 5 pages: Facebook Sharing Debugger, X Card Validator, LinkedIn
      Post Inspector, Lighthouse (Home + one entity page).
- [ ] Move `next-app/*` to repo root, delete the old Vite `src/`/`vite.config.js`/etc.
- [ ] Merge `nextjs-migration` → `main`, deploy.
</content>
