# Screens & Features

A walkthrough of every screen in Choseno — what it's for, who can see it, and what you can
do there. For *why* things are built the way they are (schema decisions, RLS, bug fixes,
session-by-session history) see [ARCHITECTURE.md](../ARCHITECTURE.md). For candidate-data
sourcing specifically, see [ELECTION_DATA_SOURCES.md](ELECTION_DATA_SOURCES.md). This doc is
the "what's on the screen" reference — a product/UI map, not a build log.

**Three account roles** run through everything below: **Citizen** (`profiles.role='normal'`),
**Politician** (`'politician'`), and **Admin** (`'admin'`). A citizen can become a politician
(and back) from their own Profile page at any time — there's no separate signup path.

## Navigation shell

Every route renders inside `MainLayout` — a top nav bar (Choseno logo, Feed, Elections,
Admin if applicable, Profile, Sign Out) that swaps its links based on session state and role:
signed-out visitors only see "Log In / Sign Up"; citizens see Feed/Elections/Profile;
politicians see Feed/**Politician** Elections/Profile; admins see Feed/**Admin**/Profile (no
Elections link — admins don't belong to a constituency). **News** is visible to everyone,
signed in or not. Admin screens additionally get their own sub-nav (`AdminSubNav`):
**Boundaries** / **Analytics** / **Elections** / **Election Admins** / **Visualizer** /
**Theme** / **News**, since those seven live on separate top-level routes, not tabs of one
page.

---

## Public / marketing

### Home (`/`)
The logged-out landing page — a scroll-driven marketing site, not a functional screen.
Animated hero (parallax orbs, a cycling "Polling District → Federal Area → Country →
International" pill), a "How it works" 3-step explainer, a mocked product preview (fake
election-seat cards, not live data), role cards for Citizens/Politicians/Admins, a feature
grid (ghost identities, video-first issues, "I Support" endorsements, the four feed levels),
and a closing call-to-action. The primary button reads "Join Choseno" (→ `/auth`) when
signed out, or "Open your feed" (→ `/feed`) when already signed in.

### Sign in / sign up (`/auth`)
Single form, toggled between the two modes with one link at the bottom. Email + password
only (no OAuth). A brand-new account is **not** dropped straight into the app — the very
next thing that happens is onboarding.

---

## News

Added during the Next.js migration — a civic-news feature distinct from the constituency
Feed (editorial articles written by admins, not user posts), publicly discoverable without an
account (linked from the nav bar for both signed-in and signed-out visitors, unlike
Elections, which stays public-but-unlinked for logged-out visitors).

### News list (`/news`)
Public. Card grid of every published article (hero image, category badge, a 🔴 Breaking
News badge on flagged articles even when there's no hero image to overlay it on), newest
first.

### Article (`/news/[slug]`)
Public. Full markdown-rendered body (`NewsArticleBody`), hero image, category, published
date, estimated reading time, and an optional author byline (name, photo, short bio) pulled
from the article's own content JSON — a per-article credit, not tied to any `profiles` row.
Structured data (`NewsArticle` JSON-LD) is emitted for search-engine rich results. A comment
thread at the bottom (`NewsComments`) works exactly like a Feed/Wall comment thread —
anonymous, Ghost-ID, sign-in required to post.

### Admin → News (`/admin/news`)
Article authoring and lifecycle management, gated to `role='admin'`. Each article has a
status (`draft` → `scheduled` → `published`, or `archived`) — a scheduled article becomes
publicly visible automatically once its `published_at` time passes, no manual "publish"
click needed. The editor covers headline, slug, category, country/province scoping, hero
image (upload or paste a URL — this is a plain free-text field, not restricted to uploaded
images, which is why articles can reference arbitrary external image domains), a Breaking
News toggle, the markdown body, SEO title/meta description, and the optional author
byline fields. A raw-JSON paste mode exists as a power-user shortcut for the same fields.

---

## Onboarding (`/onboarding`)

A required first-run flow for any signed-in account that hasn't completed it yet
(`profiles.onboarding_completed`) — every other protected route redirects here until it's
done. A progress bar tracks steps; citizens get 3, politicians get 4.

1. **Role** — Citizen or Politician. Nothing else on this screen; picking one advances
   immediately.
2. **Location** — the core mechanic of the whole app. "Detect My Location" uses browser
   geolocation, then resolves *every* electoral boundary that point falls inside (not just
   one) via `find_boundaries_by_point`, and persists the full set via
   `sync_user_boundary_memberships`. If detection fails or nothing's mapped for the area yet,
   there's a manual fallback: search boundaries by name and add one directly, or type raw
   lat/lng coordinates. Matched boundaries render as chips (name + boundary type).
3. **Username** — for citizens, an *optional* display name plus a plain-language explainer
   of the Ghost ID system (posts are anonymous, tied to a rotating id, burnable anytime). For
   politicians, a *required* public full name ("this will appear on your public Wall").
4. **Politician details** (politicians only) — political party (dropdown, scoped to the
   country their location resolved to), education, hometown, and a free-text bio/platform.
   No office is chosen here — a politician nominates for whichever real election seat opens
   in their area later, from Politician Elections.

Submitting writes the profile, then hard-reloads to `/feed`.

---

## Feed (`/feed`)

The main citizen/politician home screen — everything here is scoped to the constituencies
you belong to.

- **Profile summary header**: avatar-initial, name, role badge, location, Ghost ID (first
  segment shown), a **Civic Impact Score** (10 pts/post, 5 pts/comment, +1/-1 per upvote/
  downvote your posts receive, with a manual **recalculate** action), and a **Burn Identity**
  button (generates a new anonymous id, orphaning all past posts/comments permanently — the
  confirmation dialog locks in your current score first, then you get a brand new identity).
- **Active-election banner** — one dismissible pill per election currently open in any of
  your boundaries (via `get_active_elections_for_user`), linking straight to that seat.
- **Composer** — always visible. Post text, an optional image (5MB cap), an optional link
  (auto-detected from pasted URLs, resolved into a rich preview card via `LinkPreview`), and
  — politicians only — a video pitch recorded in-browser (`VideoRecorder`). Every post is
  tagged with *every* boundary you belong to, not just the one you're currently viewing.
- **Tabs**: one per boundary membership (most local last, auto-selected as the default tab),
  plus **Country**, **International**, and an **All Feeds** master tab. The master tab adds a
  secondary row of boundary-type filter chips (e.g. just "Municipal" across every membership
  at once, plus Country/International).
- **Politician video "stories"** — any post with an attached video renders as a vertical
  thumbnail strip above the main feed (Instagram/TikTok-style), tap to open a full-screen
  player.
- **Posts**: Ghost-ID byline, text, optional image/link-preview/video, upvote/downvote
  counts, a small civic-score badge (the poster's score at the time of posting), and a
  threaded comment box (also posted under a Ghost ID). Politicians see posts sorted by
  engagement (likes + comments) instead of strictly newest-first, on every tab.

Admins see a locked-down version: no composer, no tabs, no memberships — just a notice that
their job is the Admin panel, not a constituency feed.

---

## Elections — citizen-facing

### Elections list (`/elections`)
Public (viewable without an account). Signed-in citizens/politicians see only seats in their
own boundary memberships; signed-out visitors and anyone with no memberships yet see every
currently-open seat platform-wide. Each row: role title, boundary name, election name/date,
candidate count. Citizens get a "Become a Politician" nudge card at the top linking to
Profile.

### Seat detail (`/elections/seat/:seatId`)
Public. Header card (role, boundary, election date, candidate count). Below that, three
role-conditional panels:
- **Citizens** get the "Become a Politician" nudge again.
- **Politicians** get "Nominate Yourself" (creates a draft candidacy, hands off to the
  Application screen) or, if already applied, a shortcut to Manage My Candidacies.
- **Election Administrator** panel (shown to anyone signed in, state varies): volunteer to
  administer this specific seat (motivation + optional social-media info + contact email,
  reviewed by a site admin, or auto-approved after 48h with no action); once approved, add a
  candidate who's running in real life but hasn't registered on the platform
  (`add_unregistered_candidate` — creates a stub profile). A site admin sees this same panel
  in its approved state on any seat, without needing to be its approved administrator.
  For any not-yet-claimed stub candidate on the seat, two more actions appear here: send a
  one-time **claim-invite email** (candidate signs up and is dropped straight into ownership —
  no separate onboarding), and a **Pending Claim Requests** list reviewing any "this is me"
  self-requests submitted from that candidate's own wall (approve hands over ownership the
  same way; reject leaves the stub as-is and blocks that requester from resubmitting).
- A **candidate switcher** (when more than one candidate exists) with a checkmark for
  "nomination papers filed", then the selected candidate's full campaign wall embedded inline
  (`CandidacyWall`, same component used at its own standalone URL).

### Candidate campaign wall (`/candidacy/:candidateId`, or embedded)
Public, works both as its own page and embedded inside the seat page. Two-column layout: a
sticky left profile card (candidate name, party, role/boundary, a self-toggleable
"Nomination Papers Filed" badge, support button + count, education/hometown,
"why I'm running" statement, full bio), a campaign video gallery (intro video from the
application, plus any later video posts), and — if the election has a candidate
questionnaire — the candidate's public answers, one row per question showing whichever form
fits its type (selected option, a pill per selected option for a multi-select question, the
written paragraph for a free-text question, or 1–5 dots for a rating question), plus that
answer's own optional video if the candidate attached one. Clicking a question expands a
public comment thread scoped to that specific answer (anonymous, Ghost-ID, sign-in required
to post) — a separate discussion from the general wall feed below, for voters to
question/discuss a candidate's stance on that one issue specifically. The right column is a
composer (post/reply as your own Ghost ID, requires sign-in) and the wall's post feed,
mirroring the Feed page's composer feature set (image, link preview, video for the
candidate/owner) plus threaded comments, with the candidate's own replies always pinned to the
top of each thread.

If the candidate is still an unclaimed stub (added by an election administrator, not yet
claimed by a real account), any other signed-in visitor sees **"This is me — claim this
candidacy"** next to the "Listed by verified election administrator" note — opens a small
motivation/contact-email/proof-link form and submits a claim request for the seat's election
administrator (or a site admin) to review.

### Claiming a candidacy (`/claim/:token`)
Not a page anyone navigates to directly — the landing spot for an emailed claim-invite link.
Redeems the token on load (signs the token's authorization off against whoever is logged in
when the link is opened, same trust model as a password-reset link) and, on success, hands the
new owner straight to their own campaign page — the stub's already-vetted name, party,
education, hometown, and bio become theirs immediately, existing wall discussion and
supporters carry over, and no separate onboarding step is needed.

---

## Elections — politician-facing

### My Elections (`/politician/elections`)
The politician's control center for running for office. Three sections:
1. **My Candidacies** — every seat applied to, with status (draft/pending/approved/rejected),
   a link to continue/edit the application, a "Campaign Page" shortcut once approved, and
   Withdraw.
2. **My Election-Administrator Applications** (only shown if any exist) — same status
   pattern, with a "Manage Seat" shortcut once approved.
3. **Open Seats Near You** — every currently-nominating seat in the politician's own
   boundaries, with a one-click Apply. A **"Browse a Different Area"** panel lets a politician
   run somewhere they don't live: pick a country, then a container type ("Province / State" —
   this now includes USA's `State` alongside Canada's `Province`, see
   [ARCHITECTURE.md §26](../ARCHITECTURE.md)), then a specific container, then search for its
   open seats.

