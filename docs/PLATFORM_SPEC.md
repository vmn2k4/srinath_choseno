# Choseno — Platform Specification

What Choseno is, why it exists, and how each system actually works. This is the
one-level-up companion to [SCREENS_AND_FEATURES.md](SCREENS_AND_FEATURES.md) (the
screen-by-screen UI reference) — read that one for "what's on the screen," this one for
"what the system is and why it's built this way." Every claim below is checked against
the current codebase, not aspirational.

## 1. Vision & core mission

Representative democracy has a resolution problem. Voters are conditioned to vote for a
national party brand rather than the specific person who will represent their street,
and independent or first-time candidates face real gatekeeping — money, party
infrastructure, name recognition — just to get on a ballot and be heard.

Choseno is an anonymous, hyper-local civic social network built to fix the resolution
problem directly: every conversation is anchored to real, verified electoral boundaries,
every citizen participates under a rotating anonymous identity rather than a public
profile, and there is no influencer or brand-clout layer diluting the discussion. The
goal is to help people choose the person, not the party — and to give independents and
ordinary residents an equal shot at being seen and elected.

## 2. System architecture

### A. Boundary & geospatial engine

Location is captured once, via browser geolocation, and resolved server-side with
PostGIS point-in-polygon matching against every registered boundary shape — no address
forms, and a user is mapped to *every* jurisdiction their coordinates fall inside at
once (municipal, provincial, federal, etc. simultaneously), not a single tier.

The boundary hierarchy itself is **not fixed** — it's an admin-configurable,
per-country ladder (`country_boundary_types`, ranked broadest-to-narrowest), so
different countries can define different levels entirely. The shipped example spans
four ranked levels: **Polling District → Federal Area → Country → International**, with
"Municipal/Provincial/Federal" as one possible instantiation of that ladder rather than
the model itself. A "standard set" seeder exists for quickly bootstrapping a new
country's boundary types.

The Feed is scoped to this: one tab per boundary a citizen belongs to (most local
first), plus platform-wide Country and International tabs, so local discussion is never
diluted by national noise but is still reachable when a citizen wants it.

### B. Anonymity & anti-noise framework

This is the system's most distinctive piece, and it's worth being precise about it
rather than calling it generic "reputation scoring."

**Ghost identity.** Every citizen post/comment is attributed to a rotating anonymous
`ghost_id`, not the citizen's account. A citizen can **burn** their Ghost ID at any
time to get a completely fresh one — this permanently orphans every past post and
comment from their real profile.

