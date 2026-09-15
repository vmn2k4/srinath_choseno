# Candidate Outreach Calling

An election seat administrator's option to place an AI-voice outbound phone
call to a candidate — congratulate them, pitch Choseno, and get them booked
for the self-paced video interview — alongside the existing email invite
flow. Every call is logged with its transcript, outcome, and follow-up
status in a dedicated admin dashboard.

**Status**: Built, not yet live — needs a deployed bridge service, Twilio/xAI
credentials, and one verified test call before pointing it at a real
candidate. See "Setup checklist" below.

---

## Why this exists

The existing outreach tools ([OUTREACH_GUIDE.md](../OUTREACH_GUIDE.md),
[POLITICIAN_INVITES_GUIDE.md](POLITICIAN_INVITES_GUIDE.md)) are all
email-based. This adds a phone call as a second outreach channel, run by an
AI voice agent (xAI's Grok Voice) rather than a human — so an election
administrator can reach a candidate who won't read a cold email, without
personally dialing every number on a list.

## How it fits into what already exists

**Nothing about the existing claim-invite email flow changed.** This
reuses it rather than duplicating it:

- The same authorization check as sending an interview-invite email
  (`is_claim_reviewer_for_candidate` — an election seat's approved
  administrator, or a site admin) gates who can place a call.
- A positive call outcome fires the **same**
  `inviteCandidateToClaim()` / `send-claim-invite` email
  ([POLITICIAN_INVITES_GUIDE.md](POLITICIAN_INVITES_GUIDE.md),
  [`SendInterviewInviteFlow.tsx`](../src/components/features/SendInterviewInviteFlow.tsx))
  that already sends the claim link — the call's job is to get a yes and an
  email address, not to be a second way of delivering the link.
- "Registered" in the Calls dashboard is the same
  `election_candidates.claimed_at` signal the existing "Invite Candidates
  to Claim" panel already reads — not a new definition.

## Architecture

Three systems are involved, because none of them talk to each other
directly:

```
Election seat admin clicks "Call Candidate"
  (ElectionSeatPageClient.tsx / StartCallFlow.tsx)
        │
        ▼
POST /api/admin/calls/start ────────► Twilio Calls.create()
  (places the call, logs a "queued"          │
   row, DNC-checks the candidate first)       ▼ (call answered)
        │                          Twilio → POST /api/telephony/voice
        │                                     │  (TwiML: <Connect><Stream>)
        │                                     ▼
        │                     Twilio Media Stream WebSocket
        │                              │
        │                              ▼
        │                     voice-bridge/ (standalone service)
        │                              │
        │                              ▼
        │                  xAI realtime WebSocket (your "Choseno Sales
        │                  Agent", console.x.ai, agent_id-based)
        │
        │◄── Twilio → POST /api/telephony/status  (ringing/completed/AMD result)
        │
        └──◄ voice-bridge/ → POST /api/telephony/complete  (transcript + outcome, call end)

Admin's browser, /admin/calls (open):
  polls candidate_call_attempts → sees a completed "interested" call
  with no follow-up sent yet → fires inviteCandidateToClaim() itself,
  AS the logged-in admin (see "Why the follow-up email isn't automatic
  from a webhook" below)
```

**Why a separate bridge service, and why it can't run on Vercel**: Twilio
speaks its own WebSocket protocol (`{"event":"media","media":{"payload":...}}`)
and xAI's realtime API speaks a different one
(`{"type":"input_audio_buffer.append","audio":...}`) — same audio bytes,
different message envelope, and neither service has ever heard of the
other. Something has to hold both connections open for the whole call and
re-wrap each frame — that's `voice-bridge/`'s entire job, and it has to be
a real always-on process (not a serverless function) because it holds two
live WebSockets open for as long as the phone call lasts.

**Why `agent_id`, not a raw model connection**: the bridge connects to
`wss://api.x.ai/v1/realtime?agent_id=agent_shN9BTY161X5G4oQ` — your
already-configured "Choseno Sales Agent" in
[console.x.ai](https://console.x.ai), not a bare `model=` parameter. That
keeps the actual sales pitch, guardrails, and any tools/connectors
(Calendar, Gmail, `transfer_call`, etc.) editable from the console UI
without a code deploy. The bridge only injects small per-call facts
(candidate name, office, jurisdiction) on top of whatever persona is
already configured there — see
[docs/CALL_AGENT_SCRIPT.md](CALL_AGENT_SCRIPT.md) for the actual script and
setup steps for that console agent.

**Why the follow-up email isn't automatic from a webhook**: it would be the
obvious design — the bridge posts "they said yes," a server-side webhook
immediately sends the claim email. It deliberately does NOT work that way.
`send-claim-invite` (the Edge Function `inviteCandidateToClaim` calls)
requires the *real* election admin's own JWT so `create_claim_invite`'s
authorization check runs as them, not as a service role — see that Edge
Function's own header comment. Weakening that check to let an unattended
webhook fire the email would open a hole in a security-sensitive path for
a convenience. So the completion webhook
([`/api/telephony/complete`](../src/app/api/telephony/complete/route.ts))
only ever writes call metadata (transcript, outcome) with the service-role
key; the actual email send happens client-side, in the browser, the moment
an admin has `/admin/calls` open and it polls in a completed+interested
call with no follow-up sent yet. A manual "Send Follow-up" button on the
dashboard covers the case where nobody has the tab open when a call
finishes.

---

## Schema

### `candidate_call_attempts`

Migration:
[`20260914000002_candidate_call_attempts.sql`](../supabase/migrations/20260914000002_candidate_call_attempts.sql)

One row per outbound call attempt.

| Column | Purpose |
|---|---|
| `candidate_id`, `seat_id` | Which candidate/seat this call was for |
| `phone_number`, `email` | Captured at call time (same "on file or type it in" UX as the email invite flow's email field) — `email` is what enables the auto follow-up |
| `status` | Call mechanics: `queued` → `ringing` → `in_progress` → `completed` \| `failed` \| `no_answer` \| `busy` \| `canceled` — written by Twilio's status callback |
| `answered_by` | Twilio's own Answering Machine Detection result (`human`, `machine_start`, `machine_end_beep`, `fax`, ...) — a real-time signal from Twilio itself |
| `outcome` | The conversation's result: `interested` \| `not_interested` \| `callback_requested` \| `voicemail` \| `wrong_number` — set by `voice-bridge`'s best-effort transcript heuristic, correctable by an admin from the dashboard |
| `outcome_summary`, `transcript` | Free text — the bridge's best-effort interleaved transcript |
| `recording_url`, `duration_seconds`, `twilio_call_sid` | Call mechanics from Twilio |
| `follow_up_email_sent_at` | Set the moment `sendCallFollowUpEmail()` actually sends |
| `created_by` | The admin who placed the call |

RLS: one policy, `is_claim_reviewer_for_candidate(candidate_id)` — the same
function `candidate_claim_invites`' policy already uses. No new
authorization model was introduced for this feature.

### RPCs

- `list_candidate_call_attempts(p_seat_id uuid DEFAULT NULL)` — the admin
  dashboard's data source. Every attempt the caller is authorized to see
  (all of them for a site admin, only their approved seats' for an
  election admin), joined with candidate name, seat/jurisdiction label, and
  `election_candidates.claimed_at`.
- `get_call_attempt_context(p_attempt_id uuid)` — read-only candidate
  name/office lookup for the TwiML webhook to personalize the agent's
  opening line. Deliberately **not** gated by
  `is_claim_reviewer_for_candidate` — that check is about who may *contact*
  a candidate (already enforced once, before the call was ever placed), not
  about who may read a candidate's name and public office, which is the
  same information already shown on that seat's public page. It's called
  with the service-role key (Twilio's webhook has no Supabase session), so
  it couldn't depend on that check anyway.

---

## Do-not-call enforcement

If a candidate's most recent call outcome is `not_interested`,
[`/api/admin/calls/start`](../src/app/api/admin/calls/start/route.ts)
hard-blocks any further call to them — no override. This is a compliance
requirement, not a nice-to-have: a "stop calling me" has to actually
suppress the next dial, not just sit logged and ignored. If an outcome was
set to `not_interested` by mistake, the fix is correcting it from the Calls
dashboard (`setCallOutcome`), not forcing a call through.

## Recording & consent

Every call is placed with `Record: "true"`. The agent's own script
([docs/CALL_AGENT_SCRIPT.md](CALL_AGENT_SCRIPT.md), STATE 1) discloses this
in its opening line before anything else — recording without disclosure is
illegal in two-party-consent jurisdictions. Don't turn off the disclosure
line without also turning off `Record`, and don't turn off `Record` without
updating the script — they're a matched pair.

---

## Files

| File | Purpose |
|---|---|
| [`20260914000002_candidate_call_attempts.sql`](../supabase/migrations/20260914000002_candidate_call_attempts.sql) | Schema, RLS, both RPCs |
| [`src/lib/services/calls.ts`](../src/lib/services/calls.ts) | `startCandidateCall`, `listCandidateCallAttempts`, `setCallOutcome`, `sendCallFollowUpEmail`, `deleteCallAttempt` |
| [`src/app/api/admin/calls/start/route.ts`](../src/app/api/admin/calls/start/route.ts) | Places the Twilio call; holds `TWILIO_*`; DNC check |
| [`src/app/api/telephony/voice/route.ts`](../src/app/api/telephony/voice/route.ts) | Twilio's TwiML webhook — verifies Twilio's signature, personalizes via `get_call_attempt_context`, branches on Twilio's AMD result: a detected machine gets a scripted `<Say>` + `<Hangup>` (outcome recorded right here, since `voice-bridge` never sees this call); a human gets `<Connect><Stream>` into `voice-bridge` |
| [`src/app/api/telephony/status/route.ts`](../src/app/api/telephony/status/route.ts) | Twilio call-status + AMD webhook (service role) |
| [`src/app/api/telephony/complete/route.ts`](../src/app/api/telephony/complete/route.ts) | `voice-bridge` posts final transcript/outcome here (shared-secret auth, service role) |
| [`voice-bridge/`](../voice-bridge/) | Standalone Node service — the actual Twilio↔xAI audio relay. Own [README](../voice-bridge/README.md), doesn't deploy with the Next.js app |
| [`src/components/features/StartCallFlow.tsx`](../src/components/features/StartCallFlow.tsx) | Seat-admin "Call Candidate" modal — search/select/phone+email, mirrors `SendInterviewInviteFlow.tsx` |
| [`src/components/features/CallCampaignDashboardClient.tsx`](../src/components/features/CallCampaignDashboardClient.tsx) | `/admin/calls` — the call log, transcript viewer, outcome correction, follow-up send/status |
| [`docs/CALL_AGENT_SCRIPT.md`](CALL_AGENT_SCRIPT.md) | The persona/call-flow script for the console.x.ai agent, plus setup checklist |

---

## What's unverified (test before calling a real candidate)

Two assumptions in `voice-bridge/index.js` are informed best guesses, not
confirmed against a live call from inside this codebase:

1. **Audio format passthrough** — the bridge requests
   `audio.input/output.format.type: "audio/pcmu"` (a nested field shape,
   not the flat `input_audio_format` string some older
   OpenAI-Realtime-derived descriptions of this API use) so it never has to
   transcode Twilio's 8kHz mu-law audio. If xAI rejects or ignores that, a
   real PCM16↔mu-law conversion step is needed (there's a `TODO` marking
   exactly where).
2. **Bridge hosting region** — recommended near `us-east-1`, on the
   secondhand claim that's where xAI's voice inference runs. Worth a quick
   latency comparison before committing to a region.
3. **Exact xAI event names** — `response.output_audio.delta`,
   `conversation.item.input_audio_transcription.completed`,
   `input_audio_buffer.speech_started`, `response.cancel`, and a
   `conversation.item.create` message with `role: "system"` landing as
   additive context rather than being ignored or misrouted. All plausible
   based on OpenAI-Realtime compatibility and secondhand descriptions of
   this specific API, none confirmed against a real call from this
   codebase. Watch the bridge's console output on the first test call —
   every xAI `error`-type event is logged there.

Test with your own phone number end-to-end (see
[voice-bridge/README.md](../voice-bridge/README.md#local-testing-without-a-real-phone-call))
before this ever dials a candidate.

## Not yet built

- **Tool-calling for outcome capture.** Outcome is currently a post-call
  transcript-keyword heuristic in the bridge, correctable by an admin. A
  more robust version would have the agent call a `log_disposition` tool
  mid-conversation (via the console's own "Add tool" feature) instead —
  see `response.function_call_arguments.done` in xAI's realtime event set.
  Route any such tool's execution through this app's own API (validate,
  apply business rules, then write to Supabase) — never give `voice-bridge`
  Supabase credentials to let a model-invoked tool write directly.
- **Twilio `mark` events for precise playback-queue tracking.** Barge-in
  (`clear` + `response.cancel`) already stops the agent talking over the
  candidate; `mark` would additionally tell the bridge exactly how much of
  a given response the candidate actually heard before interrupting, which
  matters for an accurate transcript but not for the interruption itself.
- **Elastic SIP Trunking directly into xAI**
  (`sip:{xai_number}@sip.voice.x.ai;transport=tls` as the Twilio trunk's
  origination URI), skipping `voice-bridge` entirely for the outbound leg —
  untested, would remove one network hop and simplify deployment, at the
  cost of less control over per-call dynamic context and no place left to
  run custom real-time observability. Worth a benchmark against the bridge
  version (time-to-first-speech, interruption latency, failure rate) before
  switching, not before.
- **Redis-backed call state** for multi-instance/autoscaled `voice-bridge`
  deployments — right now call state lives in that one process's memory
  per connection, which is fine for a single instance but wouldn't survive
  a restart mid-call or work correctly load-balanced across instances.
- **CRTC / Canadian telecom compliance review.** The script already has a
  live opt-out branch ("remove me" → apologize, confirm do-not-call, end
  call — see `CALL_AGENT_SCRIPT.md` STATE 1) and the do-not-call
  enforcement above is real, but whether outbound AI-voice calls to
  candidates specifically need calling-hours limits, a different consent
  basis, or record-keeping beyond what's here is a genuine open legal
  question, not something resolved by this document — check with someone
  qualified before calling at any real volume.

---

## Setup checklist

See [docs/CALL_AGENT_SCRIPT.md](CALL_AGENT_SCRIPT.md#setup-checklist) for
the full list (env vars, migration, bridge deployment, console persona,
test call, consent-compliance check).
