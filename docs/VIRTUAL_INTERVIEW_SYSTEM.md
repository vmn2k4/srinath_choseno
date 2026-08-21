> **Implementation status (2026-08-20):** Gaps 1, 3, and 4 are built and live —
> migration `20260821000000_candidate_video_interviews.sql` applied, service layer,
> `QuestionAnswerCarousel`, `PlayInterviewReel`, the seat-page "Candidate Interview" tab,
> the CandidacyWall "Play Interview" button, and the admin question-video/duration
> fields are all in place and typecheck/run clean. **Not built:** Gap 2's email-token
> (no-account) candidate access path and the live "Generate via Qwen" trigger — both
> deliberately deferred, see the notes inline below.

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
2. **Feed-visibility scope of `answer_pitch` posts:** Gap 4 makes every video answer a
   full `posts` row — should these also appear in the *main* Choseno feed (like a normal
   wall post does today, per `create_wall_post`'s `is_country`/`is_international`
   flags), or only ever surface on (a) the candidate's own wall and (b) the
   question-comparison carousel? Affects whether `submit_candidate_application`'s daily
   post-limit / feed-boundary logic needs to apply to them.
