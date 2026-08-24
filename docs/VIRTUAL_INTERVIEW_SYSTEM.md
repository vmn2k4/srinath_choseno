> **Implementation status (2026-08-24):** Gaps 1–4 are built and live (see the
> 2026-08-21 note below for the original build), and a substantial post-launch
> refinement pass has since shipped on top — unified video-pitch player, resolved
> wall-vs-feed visibility, share deep-links, real-name comment identity for owners,
> and several correctness bugs found via live testing. **See "Post-launch
> refinements (2026-08-24)" immediately below** for what changed and why; the
> original plan (Gaps 1–4, further down this file) is kept as the design-rationale
> record and is still accurate for anything it isn't explicitly superseded on.

> **Implementation status (2026-08-21):** Gaps 1, 2, 3, and 4 are all built and live,
> including full video generation. Migration `20260821000000_candidate_video_interviews.sql`
> + `20260821000001_fix_candidacy_claim_requests_fk.sql` + `20260821000002_election_question_narration_text.sql`
> applied. Service layer, `QuestionAnswerCarousel`, `PlayInterviewReel`, the seat-page
> "Candidate Interview" tab, the CandidacyWall "Play Interview" button + owner nudge,
> the email-claim → `/apply` connection, and full bulk video generation
> (`GenerateQuestionVideosFlow` + `/api/admin/generate-question-video` +
> `nvidia_shorts_studio/question_card_engine/generate.py`) are all built, typecheck
> clean, and verified end-to-end in the live app (real TTS audio, real HyperFrames
> render, real Supabase Storage upload, real DB persistence on approve).

---

## Post-launch refinements (2026-08-24)

Everything below happened after the original Gaps 1–4 build, driven by live testing
against a real candidate application end to end. Grouped by theme, not chronological.

### One shared video-pitch player, not three

`QuestionAnswerCarousel` and `PlayInterviewReel` started as two independent
full-screen 9:16 viewers with near-duplicate frame/swipe/like/comment code, and
neither had a Share button. Extracted the shared piece into
**`PitchPlayer.tsx`** — a purely presentational component owning the 9:16 frame,
up/down navigation (swipe, mouse wheel, and Up/Down/Left/Right arrow keys), the
like + comment + share action rail, and the comments drawer. It takes an ordered
`slides: PitchSlide[]` array (`{videoUrl, postId, caption, authorName,
authorAvatarUrl, likesCount, comments, ownerGhostId, shareUrl, autoPlayOnEnd}`) and
is fully controlled — the caller owns data-fetching and the like/comment mutations,
`PitchPlayer` only renders and calls back. `postId: null` on a slide (a bare
question-video prompt with nothing posted yet) hides the whole action rail for
that slide — there's nothing to like/comment/share on a prompt, only on an answer.

Three thin wrappers now sit on top of it, each just a data adapter:

| Component | Slides | Used from |
|---|---|---|
| `QuestionAnswerCarousel.tsx` | One question, every candidate's answer (Gap 3's cross-candidate carousel) | Seat page's "Candidate Interview" tab |
| `PlayInterviewReel.tsx` | One candidate, every question — two slides per question (`question` video, `autoPlayOnEnd: true`, then `answer` video) when the question has its own video, one slide when it doesn't | Seat-page candidate strip "Pitch" badge, `CandidacyWall`/`PoliticianWallClient` "Play Interview" button, the new candidate-strip in `ElectionInterviewTab` |
| **`PitchPostPlayer.tsx`** *(new)* | A single standalone answer_pitch post opened from a wall/feed `PostCard` — plays that one question's video (if it has one) then the answer, same as a slice of the full reel | `PostCard`'s video thumbnail, when `post_kind === 'answer_pitch'` |

`CandidateVideoInterviewPlayer.tsx` (the candidate's own **recording** flow —
watch/record/replay, camera capture) is deliberately *not* part of this
unification. It's a different concern (capture, not viewing) and merging it in
would trade real risk for no UI benefit.

**Bugs fixed by this consolidation, previously present only in one of the two
original components:**
- **Infinite-climbing like count.** `handleLike` did `likes_count + 1` locally on
  every tap. `vote_on_post` is a server-side *toggle* — voting "like" again on a
  post you already liked **removes** the like — so a second tap should show the
  count going *down*, not up again. Fixed by reading the real count back via a new
  `getPostVoteCounts(supabase, postId)` helper (`feed.ts`) after every vote instead
  of guessing the delta.