### Candidate application (`/apply/:candidateId`)
The step between "Nominate Yourself" and having a public campaign page. A statement
("why are you running?", autosaved on blur), the election's candidate questionnaire if one
exists, and a **required** in-browser-recorded introductory video (90s cap). Each question is
one of four types — single-select (radio), multi-select (checkboxes), free-text (a written
answer), or a 1–5 rating — rendered with whichever control fits; once answered, an optional
free-text elaboration (if the admin allowed it for that question) and an optional short video
specific to that answer can both be attached. Submission is blocked until every required
question is answered (type-appropriately — a multi-select needs at least one box checked, a
rating needs a value picked, not just an empty row) and the intro video exists.
Already-submitted applications stay editable and resubmittable (e.g. after a rejection).

---

## Profile (`/profile`)

Your own account settings — a read-only summary view plus an Edit modal.

- **General Info**: full name, account type badge, every boundary you belong to as chips.
- **Political Details** (politicians only): party, hometown, bio, plus a one-click **Switch
  to Citizen Account** downgrade (no confirmation-heavy flow — citizens get the reciprocal
  "Become a Politician" prompt everywhere else in the app).
- **Privacy & Ghost ID** (citizens only): current Ghost ID, the same **Civic Impact Score**
  as the Feed page (with its own recalculate action), a rotation history line ("Rotated N
  times, last on `<date>`"), and **Rotate Ghost ID** (same destructive, confirmed action as
  the Feed page's version).
- **Edit Profile** opens a modal wizard reusing the onboarding step components: Basic Info
  (name + role toggle) → Location (full `StepLocation`, re-detect or manually adjust) →
  Political Details (politicians only, 3 steps total vs. 2 for citizens).

Admins see a locked message instead ("your profile is locked") with a link to the Admin
portal.

### Politician public wall (`/wall/:ghostId`)
A politician's own social presence, distinct from any one campaign — think a standing profile
page vs. a per-election campaign page. Cover header with support button/count, a **View
Supporters** dashboard (owner-only, real-time via a Postgres subscription), and a **QR code**
popover (scan to visit this exact wall URL). Composer + feed work like the Feed page's, with
an owner-only tab split: **All** / **My Posts** vs. **Reviews & Comments** (so an owner can
separate their own updates from visitor feedback at a glance).

---

## Admin

Seven separate top-level routes (not tabs of one page), all gated to `profiles.role='admin'`.
(Admin → News is covered in the **News** section above, alongside the other two News screens,
rather than repeated here.)

### Boundaries (`/admin`)
The foundational data-management screen — everything else in the app depends on what's
registered here.
- **Countries**: the canonical country list (name, ISO code, flag emoji) every other country
  dropdown in the app reads from.
- **Boundary Types**: per-country boundary-type registry (e.g. Canada → Federal/
  Provincial/Municipal) with a rank (1 = broadest) and a one-click "standard set" seeder for a
  new country. This is also where `admin_only`/`is_container` semantics live structurally
  (not directly editable here, but every type registered here can independently be a citizen
  membership, an admin container, both, or neither — see
  [adding-boundary-data.md](adding-boundary-data.md)).
- **Political Parties**: per-country party list politicians pick from on their profile.
- **Upload Boundaries**: the geospatial data pipeline. Upload a `.geojson` or zipped
  shapefile, pick country/type/name-attribute/code-attribute, then an **analyze-first**
  step parses the file entirely client-side and shows a vertex-count histogram before
  anything touches the database — you set a vertex cutoff, oversized shapes are skipped and
  listed by name. Confirmed uploads insert in two tiers (bulk-batched for simple shapes,
  one-at-a-time for medium-complexity ones) with live progress, and are fully resumable if
  interrupted (already-inserted shapes, matched by code, are skipped on retry).
- **Uploaded Boundaries**: a live-scrolling recent-shapes list with per-shape delete.
- **Upload Batches** (`BoundaryUploadsPanel`): every tracked upload as a collapsible row —
  active/retired shape counts, an "Incomplete" badge with progress if a resume is pending,
  inline rename, expand-to-search the batch's own shapes, resume an interrupted upload, jump
  to Redistricting pre-scoped to this batch, or delete the whole batch outright (blocked with
  a clear message if anything already references it — retire instead).
- **Redistricting** (`RedistrictingPanel`): the tool for handling boundary changes. Load a
  batch's own shapes, or ask it to *suggest* what an upload likely replaces (geometry-overlap
  based), or select every shape of a type directly (for legacy data with no batch). Selection
  is a full interactive map picker. **Preview Impact** before committing — tells you how many
  users would lose coverage entirely (not just move to the new shapes) if you retire the
  selection. **Confirm Retirement** (soft — stays intact for any election/post history that
  already references it) or **Delete Selected Permanently** (hard, blocked if anything
  references it, pointing you at retirement instead).

