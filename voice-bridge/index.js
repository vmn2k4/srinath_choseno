// Choseno voice-bridge
//
// Relays ONE phone call's audio between Twilio Media Streams and xAI's
// realtime Voice Agent. Twilio originates the outbound call
// (api/admin/calls/start/route.ts in the main app) and, once answered, is
// told via TwiML (api/telephony/voice/route.ts) to open a Media Stream
// WebSocket here. This process then opens a SECOND WebSocket to xAI's
// agent and shuttles audio between the two for the life of the call.
//
// This has to be its own always-on process -- not a Vercel serverless
// function -- because it holds two live WebSockets open for as long as the
// phone call lasts (Vercel functions are short-lived and don't support
// that). See README.md for where to deploy it.
//
// NOTE ON AUDIO FORMAT: Twilio Media Streams send/expect 8kHz mono
// mu-law, base64-encoded, in ~20ms frames. xAI's realtime API is
// OpenAI-Realtime-API-compatible and accepts a matching mu-law passthrough
// format so telephony bridges like this one don't have to transcode --
// configured via session.update's nested `audio.input.format.type` /
// `audio.output.format.type: "audio/pcmu"` below (NOT the older flat
// `input_audio_format`/`output_audio_format` string fields from earlier
// OpenAI-Realtime versions -- both forms have shown up in different
// secondhand descriptions of this API, so if `audio/pcmu` is rejected on a
// live test, try the flat field name next before assuming transcoding is
// required). This assumption is still NOT verified against a live call in
// this codebase -- test it end-to-end before pointing it at a real
// candidate, and if xAI rejects/ignores both forms, this will need a real
// PCM16<->mu-law conversion step (see the TODO near session.update below).

import { WebSocketServer } from "ws";
import { createServer } from "http";
import WebSocket from "ws";

const PORT = process.env.PORT || 3001;
const XAI_API_KEY = process.env.XAI_API_KEY;
const XAI_AGENT_ID = process.env.XAI_AGENT_ID; // e.g. agent_shN9BTY161X5G4oQ
const CHOSENO_APP_URL = process.env.CHOSENO_APP_URL || "https://www.choseno.com"; // for posting call completion back
const INTERNAL_WEBHOOK_SECRET = process.env.INTERNAL_WEBHOOK_SECRET;

if (!XAI_API_KEY || !XAI_AGENT_ID || !INTERNAL_WEBHOOK_SECRET) {
  console.error("Missing required env vars: XAI_API_KEY, XAI_AGENT_ID, INTERNAL_WEBHOOK_SECRET");
  process.exit(1);
}

// Per-call facts (candidate name, office) to inject before the agent's
// first turn. Deliberately sent as a conversation item (see
// conversation.item.create below), NOT as session.update's own
// `instructions` field -- that field's exact semantics against a
// console.x.ai Builder agent_id (append vs. full replace of the persona
// already configured there) aren't confirmed, and getting it wrong would
// silently blow away everything configured in the console. A
// conversation.item.create message is unambiguously additive -- it's a
// system message in the conversation, not a config write -- so it can't
// clobber the Builder persona no matter how that field behaves.
function buildCallContextMessage({ candidateName, seatRoleTitle, jurisdictionName }) {
  const office = [seatRoleTitle, jurisdictionName].filter(Boolean).join(" for ");
  return [
    `Context for this specific call: you are calling ${candidateName || "a candidate"}${
      office ? `, who is running for ${office}` : ""
    }.`,
    "Use their name and office naturally in your opening line instead of a generic greeting.",
    "This call may be recorded -- say so plainly in your first turn, before anything else.",
  ].join(" ");
}

const XAI_CONNECT_TIMEOUT_MS = 6000;

const server = createServer();
const wss = new WebSocketServer({ server, path: "/media" });