- **"Ghost-Unknown" on a freshly-posted comment.** The optimistic local comment
  object hardcoded `ghost_id: ""`; `getGhostDisplayName` renders an empty ghost_id
  as the literal string "Ghost-Unknown". Fixed by using the signed-in user's real
  `profile.current_ghost_id`.
- **`getCandidateAnswersByQuestion` returning nothing at all (PGRST201).** Its
  `election_candidates!inner(... profiles(...))` embed became ambiguous once
  `election_candidates` grew a third FK into `profiles`
  (`added_by_election_admin_id`, `reviewed_by`, `politician_id`) — PostgREST
  refused the whole request rather than guess which one. Fixed by disambiguating:
  `profiles!election_candidates_politician_id_fkey(...)`, matching the pattern
  every other `election_candidates → profiles` embed in `elections.ts` already
  used. The UI had been silently swallowing this as "No candidate has answered
  this question yet" instead of surfacing the real 400.
- **Same query also selecting `election_candidates.display_name`/`avatar_url`,
  neither of which exists as a real column on that table** (name/avatar have
  always lived on the joined `profiles`/`politician_profiles` row) — a second,
  independent cause of the same silent failure. Removed from the select; the
  existing `profiles?.full_name || "Candidate"` fallback chains already handled
  their absence correctly.

### Standalone pitch posts play with context, not cold

A `PostCard` for an `answer_pitch` post used to be a bare `<video>` with no idea
what question it was answering — no caption, no question video, nothing. Wired
`PostCard`'s video click through a new optional `onPitchVideoClick` prop (falls
back to the existing `onMediaClick`/`StoryViewerModal` for every other kind of
video post) that opens `PitchPostPlayer` instead, so a lone pitch clicked from a
wall or feed plays "question, then answer" — the same sequencing the full
interview reel uses — with the full like/comment/share rail on the answer slide.
New service function: `getQuestionForAnswer(supabase, answerId)`.

### Share: every pitch slide, deep-linked back to the exact clip

Every slide with a real linked post now has a Share button (native share sheet
via `navigator.share` when available, clipboard-copy fallback otherwise, both
wrapped in try/catch — clipboard access can be denied by the browser, e.g. an
unfocused document, and that's not worth surfacing as an error). `PitchPostPlayer`
builds the link as `<current page>?pitch=<postId>`; `CandidacyWall` and
`PoliticianWallClient` each read that query param once their posts have loaded
and reopen `PitchPostPlayer` for the matching post — so a shared link lands
straight on the clip, not the top of a whole wall. `QuestionAnswerCarousel`'s and
`PlayInterviewReel`'s share links currently point at the page they were opened
from (the seat page), not a clip-specific deep link — there's no permalink route
for those two contexts yet; only the standalone-pitch path is fully deep-linked
today.

### Resolved: feed-visibility scope of `answer_pitch` posts (was an open question below)

The original plan's "Open questions" section (bottom of this file) left this
undecided. Now decided and built, reconciling two things that both turned out
true and are **not in conflict**:

- **On the candidate's own wall** (`CandidacyWall`/`PoliticianWallClient`), every
  `answer_pitch` post shows individually, exactly like any other wall post — this
  is the "standard treatment" Gap 4 always called for, and it's literally the
  candidate's own posting history. (A brief interim pass hid them here on the
  theory that the wall's "Play Interview" button already covered viewing them —
  reverted; that wasn't what Gap 4 specified, and it meant a candidate's own video
  answers were invisible on their own wall.)
- **In the general Feed** — specifically its "Politician Pitches" story strip —
  every answer for one candidate collapses into a **single grouped "Full
  Interview" entry** (badged with the question count) instead of showing as N
  separate story items, and `answer_pitch` posts are filtered out of the Feed's
  regular scrollable post list entirely. The Feed is a cross-candidate discovery
  surface, not a personal timeline; `upsert_answer_pitch_post` already set
  `is_country`/`is_international` to `false` specifically to keep these off the
  main feed (see Gap 4 above) — a separate bug (below) had been defeating that.

