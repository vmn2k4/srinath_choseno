# choseno-voice-bridge

Standalone audio relay between Twilio Media Streams and xAI's realtime Voice
Agent, for Choseno's candidate-outreach calling feature (`/admin/calls` in
the main app). This is a separate Node process, not part of the Next.js app
— it holds two live WebSockets open for the duration of each phone call,
which doesn't fit Vercel's serverless model.

## How it fits together

```
Admin clicks "Call" (/admin/calls or a seat page)
        │
        ▼
Next.js: POST /api/admin/calls/start  ──►  Twilio Calls.create()
        │                                        │
        │                                        ▼ (call answered)
        │                              Twilio: POST /api/telephony/voice
        │                                        │  (returns TwiML)
        │                                        ▼
        │                       Twilio Media Stream WebSocket ──► THIS SERVICE (/media)
        │                                                              │
        │                                                              ▼
        │                                                    xAI realtime WebSocket
        │                                                    (wss://api.x.ai/v1/realtime)
        │
        │◄── Twilio: POST /api/telephony/status (call state: ringing/completed/...)
        │
        └──◄ THIS SERVICE: POST /api/telephony/complete (transcript + outcome, once the call ends)
```

Nothing about the follow-up email lives here — that's sent from the admin's
own browser session on `/admin/calls`, reusing the existing
`inviteCandidateToClaim` flow, because that flow requires the real admin's
own login (see the comment in `src/app/api/telephony/complete/route.ts`).

## Before you deploy this

**The audio format assumption in `index.js` is unverified against a real
call.** Twilio Media Streams send/expect 8kHz mono mu-law audio
(`g711_ulaw`). xAI's realtime API is documented as
OpenAI-Realtime-API-compatible, and OpenAI's API accepts
`input_audio_format`/`output_audio_format: "g711_ulaw"` in `session.update`
specifically to avoid transcoding for telephony bridges like this one. This
code assumes xAI's API honors the same fields — confirm that with one test
call before pointing it at a real candidate. If xAI rejects/ignores those
fields, you'll need to convert Twilio's mu-law frames to PCM16 before
sending to xAI (and back again on the way out) — there's a `TODO` marking
exactly where in `index.js`.

## Setup

```bash
cd voice-bridge
npm install
cp .env.example .env   # fill in XAI_API_KEY, XAI_AGENT_ID, INTERNAL_WEBHOOK_SECRET
npm start
```

## Deploying

This needs a host that keeps a process running (not serverless) and gives
you a public `wss://` URL. Railway or Fly.io are the easiest fits — either
one:

1. Push this `voice-bridge/` directory as its own service (Railway: "Deploy
   from repo" with this as the root directory; Fly.io: `fly launch` from
   inside `voice-bridge/`).
2. Set the same env vars from `.env.example` in that platform's dashboard.
   **Region matters for call quality**: pick a region near `us-east-1`
   (Virginia) if the platform offers a choice — that's reportedly where
   xAI's voice inference runs, and an extra 80-150ms round trip between the
   bridge and xAI is audible as sluggish turn-taking on a live call. This
   is secondhand, not confirmed against xAI's own infra docs — worth a
   quick latency test against a couple of regions before committing.
3. Once deployed, you'll have a public URL like
   `https://choseno-voice-bridge.up.railway.app`. Its WebSocket path is
   `/media`, so `VOICE_BRIDGE_WS_URL` in the **main app's** environment
   should be `wss://choseno-voice-bridge.up.railway.app/media`.
4. `INTERNAL_WEBHOOK_SECRET` must be the exact same value in both this
   service's env and the main app's env — generate one with
   `openssl rand -hex 32`.

## Local testing without a real phone call

Twilio needs a public HTTPS URL for its webhooks and a public `wss://` URL
for the Media Stream — `ngrok http 3001` (tunnel this service) and a second
tunnel for the Next.js app's `/api/telephony/voice` and
`/api/telephony/status` routes will let you test against a real Twilio call
before deploying anywhere permanent.