wss.on("connection", (twilioWs) => {
  console.log("Twilio media stream connected");

  let xaiWs = null;
  let streamSid = null;
  let attemptId = null;
  let callContext = {};
  // Ordered as they actually arrive, not accumulated into two separate
  // blobs -- see interleaveTranscript()'s comment for why the old
  // two-blob approach actively produced wrong data (a corrected value
  // spoken later in the call textually ends up BEFORE the mistake it
  // corrected, once every agent turn is dumped together followed by
  // every candidate turn together).
  const transcriptTurns = [];
  const callStartedAt = Date.now();

  const closeAll = () => {
    try {
      xaiWs?.close();
    } catch {}
    try {
      twilioWs.close();
    } catch {}
  };

  twilioWs.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (msg.event) {
      case "start": {
        streamSid = msg.start.streamSid;
        const params = msg.start.customParameters || {};
        attemptId = params.attemptId || null;
        callContext = {
          candidateName: params.candidateName || "",
          seatRoleTitle: params.seatRoleTitle || "",
          jurisdictionName: params.jurisdictionName || "",
        };
        console.log(`Stream started: attemptId=${attemptId} candidate=${callContext.candidateName}`);
        connectToXai();
        break;
      }
      case "media": {
        // Forward the raw mu-law frame straight through to xAI -- see the
        // audio-format note at the top of this file.
        if (xaiWs && xaiWs.readyState === WebSocket.OPEN) {
          xaiWs.send(
            JSON.stringify({
              type: "input_audio_buffer.append",
              audio: msg.media.payload,
            })
          );
        }
        break;
      }
      case "stop": {
        console.log(`Stream stopped: attemptId=${attemptId}`);
        reportCompletion();
        closeAll();
        break;
      }
      default:
        break;
    }
  });

  twilioWs.on("close", () => {
    console.log(`Twilio stream closed: attemptId=${attemptId}`);
    reportCompletion();
    closeAll();
  });

  function connectToXai() {
    xaiWs = new WebSocket(`wss://api.x.ai/v1/realtime?agent_id=${XAI_AGENT_ID}`, {
      headers: { Authorization: `Bearer ${XAI_API_KEY}` },
    });

    // If xAI never answers the WebSocket handshake, don't leave the
    // candidate connected to silence indefinitely -- close everything,
    // which ends the call (there's no further TwiML after <Connect><Stream>
    // in api/telephony/voice/route.ts, so Twilio hangs up once this stream
    // disconnects).
    const connectTimeout = setTimeout(() => {
      if (xaiWs && xaiWs.readyState !== WebSocket.OPEN) {
        console.error(`xAI connect timed out: attemptId=${attemptId}`);
        reportCompletion();
        closeAll();
      }
    }, XAI_CONNECT_TIMEOUT_MS);

    xaiWs.on("open", () => {
      clearTimeout(connectTimeout);
      console.log(`xAI realtime connected: attemptId=${attemptId}`);
      // TODO if xAI does NOT honor audio/pcmu passthrough (in either the
      // nested or flat field shape): convert Twilio's mu-law frames to
      // PCM16 before appending above, request pcm16 here instead, and
      // convert xAI's PCM16 output back to mu-law before forwarding to
      // Twilio in the `media` case below.
      xaiWs.send(
        JSON.stringify({
          type: "session.update",
          session: {
            audio: {
              input: { format: { type: "audio/pcmu" } },
              output: { format: { type: "audio/pcmu" } },
            },
            turn_detection: { type: "server_vad" },
          },
        })
      );
      // Per-call context as a conversation item -- see
      // buildCallContextMessage()'s comment for why this isn't sent via
      // session.update's `instructions` field instead.
      xaiWs.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "system",
            content: [{ type: "input_text", text: buildCallContextMessage(callContext) }],
          },
        })
      );
      // Outbound calls must not wait for the prospect to speak first -- they
      // just picked up and said "hello?". This is what makes the agent open
      // immediately instead of sitting in dead air (the same class of bug
      // the very first version of the phone script had, just one layer
      // lower in the stack this time).
      xaiWs.send(JSON.stringify({ type: "response.create" }));
    });

    xaiWs.on("message", (raw) => {
      let event;
      try {
        event = JSON.parse(raw.toString());
      } catch {
        return;
      }

      switch (event.type) {
        case "response.output_audio.delta": {
          if (streamSid && twilioWs.readyState === WebSocket.OPEN) {
            twilioWs.send(
              JSON.stringify({
                event: "media",
                streamSid,
                media: { payload: event.delta },
              })
            );
          }
          break;
        }
        case "response.output_audio_transcript.delta": {
          // One entry per delta chunk, in true arrival order -- merged back
          // into readable per-turn lines at call end (see
          // buildTranscript()). Recording chronologically as events arrive,
          // rather than accumulating into one long-lived string per
          // speaker, is what makes "the last thing said" in the final
          // transcript actually mean the last thing said.
          if (event.delta) transcriptTurns.push({ role: "assistant", text: event.delta });
          break;
        }
        // Event name for the candidate's own speech-to-text varies by
        // provider -- xAI's realtime API is OpenAI-Realtime-compatible per
        // their own docs, which uses this event name for completed input
        // transcription. Confirm against real call logs and adjust if
        // xAI's actual event differs.
        case "conversation.item.input_audio_transcription.completed": {
          if (event.transcript) transcriptTurns.push({ role: "candidate", text: event.transcript });
          break;
        }
        // Server-side VAD detected the candidate starting to talk. Two
        // things need to stop, not just one:
        //  1. xAI itself needs to stop GENERATING the in-progress response
        //     (response.cancel) -- otherwise it keeps producing audio deltas
        //     for a turn nobody will hear, wasting model time/cost.
        //  2. Twilio needs to drop whatever's already been sent and is
        //     queued/playing (`clear`) -- otherwise the agent's voice keeps
        //     coming out of the phone and talks over the candidate, which is
        //     exactly what makes a phone bot feel broken.
        // Both are best-effort: response.cancel on a response that already
        // finished is a harmless no-op-ish error from xAI, not worth
        // guarding against here.
        case "input_audio_buffer.speech_started": {
          if (xaiWs.readyState === WebSocket.OPEN) {
            xaiWs.send(JSON.stringify({ type: "response.cancel" }));
          }
          if (streamSid && twilioWs.readyState === WebSocket.OPEN) {
            twilioWs.send(JSON.stringify({ event: "clear", streamSid }));
          }
          break;
        }
        // Surfaced for visibility during testing -- e.g. a rejected
        // audio/pcmu format, or a response.cancel with nothing active to
        // cancel (harmless, but worth seeing in logs while verifying this
        // bridge against a real call for the first time).
        case "error": {
          console.error(`xAI error event (attemptId=${attemptId}):`, JSON.stringify(event.error || event));
          break;
        }
        default:
          break;
      }
    });

    xaiWs.on("error", (err) => {
      console.error(`xAI socket error (attemptId=${attemptId}):`, err.message);
    });

    xaiWs.on("close", () => {
      console.log(`xAI realtime closed: attemptId=${attemptId}`);
    });
  }

  async function reportCompletion() {
    if (!attemptId) return;
    const transcript = buildTranscript(transcriptTurns);
    const outcome = classifyOutcome(transcript);
    const email = extractSpokenEmail(transcript);
    const durationSeconds = Math.round((Date.now() - callStartedAt) / 1000);

    try {
      await fetch(`${CHOSENO_APP_URL}/api/telephony/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": INTERNAL_WEBHOOK_SECRET,
        },
        body: JSON.stringify({ attemptId, transcript, outcome, email, durationSeconds }),
      });
    } catch (err) {
      console.error(`Failed to report call completion (attemptId=${attemptId}):`, err.message);
    }
  }
});

// Best-effort only -- this exists so the dashboard has SOMETHING to show
// before an admin reviews the transcript, not as a substitute for review.
// An admin can always correct it from the Calls dashboard
// (setCallOutcome() in lib/services/calls.ts / CallCampaignDashboardClient).
function classifyOutcome(transcript) {
  const t = transcript.toLowerCase();
  if (!t.trim()) return null;
  if (/(voicemail|leave a message|after the tone|please leave)/.test(t)) return "voicemail";
  if (/(wrong number|no one by that name|you have the wrong)/.test(t)) return "wrong_number";
  if (/(not interested|no thank you|please remove|don't call|stop calling)/.test(t)) return "not_interested";
  if (/(call.*back|call me later|try again|another time)/.test(t)) return "callback_requested";
  if (/(yes|sure|sounds good|send it|go ahead|set (it |that )?up)/.test(t)) return "interested";
  return null;
}

// A candidate spells an email out loud on a phone call ("V M N 2 K 4 at
// gmail dot com"), not as already-formatted text -- a regex for a real
// address (x@y.z) almost never matches the transcript at all. Reconstructs
// one from the spoken "<local part> at <domain> dot <tld>" pattern
// instead, stripping the spaces speech-to-text puts between spelled-out
// letters/digits. Best-effort, same posture as classifyOutcome() above --
// an admin should still glance at the transcript before trusting this for
// anything higher-stakes than the follow-up email send it's used for here.
function extractSpokenEmail(transcript) {
  const text = transcript.toLowerCase();
  // The local-part group requires EVERY token to be a single alphanumeric
  // character (how people actually spell things out: "b m n 2 k 4"), not
  // any run of letters/digits/spaces -- an earlier version used the loose
  // form and it genuinely matched into the middle of ordinary words (e.g.
  // grabbed the "o" out of "so" right before a real spelled-out name,
  // confirmed against a real call transcript). The lookbehind additionally
  // blocks starting mid-word after a contraction's apostrophe (the "s" in
  // "it's"), which the loose word-boundary check alone still let through.
  const pattern = /(?<![a-z0-9'])((?:[a-z0-9]\s+){1,}[a-z0-9])\s+at\s+([a-z0-9]+(?:\s+[a-z0-9]+)*)\s+dot\s+([a-z]{2,})/g;
  const stripSpaces = (s) => s.replace(/\s+/g, "");
  let email = null;
  // Take the LAST match, not the first -- interleaveTranscript concatenates
  // the whole agent block then the whole candidate block rather than true
  // chronological turns, and within the agent's own block a misheard first
  // attempt followed by "let me confirm that back" / a corrected repeat
  // both match this pattern. The last one spoken is the corrected one --
  // confirmed against a real call where the agent said the wrong spelling
  // once, then repeated the candidate's correction verbatim right after.
  for (const match of text.matchAll(pattern)) {
    const local = stripSpaces(match[1]);
    const domain = stripSpaces(match[2]);
    const tld = stripSpaces(match[3]);
    if (!local || !domain || !tld) continue;
    const candidate = `${local}@${domain}.${tld}`;
    // Sanity check -- if the reconstruction doesn't even look like an
    // email, don't let it overwrite a better earlier match.
    if (/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(candidate)) email = candidate;
  }
  return email;
}

// Merges transcriptTurns (one entry per delta chunk/completed utterance, in
// true arrival order) into readable per-turn lines: consecutive entries
// from the same speaker join into one line, a speaker change starts a new
// line. This used to be two separately-accumulated strings concatenated
// "all agent text, then all candidate text" -- which actively produced
// wrong data, not just unreadable output: a corrected value spoken LATER
// in the real call would textually land BEFORE the mistake it corrected,
// so anything reading "the last mention" (extractSpokenEmail above) could
// grab the uncorrected value. Confirmed live on a real call with an email
// correction. True arrival order fixes both the readability and the
// extraction correctness at the same root cause.
function buildTranscript(turns) {
  const lines = [];
  let currentRole = null;
  let currentText = "";
  for (const turn of turns) {
    if (turn.role !== currentRole) {
      if (currentText.trim()) lines.push(`${currentRole === "assistant" ? "Agent" : "Candidate"}: ${currentText.trim()}`);
      currentRole = turn.role;
      currentText = "";
    }
    currentText += turn.text;
  }
  if (currentText.trim()) lines.push(`${currentRole === "assistant" ? "Agent" : "Candidate"}: ${currentText.trim()}`);
  return lines.join("\n\n");
}

server.listen(PORT, () => {
  console.log(`voice-bridge listening on :${PORT} (WebSocket path /media)`);
});