### Analytics (`/admin/analytics`)
Read-only platform engagement dashboard. Top row: total story posts, total comments, total
registered accounts, and daily-new-users, each with a today/7d/30d breakdown where relevant.
A DAU/WAU/MAU panel (unique users active in the past 24h/7d/30d, derived from post, comment,
and profile-update timestamps) with a stickiness ratio (DAU ÷ MAU). Below that, a content
creation velocity table and a user-roles breakdown (citizens / candidates & representatives /
admins) as proportional bars. A manual **Refresh Metrics** button re-fetches everything;
nothing here is editable.

### Elections (`/admin/elections`)
Full election lifecycle management: create an election (name + date, starts in `draft`),
advance its status (`draft → nominations_open → active → closed`), and per election:
- **Seat creation**: pick a country → an optional container to scope by (e.g. one province/
  state — or leave blank for "every {type} in the whole country") → a target boundary type →
  "Find Matching Boundaries" (bulk-adds every match) or hand-pick shapes on an interactive
  map → pick one or more roles from the catalog for that country+type (e.g. Ontario ridings
  show MPP; USA State shows Governor *and* U.S. Senator as separate checkboxes) → Create
  Seats. Region-correct role titles are resolved per-shape, not assumed uniform across a
  mixed-region batch.
- **Per-seat "Fetch candidates"**: for any seat whose jurisdiction has been researched (see
  [ELECTION_DATA_SOURCES.md](ELECTION_DATA_SOURCES.md)), a "view official source" link always
  appears once known; a working **Fetch candidates** button additionally appears for
  jurisdictions with a live scraper built — pulls the real candidate list from the official
  government source and lets the admin one-click-add anyone missing via
  `add_unregistered_candidate`.