**Bug that had been defeating the Feed-scoping intent:** `upsert_answer_pitch_post`
also inserted a `post_boundaries` row per candidate boundary membership on every
answer. `is_country`/`is_international` being `false` doesn't matter if the post
is still boundary-tagged — `getMembershipScopedPosts` (the query behind a
citizen's local Feed tab) filters on `post_boundaries`, not those two flags — so
every individual answer was leaking into the local Feed as 9 separate full posts
regardless. Migration `20260824000001_answer_pitch_posts_not_boundary_tagged.sql`
removed the insert; a same-day follow-up,
`20260824000002_restore_answer_pitch_boundary_tagging.sql`, put it back after
realizing the Feed's story-strip *grouping* query needs these posts to still be
boundary-tagged to find them at all — the actual fix belongs at the display layer
(filter `post_kind = 'answer_pitch'` out of the rendered post list; group it into
one story-strip entry), not by cutting the data out of the query entirely. Both
migrations also backfill/set `election_candidate_answers.candidate_id` onto
`posts.election_candidate_id`, which the grouping logic keys on.

### Comment identity: real name for the wall/candidacy owner's own replies

`docs/PLATFORM_SPEC.md` §3A requires a real public full name specifically
*because* it appears on the public Wall (unlike a citizen's optional pseudonym),
and §3C's "spotlighted replies" mechanic already badges an owner's reply as the
owner — but until now, every comment thread (including that spotlight box) still
rendered the owner's `Ghost-XXXX` pseudonym underneath the badge, never their
real name. Fixed in both `PostCard.tsx` (new `ownerFullName` prop — deliberately
separate from the existing `politicianAuthor` prop, which resolves the *post's*
author and can differ from the *wall owner* on a mention post) and `PitchPlayer.tsx`
(reuses the slide's own `authorName`). Scope is deliberately narrow and matches
what's actually documented: only the wall/candidacy **owner's own reply** gets
their real name shown. Every other commenter — a citizen, or an unrelated
politician replying in someone else's thread — stays fully `Ghost-XXXX`
anonymized, per §B's "every citizen post/comment is attributed to a rotating
anonymous ghost_id."

### Submit/approval UX matched to what the RPC actually does

`submit_candidate_application` has always auto-approved on submit (flips
`status` straight to `'approved'` unless already `'rejected'`) — there is no
admin-review queue a `'pending'` candidacy is waiting on; an admin can only
*reject* an already-approved candidacy after the fact. But `status` also stays
`'pending'` forever for a candidacy that was simply never submitted, and the UI
used the same "Pending Review" badge for both cases — reading as "waiting on
someone else" when it actually meant "you haven't finished this yet." Fixed in
`CandidateApplicationClient.tsx` and `PoliticianElectionsClient.tsx`: a
`'pending'` status with no `submitted_at` now shows "Not Submitted" (amber) with
an inline nudge, and the Submit button is disabled with an explanatory line when
the RPC's other hard requirement — an intro video — is missing, instead of
letting the click fail after the fact. On a successful submit, a dialog
("Application Submitted & Approved!" or, if this candidacy was previously
rejected, an accurate "resubmitted, stays rejected" message reading the RPC's
actual returned `status`) replaces the old easy-to-miss inline status line and
routes to My Elections on dismiss.

### YouTube links now embed and play in-page

Unrelated to the interview system directly, but touched in this pass:
`LinkPreview.tsx` (used by the Feed/Wall post composer's URL-preview) now
detects a YouTube URL (`watch`, `youtu.be`, Shorts, or an already-embedded link)
and renders a real `<iframe>` embed **before** attempting the Microlink metadata
fetch, not after it succeeds. YouTube never exposes a direct playable file via
Microlink's `og:video` field regardless (only Vimeo/self-hosted clips do), so
gating the embed behind that fetch meant a YouTube link only ever got the actual
video if Microlink happened to succeed — and even then it wouldn't have, since
Microlink still can't hand back a YouTube file. The iframe now needs nothing but
the URL itself.

---

# Candidate Video Interview System — Plan v2

**Status:** Plan only, not implemented. Supersedes the earlier draft in this file, which
was written without checking the codebase and proposed a parallel `interviews` /
`interview_questions` schema. That schema **already exists** in a more mature form as
the election questionnaire system. This plan extends it instead of duplicating it.

## What already exists (don't rebuild this)

The "create questions → candidate answers with video → public sees it → people
comment" system is already ~80% built, under a different name: the **election
questionnaire**.

| Piece | Where |
|---|---|
| `election_questions` | `election_id`, `question_text`, `question_type` (`single_choice`/`multiple_choice`/`text`/`rating`/`ranking`), `required`, `allow_context`, `allow_video`, `visible_to_public`, `rank` |
| `election_question_options` | options for choice/ranking questions |
| `election_candidate_answers` | one row per (candidate, question): `option_id`, `text_answer`, `rating_value`, `context_text`, **`video_url`** |
| `election_candidate_answer_options` | multi-select / ranking selections, with `rank` |
| `election_answer_comments` | public comment thread **scoped to one answer** — ghost_id based, same shape as `comments` |
| `submit_candidate_application(candidate_id)` RPC | validates all required questions answered (type-aware), sets `submitted_at`, auto-approves |
| `CandidateApplicationClient.tsx` (`/apply/[candidateId]`) | candidate-side form: answer each question, record or upload video per question |
| `VideoRecorder.tsx` | record/upload widget, **`maxDuration` prop already defaults to 30s** — this is the exact recording widget you described, already built and already 30s by default |
| `CandidacyWall.tsx` (`/candidacy/[candidateId]`) | public page: candidate profile + their `visible_to_public` answers (with each answer's comment thread) + their wall posts, unified via `posts.wall_ghost_id` (migration `20260730000003_unify_candidacy_and_wall_posts.sql`) |
| `election_candidates` status machine, incl. `unregistered_candidates` (`20260729000008`) | a candidate row can exist and be answerable **before** the person has claimed/logged into an account |
| `politician_claim_campaigns` + `campaigns.ts` | existing email-invite infra: generates a token, emails a claim link, tracks open/click/wall-view events, records claimed_at |
| `elections/seat/[seatId]` page | already lists every candidate for a seat with a `?candidate=` selector — closest existing precedent to a multi-candidate view, but it switches whole profiles, not per-question |

**Net implication:** almost nothing here needs a new table. The gaps are specific and
narrow. Below is what's actually missing, mapped to your four asks.

---

## Gap 1 — Video *for the question itself* (admin side, "quickly get an interview set up")

Today `election_questions` has no video column at all — only the candidate's *answer*
can carry `video_url`. Nothing plays a question video.

**Add:**
```sql
ALTER TABLE public.election_questions
  ADD COLUMN question_video_url text,
  ADD COLUMN question_video_path text,       -- storage path, for re-generation/cleanup
  ADD COLUMN max_answer_seconds int NOT NULL DEFAULT 30;
```
`max_answer_seconds` replaces a hardcoded 30 with an admin-tunable per-question value —
`VideoRecorder`'s `maxDuration` prop already supports this, it's just never been wired
to a column.

**Admin UI** (extends whatever the elections admin question editor is — same file that
already writes `question_text`/`allow_video`/etc.):
- "Upload video" — plain file input → existing storage-bucket pattern (see
  `storage_buckets` migration + `video.ts`), sets `question_video_url`.
### Revised, better design — bypass orchestrate.py's image pipeline entirely

The note below (kept for context) assumed the only entry point was the full
`orchestrate.py` narrative-shorts pipeline. Digging into the folder further found a
much better fit for a one-line question card, using the *same underlying pieces*
`orchestrate.py` itself calls, directly:

- **`tts/read_transcript.py`** is a genuine standalone script — Qwen3-TTS running
  locally via MLX, invoked with `--text "<question text>"` (or `--file`), writing a
  `.wav` straight to `repo_upstream/outputs/read_aloud/`. No image generation, no
  NVIDIA API, no `orchestrate.py` involvement at all. This alone answers "generate
  audio for the question."
- **`hyperframes_renderer.py`'s `render_hyperframes_video(scenes, image_paths,
  audio_path, output_path, ...)`** is the actual video-composition step
  `orchestrate.py` calls after TTS/image-gen finish — but it's a plain importable
  Python function, callable directly with **one static background image and one
  scene spanning the whole narration**, skipping FLUX generation entirely. It
  already produces the 9:16 vertical frame, kinetic word-by-word captions, and MP4
  render via the `hyperframes` npm CLI (`hyperframes_engine/` — HeyGen's real
  HyperFrames engine, confirmed via the `hyperframes`/`hyperframes-audio` skills:
  an HTML-based, seekable video-composition renderer with its own CLI, not a bespoke
  script).

**So the actual admin "Generate Video" flow is three steps, no AI image generation
in the loop at all:**
1. `python3 tts/read_transcript.py --text "<question_text>"` → narration `.wav`.
2. One small new Python script (not yet written) calling
   `render_hyperframes_video(scenes=[{single scene, full duration}], image_paths=[<one
   fixed Choseno-branded background>], audio_path=<step 1 output>, output_path=...)`.
3. Upload the resulting MP4 to Supabase Storage, set `question_video_url`.

This resolves the earlier open question about "fresh AI images per question, or one
fixed background" — **fixed background**, since nothing about a question card needs
per-question generated photography the way a news short does. It also means this is
fast (seconds, not minutes) and needs no NVIDIA/FLUX credentials — only the local Qwen
TTS model weights already present for the existing news-shorts pipeline. Audio-only
narration (no music bed) also means `hyperframes-audio`'s voiceover-carve system isn't
needed here — that's for a voice competing with a music track, which a plain question
read-aloud doesn't have.

**Not yet done:** the actual small Python wrapper script (step 2) doesn't exist yet —
only analyzed and designed. Still holds the same caution as before: this is local,
dev-only, and the first real run should be the user's own test, not something
triggered blind.

---

<details>
<summary>Earlier note (superseded by the above, kept for context)</summary>

- "Generate video" — button that shells out to the local pipeline at
  `/Users/vmn2k4/Coding/QwneTTS_Feb_19/nvidia_shorts_studio/` (`orchestrate.py`).
  Confirmed shape:
  - **It's a CLI script, not a server.** `python3 orchestrate.py --json-file <path>`,
    run from that folder. No HTTP API to proxy to — a Next.js API route
    (`src/app/api/admin/generate-question-video/route.ts`) shells out with
    `child_process.execFile`, blocking until it exits (acceptable since this only ever
    runs from `next dev` on the admin's own machine, no serverless timeout in play).
  - **It needs a "story" JSON, not a plain question string.** Minimum viable input is
    the *flat* schema it already supports: `{ transcript, image_prompts,
    youtube_title, shorts_description, tweet }` — `transcript` would be the question
    text, `image_prompts` a short list (existing precedent files like
    `inputs/choseno_1min_demo.json` use 10; a single short question likely needs far
    fewer — needs a real test run to see how it looks with 1–2). The API route writes
    this JSON to a temp file, invokes `orchestrate.py --json-file <temp> --output
    <temp mp4 path>`, then uploads the resulting MP4 to Supabase Storage and sets
    `question_video_url`.
  - **Every run generates fresh NVIDIA FLUX images** — flat mode isn't just
    TTS-over-a-static-frame, it calls the image pipeline too (`images/generate_batch_nvidia.py`,
    its own `.venv`). For a one-line question this is probably overkill (slow, and
    pulls in "documentary photography" style images meant for news b-roll, not a
    question card). Worth deciding: generate real images every time, or pin one fixed
    background/branding image per election and pass `--skip-images` with a reused
    `--run-id`.
  - **Output style, important expectation to set:** this pipeline produces
    Ken-Burns-panned photos + kinetic word captions + voiceover (Qwen TTS, default
    voice `Ethan_Cole`) — **not a talking-head AI avatar.** If "a video for each
    question" was meant to look like a person on screen speaking the question, this
    tool doesn't do that; it does the same visual style as the news-shorts pipeline
    (`hyperframes`/Remotion engines, same as the existing Choseno news video content).
    Confirm this look is what you want for question cards before wiring it up.
  - `--brand-profile policy_voices` already exists but appends a "visit
    policyvoices.com" CTA line — **do not use it here**, or a question video ends with
    an unrelated call-to-action.
- Both actions are per-question, sit right next to the existing `allow_video`/
  `allow_context` toggles in the question editor, so setting up a full interview stays
  a single screen: write question → attach video → set answer limit → next question.

**No new "publish interview" step needed** — an `election_questions` row is already
live the moment it's saved (`visible_to_public` already gates voter visibility exactly
like you'd want an interview "published" flag to).

</details>

---

## Gap 2 — Candidate access, "quickly get an interview" (both paths you asked for)

You want: candidates already in the system get it through login; candidates not in the
system get an email link. **Both mechanisms already exist separately** — this is a
matter of connecting them, not building new auth.

**Path A — candidate has an account / already applied:**
Already works. They land on `/apply/[candidateId]`, see the question list, answer,
submit. Only real gap: nothing currently surfaces "you have unanswered questions" as a
dashboard nudge. Add a small home-page/profile card querying
`election_candidates` rows owned by the logged-in user with unanswered
`required`/newly-added questions — a `getMyPendingQuestions(politicianId)` addition to
`elections.ts`, not a new subsystem.

**Path B — candidate has no account yet:**
Reuse `politician_claim_campaigns` + `campaigns.ts` end to end, the same way it already
onboards office-holders who haven't claimed their wall:
1. Admin creates an `unregistered_candidates`-style `election_candidates` row (already
   supported — `20260729000008` and `20260729000013_admin_add_unregistered_candidate.sql`).
2. Admin sends a campaign email (existing `CampaignSendInput`/`sendEmail` flow) whose
   `{{claim_link}}` points at `/apply/[candidateId]?token=...` instead of the existing
   wall-claim URL.
3. `/apply/[candidateId]` gets a token-auth branch: if `?token=` is present and matches
   an outstanding claim row, treat the visitor as that candidate for the duration of the
   session (same trust model the wall-claim flow already uses) — no new token/session
   table, just a second consumer of the existing `politician_claim_campaigns` token
   check.
4. On first answer submit (or explicit "claim your profile" prompt), the same
   claim-redemption path already used for office-holder walls (`officeholder_claim_*`
   migrations, `20260811210000_officeholder_claim_auto_merge_on_invite_redemption.sql`)
   merges the token-authenticated answers into a real account if/when they sign up —
   this merge logic already exists for the exact "answered before claiming" case.

This means Path B is not a new invitation system — it's the office-holder claim flow
pointed at `/apply` instead of `/wall`, plus one new token-check branch on the apply
page. Confirms your requirement ("if a candidate doesn't want to be in our system we
mail the interview link, else they log in") without a second parallel identity model.

---

## Gap 3 — Viewing modes: one video, per-question, or per-question-across-candidates

You described three ways a viewer might want to watch:

1. **One combined video per candidate** (all their Q&A back to back) — *no schema
   change.* `CandidacyWall` already has every answer with `video_url` in `rank` order.
   Add an "Play all answers" mode: a client-side sequencer that autoplays each
   `video_url` in order with the question text as a caption overlay. Pure front-end
   component, reuses existing data.

2. **One video per question, single candidate** — *already exists*, this is just the
   individual answer video shown today on `CandidacyWall`.

3. **One question, many candidates' reactions, swipeable** — **this is the genuinely
   new piece.** Nothing today groups answers *by question across candidates*; every
   existing query (`getPublicCandidateAnswers`) is scoped to one candidate.

   **New:**
   - Service function `getCandidateAnswersByQuestion(supabase, questionId)` in
     `elections.ts` — joins `election_candidate_answers` → `election_candidates` →
     `profiles`, filtered to `status = 'approved'` and the question's
     `visible_to_public`, ordered by e.g. support count or alphabetically. This is a
     genuinely different query shape from the existing candidate-scoped ones (per
     `docs/SERVICES.md`'s rule: keep it a separate function, don't force it into
     `getPublicCandidateAnswers`).
   - New route, e.g. `elections/seat/[seatId]/question/[questionId]/page.tsx`, or a tab
     on the existing seat page (`elections/seat/[seatId]`) next to the candidate
     selector already there — reuses that page's existing seat/candidate-loading code
     (`getSeatWithCandidates`), just re-sliced by question instead of by candidate.
   - **Component:** `QuestionAnswerCarousel` — question (+ its video, if set) pinned at
     top, one candidate's answer video playing, next/prev or swipe to move to the next
     candidate's answer to the *same* question. This is the "swipe up / next" behavior
     you asked for.

---

## Gap 4 — Decided: every answer video is its own wall post (TikTok model)

**Confirmed direction:** an answer video isn't just a field on
`election_candidate_answers` — the moment a candidate submits a video answer, it also
becomes a genuine `posts` row on their wall, tagged as a "pitch." That post gets the
*standard* treatment every other post already has: `comments` (not
`election_answer_comments`), `likes_count`/`dislikes_count` (already exist on `posts`,
already wired through `create_wall_post`/like-toggle RPC), moderation, and comment
rate-limiting — no bespoke comment/like system for interview answers.

This **replaces** the earlier "keep `election_answer_comments` separate" idea. It also
quietly solves Gap 3's carousel: the carousel is just a filtered, TikTok-style rendering
of `posts` (full-bleed video, like button + comment button bottom-right, per your
description), scoped to "posts whose answer belongs to question X" instead of "posts by
ghost Y." One feed primitive, two views of it (a person's wall = their posts; a
question's comparison view = posts filtered by question).

**Schema:**
```sql
ALTER TABLE public.posts
  ADD COLUMN election_answer_id uuid REFERENCES public.election_candidate_answers(id) ON DELETE SET NULL,
  ADD COLUMN post_kind text NOT NULL DEFAULT 'standard'
    CHECK (post_kind IN ('standard', 'answer_pitch'));
```
`post_kind = 'answer_pitch'` is how the wall/feed UI knows to render this post as a
"politician pitch" video card (TikTok-style overlay) instead of a normal text/image post.

**Write path:** extend (not duplicate) the answer-submission flow so that setting
`video_url` on an `election_candidate_answers` row also creates/updates a linked
`posts` row via an RPC modeled directly on `create_wall_post`
(`20260804000009_create_wall_post_rpc.sql` — same shape: resolve `ghost_id` from
`auth.uid()`, set `wall_ghost_id`, feed-visibility columns), plus `election_answer_id`
and `post_kind = 'answer_pitch'`.

**Legacy note:** `election_answer_comments` stays as-is for any *already-submitted*
text/choice/rating answers that never had video (a comment thread makes less sense as a
"post" when there's no video to show) — it isn't retired, just no longer the mechanism
for video answers going forward.

## Gap 3 (ordering) — Decided: simple, no new instrumentation

**Confirmed direction: keep it simple, no view/skip tracking build-out.** Drop the
view-counter and skip-ratio instrumentation from the earlier draft entirely — no new
columns, no new increment RPCs, no new "what counts as a view" threshold to define.
Rank using only what already exists on `posts`:

```sql
ORDER BY
  (likes_count - dislikes_count) * 2
    + (SELECT count(*) FROM comments WHERE post_id = posts.id)
    - GREATEST(0, EXTRACT(DAY FROM now() - created_at) - 2) * 0.5
  DESC
```
(exact weights are a tuning detail, not a design decision) — engagement-weighted, with a
mild decay after the first couple of days so an old high-engagement answer doesn't
permanently bury a brand-new one, but genuinely new content isn't given a hard
guaranteed-impression mechanism either. If this turns out too naive once there's real
usage data, revisit then — not worth building view/skip tracking speculatively now.

---

## Gap 3 UI — mapped to the real seat page

You showed the current `elections/seat/[seatId]` page: a "Community Support" tab
(candidate strip up top with avatar/support-count/rating/comment-count, full ranked
list below with Support buttons). This is the natural home for the interview view, not
a separate route as this plan first assumed — **add a sibling tab next to "Community
Support"** (e.g. "Candidate Interview" / "Q&A") on the same page, reusing the seat +
candidate data that page already loads (`getSeatWithCandidates`).

Inside that tab:
- **Question list** (from `election_questions`, `rank` order), each showing its
  question video (Gap 1) and — by default — one candidate's answer.
- **Click an answer → it swaps into the carousel** for that question, swiping/advancing
  through every other candidate's answer to the *same* question, without leaving the
  question. This is `QuestionAnswerCarousel` (Gap 3) rendered inline under the question,
  not a page navigation.
- **"Has a pitch" indicator + "play entire interview"** — two more surfaces than
  originally scoped:
  1. On the **candidate strip at the top of the seat page** (the S/C/O/D/M/N avatar row
     in your screenshot) — a small badge/icon next to a candidate's name when they have
     at least one video answer, and a "play interview" action that starts the "play
     all" reel (Gap 3, sequenced answers back to back) for that candidate specifically.
  2. On **that candidate's own space** (`CandidacyWall`/`/candidacy/[candidateId]`) —
     same "play entire interview" affordance, same reel, since all their `answer_pitch`
     posts already live there too.
  Both are the same underlying reel component reading the same data
  (`election_candidate_answers` for that candidate, ordered by question rank) — two
  entry points into one feature, not two implementations.

**Playback: full-screen, closeable, strictly shorts (9:16).** Both the carousel and the
"play all" reel open as a full-screen overlay (not an inline card) with a close
control, video always 9:16.
- **Recorded answers already comply** — `VideoRecorder.tsx` already constrains capture
  to `aspectRatio: 9/16` (`facingMode: "user"`) and previews in a `9/16` box. Nothing
  new needed for the record path.
- **Uploads are the actual gap** — nothing today validates an uploaded file's aspect
  ratio, so a candidate could upload a 16:9 or square clip. Needs a check before/at
  upload (read `video.videoWidth`/`videoHeight` off a hidden `<video>` element client
  side, reject or letterbox-crop non-9:16 uploads) — same fix applies to question-video
  uploads (Gap 1) and to admin uploads generally, one shared validation, not
  duplicated per upload site.
- **Generated question videos already comply too** — the `nvidia_shorts_studio`
  pipeline renders 1080×1920 (9:16) by default (see Gap 1), no extra work there.

## Gap 2 (claim-merge + retake) — Decided

**Merge on claim:** confirmed — when a token-answered (unregistered) candidate is later
claimed/registered, merge wall *and* content into the real account, same as the existing
officeholder-claim merge RPCs already do for wall posts
(`20260811210000_officeholder_claim_auto_merge_on_invite_redemption.sql`). Since answer
videos are now `posts` rows (Gap 4) with `wall_ghost_id`, this merge is largely the
*same* merge the officeholder-claim flow already performs — reassign
`wall_ghost_id`/`election_candidates.politician_id` to the claimed profile's ghost, no
separate merge path needed for interview content specifically.

**Completion:** `election_candidates.submitted_at IS NOT NULL` already means "complete"
— no new status column needed, this already exists (`submit_candidate_application`).

**Retake:** confirmed — candidate can retake after submitting; retake **replaces** the
prior answer/video, not appended as history, and is treated as a fresh interview.
Mechanically this is mostly already supported: `election_candidate_answers` has
`UNIQUE (candidate_id, question_id)` (`20260729000002`), so re-answering is already an
upsert at the DB layer. What's actually new:
- UI: an explicit "Retake interview" entry point on `CandidacyWall`/the apply flow after
  `submitted_at` is set (today the apply flow has no defined behavior for revisiting
  after submission — needs to allow re-entry rather than treating it as locked).
- The linked `answer_pitch` post (Gap 4) must be **updated in place** (new `video_url`,
  same `posts.id`) rather than a second post created — otherwise the old video keeps
  living in the wall/comparison feed alongside the new one.
- **Decided: comments/likes carry over.** Retake replaces the *video* only
  (`posts.video_url` updated in place); existing comments and `likes_count`/
  `dislikes_count` on that post are left untouched, not reset. Simpler than the
  alternative too — no delete/archive step needed on retake, just a `video_url` swap.
  One consequence worth knowing about, not blocking: an existing comment could end up
  reading as a reaction to the old video once the new one replaces it — acceptable
  tradeoff for keeping retake simple, and consistent with how a normal wall post's
  comments already survive that post being edited.

## Revised scope note — not election-only, case by case

Confirmed: this shouldn't be hard-locked to elections. A news-reaction interview
("candidates/officeholders respond to this article") is a real near-term case, and
there may be more context types beyond that — **case by case, not one generic engine
built up front.** Concretely, that means:

- **Build the election case now, on `election_questions`/`election_candidate_answers`**
  as this plan already describes — it's the concrete, scoped, buildable case, and
  matches how this codebase already prefers to grow (nullable columns on an existing
  table, not a speculative indirection layer built before there's a second real
  consumer).
- **But design the new UI pieces — the carousel, the "play all" reel, the
  `answer_pitch` post rendering — as primitives that don't assume "election" any deeper
  than their data-fetching function.** `QuestionAnswerCarousel` takes "a question + a
  list of {person, video post}" — for the election case that list comes from
  `getCandidateAnswersByQuestion`; a future news-reaction case would supply the same
  shape from a different query (e.g. politicians who reacted to article X) without
  needing a new carousel component. Same for the "play all" reel and the
  `post_kind = 'answer_pitch'` rendering on a wall — those don't care *why* a post is a
  pitch video, only that it is one.
- **When a news-reaction (or other) context actually gets built**, expect its own
  schema (no seat/roster/candidate concept — could be any officeholder, count of
  respondents is open-ended) and its own admin flow, designed then, against real
  requirements rather than guessed now. Not attempting that design in this pass.

## What this plan does *not* do (deliberately out of scope for now)

- **Admin review/moderation queue before publish.** You said auto-publish; nothing here
  changes that. (Existing `moderation_system`/content-flag tables remain available for
  after-the-fact takedown, unchanged.)

---

## Build order

1. **Schema:** `question_video_url`/`question_video_path`/`max_answer_seconds` on
   `election_questions` (one migration).
2. **Admin:** upload + generate-video buttons in the question editor; wire
   `max_answer_seconds` into the existing `VideoRecorder` prop in
   `CandidateApplicationClient.tsx`.
3. **Candidate access:** token-auth branch on `/apply/[candidateId]`; reuse
   `politician_claim_campaigns` for the email path; `getMyPendingQuestions` for the
   logged-in nudge.
4. **Cross-candidate view:** `getCandidateAnswersByQuestion`, new route,
   `QuestionAnswerCarousel` component (next/prev/swipe), reusing existing
   `getAnswerComments`/`createAnswerComment`.
5. **"Play all" reel:** client-side sequencer component on `CandidacyWall`, no backend
   change.

## Open questions still remaining

1. **Question-video look:** confirmed the pipeline (`nvidia_shorts_studio/orchestrate.py`)
   is Ken-Burns photos + captions + Qwen TTS voiceover, not a talking avatar — is that
   the intended look for a question card? And: fresh AI-generated images per question,
   or one fixed background reused across all questions (faster, cheaper, more
   consistent)?
2. ~~**Feed-visibility scope of `answer_pitch` posts**~~ — **Resolved 2026-08-24, see
   "Post-launch refinements" at the top of this file.** Individually on the
   candidate's own wall (standard treatment); grouped into one "Full Interview"
   story-strip entry, and filtered out of the regular post list, in the general
   Feed.