**Civic Score, engineered specifically to survive burning.** Score accrues per-ghost
(10 pts/post, 5 pts/comment, +1/−1 per upvote/downvote received) and is **only** folded
into the permanent profile total at the exact moment a ghost is burned — the last point
a live link between the profile and that ghost legitimately exists. Deliberately, there
is no stored table anywhere mapping `profile_id → post_id`, because that mapping would
double as a de-anonymization index (every post's `ghost_id` is already public). After a
burn, only the cumulative number survives; which specific old posts earned it is not
reconstructable. This is a real, considered privacy trade-off baked into the schema, not
an incidental detail.

**Rate limiting.** Comment rate limits and a politician daily post cap are both enforced
server-side, independent of Civic Score, specifically to blunt flood/bot tactics.

**Moderation.** Reports (post, comment, or politician-profile) go into a flat admin
queue, with admin-configurable auto-removal thresholds *per abuse type* — hit the
threshold and content is soft-deleted (reversible, review trail preserved) automatically;
below it, an admin reviews manually. Score penalties for confirmed-removed content apply
once, at confirmation time, never per individual report — so a handful of colluding
accounts can't tank someone's score before any real review happens, and Civic Score is
floored at zero. There is **no reporter-reputation weighting** in the queue — don't
describe this as reputation-weighted triage; it's simpler and more auditable than that
by design.

### C. Zero-influencer mandate

There is no brand/influencer account tier. Every account is either an anonymous citizen
or a verified politician — profiles are structurally tied to real electoral geography,
not follower counts. One nuance worth keeping precise: a `political_parties` table does
exist (a politician can optionally list a party on their profile), so party isn't
erased from the data model — it's that the platform never uses party to rank, filter, or
promote candidates in discovery, keeping the "choose the person" framing intact rather
than pretending parties don't exist.

## 3. The politician ecosystem

### A. Citizen ↔ politician

Switching from citizen to politician (and back) happens directly from a user's own
Profile page — there's no separate application or verification gate for the *role
switch* itself; verification instead happens at the point of actually running (the
candidate application, below). Choosing "politician" during onboarding requires a real
public full name (it will appear on the public Wall) instead of the optional pseudonym
citizens get.

### B. Politician walls

Every politician gets a standing public Wall (`/wall/:ghostId`) — separate from any
one campaign page — with a support button/count, a real-time owner-only supporters
dashboard, and a shareable QR code. It behaves like a personal civic presence, not tied
to a single election cycle.

### C. Spotlighted replies (the "can't hide from scrutiny" mechanic)

When a politician (the wall/candidacy owner) replies within a thread on their own Wall
or Candidacy page, that reply — and any reply thread the owner directly participates in
— is pulled out of the general comment order and rendered in a **spotlight section above
the rest of the thread**, badged as the owner. This is implemented client-side (matching
comment `ghost_id` against the wall/candidacy owner's `ghost_id`, in the shared
`PostCard` component), not as a stored "pinned" database flag, and it only applies on
Wall and Candidacy Wall threads — general Feed posts don't have an owner concept and
aren't affected. The trade-off is the one you'd expect: a politician's reply is always
visible and can't get buried, which also means a vague non-answer is immediately obvious
sitting right under the pointed question that prompted it.

### D. Video-first statements and verified endorsements

Politicians can attach an in-browser-recorded video to Feed posts, wall posts, and
individual questionnaire answers — position statements stay in the politician's own
voice, unedited. Support is a verified, **one-per-constituent** "I Support" endorsement
(not a generic like/upvote), specifically to resist bot farms and out-of-district
brigading — a representative sees a bounded, real signal rather than an inflatable
counter.

## 4. Election hubs & candidate matchmaking

Every electoral seat gets a dedicated page (`/elections/seat/:seatId`) generated from
the boundary + election-role catalog for that jurisdiction — the one-stop dashboard for
that specific race, public even to signed-out visitors.

**Flexible questionnaires**, not a single fixed form. Election admins build a
per-election questionnaire from four question types — single-select, multi-select,
free-text, or a 1–5 rating — each independently required/optional and
public/admin-only. Every candidate answers on their application; each individual answer
can optionally carry its own short video, and once visible to voters, each answer gets
its **own scoped public comment thread** — a citizen can question a candidate's stance
on one specific issue without derailing the general wall discussion. Answers render
side-by-side on the candidate's campaign page, stripped of the question type's UI
chrome down to a comparable value (selected option, pill list, paragraph, or rating
dots) via one shared component so every candidate is compared on equal footing.

**Equal footing for independents** goes further than just flattening discovery: an
**election administrator** role (a citizen or politician who volunteers to help run one
specific seat, approved by a site admin or auto-approved after 48h) can list a real
declared candidate who hasn't self-registered yet as an **unclaimed stub** — so a race
looks complete even before every candidate has signed up — and can send that stub a
one-time claim-invite email, or approve a "this is me" self-claim request from the
stub's own wall. Claiming carries over the stub's vetted name, party, and bio, plus any
existing wall discussion and supporter count, with no separate onboarding.

## 5. News

A civic-news layer, distinct from the constituency Feed: admin-authored editorial
articles (not user posts), publicly discoverable without an account, with a
draft → scheduled → published → archived lifecycle (scheduled articles go live
automatically at their `published_at` time). Each article carries a category, optional
Breaking News flag, estimated reading time, and an optional per-article author byline
(not tied to a platform profile). A comment thread at the bottom works exactly like a
Feed/Wall thread — anonymous, Ghost-ID, sign-in required to post. This exists to give
citizens local context alongside the discourse, not just a place to argue.

## 6. Roles, at a glance

| Role | Scope | Key capabilities |
|---|---|---|
| Citizen | Own boundary memberships | Anonymous Ghost-ID posting, burn/rotate identity, endorse candidates, apply to become an election administrator |
| Politician | Own boundary memberships + any seat they run for | Everything a citizen has, plus a public Wall, video statements, candidacy applications, questionnaire answers |
| Election Administrator | One specific seat, by approval | Add unregistered candidates, send/review claim requests for that seat |
| Admin | Platform-wide | Boundary data pipeline, election lifecycle, questionnaire builder, moderation queue, News authoring, analytics, site theme |

## 7. What this spec deliberately does not claim

To keep this document trustworthy as the codebase evolves, two things worth flagging
explicitly rather than glossing over:

- Reporter reputation is **not** factored into moderation triage — don't describe the
  moderation queue as reputation-weighted; it's threshold-and-review based.
- The boundary hierarchy is **not** a fixed three-tier Municipal/Provincial/Federal
  model — it's a flexible, admin-defined, per-country ladder. Treat any specific tier
  list as an example, not a constraint.