- **Candidate application review**: approve/reject submitted applications; approved
  candidates become publicly visible immediately.
- **Candidate questionnaire builder**: add/remove questions, each one single-select,
  multi-select, free-text, or a fixed 1–5 rating (option-text inputs only appear for the two
  select types), with optional free-text context, required/optional, and public/admin-only
  visibility — every candidate for that election answers these on their application, each
  optionally with its own short video per answer, and (once visible to voters) a public
  comment thread per answer on the candidate's campaign page.

*(Performance note: selecting a large election used to take up to a minute and lose its
selection on navigating away — both fixed, see [ARCHITECTURE.md §25](../ARCHITECTURE.md).)*

### Election Admins (`/admin/election-admins`)
The site-admin review queue for **election-administrator** applications (the per-seat
volunteer role citizens/politicians apply for from the Seat Detail page) — approve or reject
each with the applicant's motivation, optional social-media info, and contact email visible.
Applications older than 48h with no action auto-approve on their own; this queue is only what
still needs a manual call.

### Visualizer (`/admin/visualize`)
A read-only map tool: pick a country, optionally narrow to every boundary inside a specific
container (e.g. every municipality inside one province/state), pick a target boundary type,
and see the result rendered directly on a map. A 500-shape render cap shows a plain name list
with an explicit "Load Map Anyway" opt-in instead of silently fetching a huge geometry
payload. Nothing here is selectable or editable — purely for sanity-checking what's actually
loaded.

