# Audit remediation tracker

Source: the migration audit delivered 2026-08-04 (full findings in the published artifact —
ask to see it again if needed, or re-read the summary in that conversation). This file is the
living checklist for fixing everything the audit found. **If a session gets interrupted or
something breaks, start here**: find the first unchecked item, read its notes, and continue —
don't re-derive scope from scratch.

Working rule for this pass: every fix gets `tsc --noEmit` + `npm run lint` clean, and a real
browser check (or a live-DB query check for anything with no UI) before being marked done —
same standard as the original migration. No item gets checked off on code-review alone.

**2026-08-04 update — token-efficiency instruction from user ("fix all issues and finally check
visually as we have less tokens"):** verification standard relaxed for the rest of this pass.
Everything below is being verified with `tsc --noEmit` after each file group (fast, cheap,
run constantly) instead of a browser check per step. ONE consolidated browser/build check
happens at the very end instead of continuously. This is intentional, not a shortcut taken
silently.

**Deliberate scope trade-off (P1 Candidacy Wall / Politician Wall / Election Seat):** rather
than a full server/client decomposition of these three large (700+ line) existing Client
Components, they were fixed with a cheaper **"seed with server data"** pattern instead: the
page.tsx now fetches everything server-side and passes it in as `initial*` props; the Client
Component seeds its `useState()` from those props and only re-fetches in the background
(guarded so `setLoading(true)` doesn't fire on the initial mount). Because Next.js still
server-renders Client Components on first pass, this achieves the actual SEO goal — real
content in the initial server HTML — without the cost/risk of rewriting each component's
~700 lines from scratch. **What this trade-off leaves undone:** the `PostCard` unification
(retiring `WallPostFeed.tsx`'s duplicate, see Priority 5) was NOT done as part of this — Wall
and Candidacy Wall still render posts via the old `WallPostFeed` component, not the shared
`PostCard`. That unification is still open and tracked under Priority 5.

---

## Priority 1 — Rendering architecture (the audit's headline finding)

Goal: every public page's actual content is server-rendered; only genuinely interactive pieces
(composer, vote/support buttons, comment box) stay client-side, as small islands receiving
server-fetched initial data as props. `src/app/news/[slug]/page.tsx` is the reference shape.

- [x] **Home (`/`)** — DONE. `src/app/page.tsx` rewritten as a full Server Component; all
      framer-motion pieces extracted into `src/components/features/home/HomeMotion.tsx`
      (`HeroSection` owns its own `useRef`/`useScroll` since refs can't cross a Server
      Component boundary). Verified via `curl` that real copy appears in raw server HTML.
- [x] **Elections list (`/elections`)** — DONE. `src/app/elections/page.tsx` rewritten as a
      Server Component; `ElectionsPageClient.tsx` deleted. Pure-navigation cards changed from
      `onClick` + `router.push` to `Card as={Link} href={...}` (no client JS needed for nav).
- [x] **Election Seat (`/elections/seat/[seatId]`)** — DONE via the seed-with-server-data
      pattern (see trade-off note above), not a full decomposition.
- [x] **Candidacy Wall (`/candidacy/[candidateId]`)** — DONE via the seed-with-server-data
      pattern. `PostCard`/`WallPostFeed` unification NOT done — deferred, see note above and
      Priority 5.
- [x] **Politician Wall (`/wall/[ghostId]`, `/wall/[ghostId]/[slug]`)** — DONE via the
      seed-with-server-data pattern, both routes. Same `PostCard` deferral applies.
- [x] Re-ran `npm run build` after all fixes landed — succeeds cleanly. Route table markers:
      `/` static (○, fully prerendered — ideal, no per-request data needed), `/elections`,
      `/elections/seat/[seatId]`, `/candidacy/[candidateId]`, `/wall/[ghostId]`,
      `/wall/[ghostId]/[slug]`, `/news`, `/news/[slug]`, `/sitemap.xml` all dynamic (ƒ,
      server-rendered per request — expected, they fetch live DB data). `/feed` and `/admin/*`
      are static (○) because they're pure client components gated by client-side auth checks —
      unchanged from before this pass, not part of the P1 SSR conversion scope.
- [ ] Browser-verify each converted page — see the consolidated visual check below.

## Priority 2 — Sitemap, metadata, structured data

- [x] **`sitemap.ts`** — DONE. Now dynamic: queries `getPublishedNewsArticles` (limit 500),
      `getActiveSeats`, and `getCandidatesBySeatIds`, emits an entry per row alongside the 4
      static routes.
- [x] **Canonical URLs** — DONE on Home, Elections list, Election Seat, Candidacy Wall,
      Politician Wall (both routes), News article, and News list page (added this session).
- [x] **JSON-LD structured data** — DONE:
  - [x] Candidacy Wall — `Person` schema.
  - [x] Politician Wall — `Person` schema (both `/wall/[ghostId]` and `/wall/[ghostId]/[slug]`).
  - [x] Election Seat — `BreadcrumbList`.
  - [x] Home — `Organization` schema.
- [x] **`robots.ts`** — DONE. `/claim/` and `/apply/` added to the disallow list.
- [ ] **Dynamic OG images** (`next/og`/`ImageResponse`) — deferred to a fast-follow unless you
      want it in this pass; flag here as intentionally not done yet, not forgotten, if skipped.

## Priority 3 — Feature parity restoration

**2026-08-04 status: NOT STARTED.** Two background agents were dispatched to restore Admin
Elections and Feed respectively (with the old pre-migration Vite source recovered via
`git show a7caebf:src/pages/Admin/ElectionsAdmin.jsx` and
`git show 92e5371:src/pages/FeedPage/FeedPage.jsx` as reference material — worth re-fetching
those same two commit/path pairs if resuming this later, rather than re-deriving what changed).
Both agents failed before writing any changes (hit the session's usage limit while still in
their research phase) — **`ElectionsAdminClient.tsx` (426 lines) and `FeedPageClient.tsx`
(641 lines) are unmodified**, not partially edited, so it's safe to just restart this work
fresh rather than needing to audit for corruption first.

**Feed update:** restarted fresh in a later session and DONE — see the checked-off items
under Feed below. `FeedPageClient.tsx` grew from 641 to ~780 lines. Admin → Elections status
below may be stale if another session picked it up concurrently — check its own checkboxes
rather than trusting this paragraph.

### Admin → Elections (lost the most in the port)
- [x] Seat-building wizard: country → optional container → target boundary type → "Find
      Matching Boundaries" (via `findShapesInContainers`) or hand-pick via a boundary picker →
      role selection → `createElectionSeats`. **Note:** no map-based multi-select `BoundaryPicker`
      exists in the Next.js port (only `CascadingBoundarySelector`, a single-container dropdown
      trio, and `getBoundaryCandidates`, a flat id+name query clearly built for a picker that was
      never ported). Rather than build a new Leaflet map component, the wizard reuses
      `CascadingBoundarySelector` for country+container (single container, not the old
      multi-select checkbox list — a deliberate scope trade-off) and adds a plain checkbox
      list (filter box + scrollable list, capped at 500 rows) for the target-boundary hand-pick
      step, in the same no-map spirit as the existing `RedistrictingPanel.tsx`.
- [x] Delete seat (`deleteElectionSeat`) / delete candidate (`deleteCandidacy`) — wired on, both
      routed through `ConfirmDialog` (see below).
- [x] "Fetch candidates" official-source integration (`candidateSync` service) — per-seat
      button + result list + one-click add via `addFetchedCandidate`.
- [x] Candidate detail view: expand/collapse, statement, intro video, per-question answers via
      `AnswerValue`.
- [x] Candidate questionnaire builder: 4 question types, `allow_context`/`required`/
      `visible_to_public` toggles, add/delete question, options list for choice-type questions.
- [x] Fixed approve/reject to match the real business rule: confirmed via
      `supabase/migrations/20260802000003_fix_submit_auto_approve_regression.sql`'s own comment
      that `submit_candidate_application` already flips `status` to `'approved'` on submit
      (unless already `'rejected'`) — admin moderation is reject-only. Removed the Approve
      button entirely; only Reject (for submitted, non-rejected candidates) and Remove/delete
      remain.
- [x] `ElectionsAdminClient.tsx`'s `window.confirm()` (Priority 5 item, same file) — replaced
      with the `confirmTarget: {kind, id} | null` + shared `ConfirmDialog` pattern from
      `AdminPageClient.tsx`, covering election/seat/candidate/question deletes.
- **Lint note:** `tsc --noEmit` is clean. `npm run lint` on this file alone still reports 37
  errors, all `@typescript-eslint/no-explicit-any` (untyped Supabase join rows — `elections`,
  `seats`, `questions`, etc. are all `any[]`) and `react-hooks/set-state-in-effect` (the
  mount/reset effects call `fetchX()` / `setX(...)` directly, same as every sibling admin
  file). Deliberately not fixed here — this is the exact same pattern already present in
  `AdminPageClient.tsx`, `RedistrictingPanel.tsx`, and `BoundaryUploadsPanel.tsx` (verified via
  `npx eslint` on each), and is explicitly tracked as its own deferred Priority 6 cleanup
  (`no-explicit-any regressions` / `remaining react-hooks/set-state-in-effect`), not part of
  this Priority 3 feature-parity pass. Typing this file properly would mean threading real
  generated row types through every nested Supabase join used here, which is exactly the
  scope Priority 6 already carves out separately.

### Feed
- [x] Restore `PoliticianSidebar` (two-column layout, `lg:flex-row`) — component already
      existed complete (`src/components/features/PoliticianSidebar.tsx`, restored in an
      earlier pass), it just wasn't wired into `FeedPageClient.tsx`. Now rendered in a
      `flex flex-col lg:flex-row` layout, `w-full lg:w-80 shrink-0`, hidden for admins
      (no boundary scope to show candidates for).
- [x] Restore admin-role gating (`role === 'admin'` → locked notice, no composer/tabs/posts).
      Also hides the Impact Score / Burn Identity header controls for admins (matches the old
      app's `profile.role !== 'admin'` guards on those, not just the literal 3 items named).
- [x] Restore politician engagement-priority sort (likes+comments, politician-only) — applied
      via a shared `sortByPoliticianEngagement` helper on both the master-tab merged feed and
      the single-tab feed.
- [x] Restore the politician video-pitch composer (`VideoRecorder` in the Feed composer,
      wired into `createFeedPost`'s `videoUrl`) — button gated to `role === 'politician'`,
      `src/lib/services/feed.ts`'s `createFeedPost` already accepted `videoUrl`, no service
      change needed.
- [x] Fix the "All Feeds" boundary-type filter chips: now built from
      `new Set(memberships.map(m => m.boundary_type))` plus `Country`/`International`, instead
      of the hardcoded list.
- [x] Restore the "no local groups yet" empty-state notice (memberships.length === 0).
- [x] Restore the redirect-to-International fallback when `profile.country` is unset —
      implemented inside the existing profile-load effect (not a separate `useEffect`) to
      avoid tripping `react-hooks/set-state-in-effect` on a fresh occurrence.
- [x] Add back the 5MB client-side size check on Feed's image upload — same guard/message
      pattern as `AvatarUploader.tsx` (`Image must be less than 5MB`), shown inline instead of
      `alert(...)`.

## Priority 4 — News feature bug

- [x] Fixed the "Scheduled" status dead end via a new migration
      (`supabase/migrations/20260804000002_fix_news_scheduled_status.sql`, applied via
      `supabase db push --yes`): extended the publish-visibility RLS policy to also treat
      `status = 'scheduled' AND published_at <= now()` as publicly visible, rather than
      restricting the admin form.
- [x] Fixed `NewsComments.tsx`'s layering violation — direct `supabase.auth.getSession()`/
      `onAuthStateChange()` replaced with `getSession(supabase)`/`onAuthStateChange(supabase, ...)`
      from `services/auth.ts`; raw `.from("profiles").select("ghost_id")` (wrong column name)
      replaced with `getOwnProfile(supabase, user.id, { columns: "current_ghost_id" })` from
      `services/profile.ts`. Also fixed non-existent `text-error`/`bg-error`/`border-error`
      classes → real `-danger` token, 6 occurrences across `news/page.tsx` and
      `news/[slug]/page.tsx`.

## Priority 5 — Component & theme consistency sweep

- [ ] Unify Wall + Candidacy Wall onto `PostCard` (retire `WallPostFeed.tsx`'s duplicate) —
      **still open, deferred** (see the token-efficiency trade-off note near the top of this
      file). Both pages still render posts via `WallPostFeed`, not the shared `PostCard`.
- [x] Adopted `Avatar` primitive in all 4 spots: `CandidacyWall.tsx`, `ElectionSeatPageClient.tsx`
      (candidate switcher — kept the "has photo" badge overlay wrapped around `<Avatar>`),
      `PoliticianWallClient.tsx`, and now **`FeedPageClient.tsx`**'s profile-header avatar
      (`size="md"`, done as part of the Priority 3 Feed restoration pass in the same file).
- [x] Replaced all 4 `window.confirm()` calls with `ConfirmDialog`: `BoundaryUploadsPanel.tsx`
      (single delete-upload-batch target, converted to a `deleteTargetId` state + confirm/cancel
      handlers), `AdminPageClient.tsx` (both boundary-type and political-party deletes share one
      `confirmTarget: {kind, id} | null` state + dialog), and now **`ElectionsAdminClient.tsx`**
      (election/seat/candidate/question deletes share one `confirmTarget: {kind, id, label} |
      null` state + dialog, same pattern — done as part of the Priority 3 Admin Elections
      restoration pass in that same file).
- [x] Adopted `Alert` in `CandidacyWall.tsx` (the stub-candidate "listed by verified election
      administrator" claim-invite notice, `tone="warning"`, now wraps the claim form/status
      instead of a hand-rolled `bg-amber-500/10` div). `ElectionSeatPageClient.tsx`'s status
      messages are small inline one-line paragraphs (form field errors, application-status
      notices) rather than banner-style notices — left as plain text, converted their raw
      colors to tokens instead (see below); using the full `Alert` card treatment on every
      one-line inline message would look heavier than the original design intended.
- [x] Replaced raw Tailwind palette classes with semantic tokens:
      `ElectionSeatPageClient.tsx` (`emerald-*` → `success`/`success-light`, `amber-400` →
      `warning-light`, across 6 spots), `CandidacyWall.tsx` (folded into the `Alert` adoption
      above), `AnalyticsAdminClient.tsx:113,118,128,133` (`emerald-500`/`amber-500` →
      `success`/`warning`). **`VideoRecorder.tsx:176-177` DONE** (`amber-500`/`amber-300`/
      `amber-400` → `warning`/`warning-light`/`warning`), done as part of the Priority 3 Feed
      restoration pass since that component got wired into Feed's composer in that same pass.
      **`ChosenoLogo.tsx:66-67` confirmed as a deliberate brand-mark
      exception, not changed** — that's the "Choseno" wordmark's own fixed orange/amber
      identity color, not meant to re-theme with the site's semantic warning/danger tokens.

## Priority 6 — Code quality

- [x] Narrowed `eslint.config.mjs`'s `globalIgnores` to exclude `.claude/**` and
      `supabase/functions/**` — `npm run lint` went from 398 noisy issues to 224 real ones
      (163 errors, 61 warnings).
- [x] Fixed `no-explicit-any` in the three named service files:
      - `news.ts`: all 18 issues cleared (`error: any` → `PostgrestError | null`, blanket
        `as any` casts replaced with narrow `as unknown as <ExactShape>` only where the DB
        response genuinely doesn't structurally match the app-level type).
      - `boundaries.ts`: all 9 cleared — every occurrence was `Number(typeId/uploadId) as any`
        passed into a `.eq()`/`.rpc()` call; turns out the generated types have `id`/
        `upload_id` as `string` (UUID), not `number`, so `Number(...)` was actually wrong and
        the `as any` was masking a real type mismatch, not a spurious one. Fixed by using
        `String(...)` instead of `Number(...)` — correct now, not just quieter.
      - `elections.ts`: 1 cleared — `supabase.rpc("create_answer_comment" as any, ...)` had an
        unnecessary cast; the RPC and its exact `Args` shape already exist in the generated
        types, the cast predates a types regen and was just stale.
      Other files with `no-explicit-any` (`ElectionsAdminClient.tsx`, `OnboardingFlowClient.tsx`,
      `PoliticianElectionsClient.tsx`, `CandidateApplicationClient.tsx`, etc.) are NOT part of
      this pass — they're component files with `any[]` on ad-hoc Supabase join shapes, a bigger
      and lower-priority job than the three service files this item named. Total real lint
      count: 228 → 184 after `news.ts` + `boundaries.ts` + `elections.ts`.
- [ ] Clear `no-unused-vars` (mostly the dead imports from Priority 3's stripped-UI cleanup —
      should shrink a lot once those features are restored and actually use their imports).
- [ ] Fix `no-unused-expressions` (78 — investigate what pattern is causing these; wasn't
      present in the original Phase 1-4 port, so likely introduced in pages 5-8).
- [ ] Fix remaining `react-hooks/set-state-in-effect` (21, minus the ThemeContext one fixed
      separately below).
- [ ] Replace raw `<img>` with `next/image` where reasonable (13 occurrences) — skip any case
      where the image source is untrusted/arbitrary-domain content that would need
      `next.config.ts` domain allow-listing worked out first; note which those are.

## Priority 7 — Theme system bug

- [x] Removed the `localStorage` theme cache from `ThemeContext.tsx` — reverted to the DB-only
      fetch pattern from Phase 1 (`getSiteTheme`/`updateSiteTheme`, no `localStorage` reads or
      writes remain).

## Open questions (not blocking, flagged for you)

- `baseUrl = "https://choseno.app"` is hardcoded in `sitemap.ts` and every page's metadata —
  confirm this is the real production domain before/soon after this ships. Not changing it
  as part of this pass since I don't know the actual intended domain.
- Priority 2's dynamic OG image generation is scoped as optional/deferred unless you say
  otherwise — flag here if you want it included in this pass instead.
