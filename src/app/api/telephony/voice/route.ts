import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";
import type { Database } from "@/lib/supabase/types";

// TwiML webhook Twilio POSTs to the instant a call it placed for us
// connects (the `Url` param on the Calls.create() request in
// api/admin/calls/start/route.ts). Tells Twilio to open a Media Stream --
// raw call audio, both directions -- into the standalone bridge service
// (voice-bridge/), which relays it to xAI's realtime Voice Agent. This app
// never touches call audio itself; it only ever sees text metadata
// (status, transcript, outcome) via api/telephony/status and
// api/telephony/complete.
//
// Public, unauthenticated-by-default endpoint (Twilio can't send a
// Supabase session), so it verifies Twilio's own request signature instead
// -- see https://www.twilio.com/docs/usage/security#validating-requests.

const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const VOICE_BRIDGE_WS_URL = process.env.VOICE_BRIDGE_WS_URL; // e.g. wss://choseno-voice-bridge.up.railway.app/media
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function verifyTwilioSignature(url: string, params: Record<string, string>, signature: string | null): boolean {
  if (!TWILIO_AUTH_TOKEN || !signature) return false;
  const sortedKeys = Object.keys(params).sort();
  const data = sortedKeys.reduce((acc, key) => acc + key + params[key], url);
  const expected = crypto.createHmac("sha1", TWILIO_AUTH_TOKEN).update(Buffer.from(data, "utf-8")).digest("base64");
  // Constant-time compare -- both must be the same length or timingSafeEqual throws.
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function xmlEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function POST(request: NextRequest) {
  const attemptId = request.nextUrl.searchParams.get("attemptId") || "";

  const formData = await request.formData();
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = String(value);
  });

  const signature = request.headers.get("X-Twilio-Signature");
  if (!verifyTwilioSignature(request.url, params, signature)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (!VOICE_BRIDGE_WS_URL) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, the voice agent is not configured. Goodbye.</Say><Hangup/></Response>`;
    return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
  }

  // Personalization context for the agent's opening line and the voicemail
  // fallback message below -- see
  // get_call_attempt_context() in
  // 20260914000002_candidate_call_attempts.sql for why this doesn't need
  // (and can't use) the is_claim_reviewer_for_candidate check. Passed to
  // the bridge as Stream <Parameter>s rather than having the bridge query
  // Supabase itself, so voice-bridge/ never needs any Supabase credentials
  // at all.
  let candidateName = "";
  let seatRoleTitle = "";
  let jurisdictionName = "";
  const supabase =
    SUPABASE_URL && SERVICE_ROLE_KEY
      ? createSupabaseClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
      : null;
  if (supabase && attemptId) {
    const { data } = await supabase.rpc("get_call_attempt_context" as never, { p_attempt_id: attemptId } as never);
    const row = Array.isArray(data) ? data[0] : data;
    candidateName = (row as { candidate_name?: string })?.candidate_name || "";
    seatRoleTitle = (row as { seat_role_title?: string })?.seat_role_title || "";
    jurisdictionName = (row as { jurisdiction_name?: string })?.jurisdiction_name || "";
  }

  // AMD result: with MachineDetection: "DetectMessageEnd" on the original
  // Calls.create() (api/admin/calls/start/route.ts), Twilio delays this
  // very webhook request until detection resolves and includes AnsweredBy
  // here -- not just on the later async /api/telephony/status callback.
  // That means we get to decide BEFORE ever connecting the live agent:
  // a detected machine gets a short scripted message and a clean hangup,
  // never a live conversational session improvising a voicemail drop.
  const answeredBy = params.AnsweredBy || "";
  if (answeredBy.startsWith("machine")) {
    // The call never reaches voice-bridge on this branch, so nothing will
    // ever POST to /api/telephony/complete for it -- record the outcome
    // here instead, or this attempt would sit at status="ringing" forever.
    if (supabase && attemptId) {
      await supabase
        .from("candidate_call_attempts" as never)
        .update({ status: "completed", outcome: "voicemail", answered_by: answeredBy, ended_at: new Date().toISOString() } as never)
        .eq("id" as never, attemptId as never);
    }
    const name = candidateName ? candidateName.split(" ")[0] : "";
    const greeting = name ? `Hi ${name}, this is Sam from Choseno.` : "Hi, this is Sam from Choseno.";
    const voicemail = `${greeting} Congratulations on your candidacy${
      seatRoleTitle ? ` for ${seatRoleTitle}` : ""
    }. We're building free candidate profiles so voters can compare you side by side with others in your race, and we're doing short self-paced video interviews to help with that. I'll follow up by email with a link. Thanks, and good luck out there.`;
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${xmlEscape(voicemail)}</Say><Hangup/></Response>`;
    return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
  }

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${xmlEscape(VOICE_BRIDGE_WS_URL)}">
      <Parameter name="attemptId" value="${xmlEscape(attemptId)}" />
      <Parameter name="candidateName" value="${xmlEscape(candidateName)}" />
      <Parameter name="seatRoleTitle" value="${xmlEscape(seatRoleTitle)}" />
      <Parameter name="jurisdictionName" value="${xmlEscape(jurisdictionName)}" />
    </Stream>
  </Connect>
</Response>`;

  return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
}