### Theme (`/admin/theme`)
Picks the site-wide active color theme every visitor sees — a grid of the app's switchable
palettes (see [DESIGN.md](../DESIGN.md)'s Theming section for the mechanism), each rendered
as a live mini feed-post mockup so the palette is judged in context, not as a bare swatch.
Clicking one applies it immediately, site-wide, for every user.

---

## Shared building blocks worth knowing about

These aren't separate screens, but show up across many of the ones above:

- **`BoundaryPicker`** — the interactive map+list shape selector used by seat creation,
  redistricting, and location search. Single or multi-select, lazy-loads geometry only for
  what's actually visible/selected.
- **`VideoRecorder`** — in-browser webcam recording + upload, used for Feed video pitches,
  campaign wall posts, required intro videos, and optional per-answer questionnaire videos.
- **`AnswerValue`** — renders a single questionnaire answer's value (selected option, pill
  list for multi-select, written paragraph, or 1–5 rating dots), shared by the candidacy wall
  and the admin's candidate review panel so the four-way branch by question type lives in one
  place.
- **`LinkPreview`** — turns a pasted URL into a rich preview card (title/image/description),
  used identically in the Feed composer, wall posts, and candidacy wall posts.
- **`PostCard`** — the shared post-list-with-comments renderer behind the Feed, the
  Politician Wall, and the Candidacy Wall alike (unified onto one component post-migration —
  see [ARCHITECTURE.md §31](../ARCHITECTURE.md)), including the owner-reply-pinned-to-top
  comment ordering; only the Feed turns on its optional vote-bar slot (Wall/Candidacy Wall
  posts aren't voteable).
- **`PoliticianSidebar`** (Feed page only) — surfaces politicians relevant to whichever tab
  is active.
- **`src/components/primitives/`** — the shared design-system primitives (`Card`, `Button`,
  `Badge`, `Input`/`Textarea`/`Select`, `Spinner`, `EmptyState`, `PageHeader`) every screen
  above is built from — one place controls look and feel platform-wide.
