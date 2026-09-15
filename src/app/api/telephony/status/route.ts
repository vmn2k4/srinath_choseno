import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";
import type { Database } from "@/lib/supabase/types";

// Twilio's StatusCallback webhook (configured on the Calls.create() request
// in api/admin/calls/start/route.ts) -- fires as the call moves through
// initiated -> ringing -> answered -> completed, plus terminal states like
// no-answer/busy/failed that never reach the bridge at all. This is the
// only place that updates candidate_call_attempts.status for the
// call-mechanics states; the bridge (voice-bridge/) only ever reports the
// conversation outcome via api/telephony/complete once media has actually
// flowed.
//
// Runs with the service-role key -- same bypass-RLS pattern as
// api/news/[slug]/og-image/route.ts -- since Twilio has no Supabase
// session to authenticate as. Twilio's own request signature is the
// authentication here instead.

const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const STATUS_MAP: Record<string, string> = {
  initiated: "queued",
  ringing: "ringing",
  "in-progress": "in_progress",
  answered: "in_progress",
  completed: "completed",
  busy: "busy",
  failed: "failed",
  "no-answer": "no_answer",
  canceled: "canceled",
};

// See the matching comment in api/telephony/voice/route.ts -- same fix,
// needed here for the same reason.
function resolvePublicUrl(request: NextRequest): string {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (forwardedProto && forwardedHost) {
    const url = new URL(request.url);
    return `${forwardedProto}://${forwardedHost}${url.pathname}${url.search}`;
  }
  return request.url;
}

function verifyTwilioSignature(url: string, params: Record<string, string>, signature: string | null): boolean {
  if (!TWILIO_AUTH_TOKEN || !signature) return false;
  const sortedKeys = Object.keys(params).sort();
  const data = sortedKeys.reduce((acc, key) => acc + key + params[key], url);
  const expected = crypto.createHmac("sha1", TWILIO_AUTH_TOKEN).update(Buffer.from(data, "utf-8")).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const attemptId = request.nextUrl.searchParams.get("attemptId");
  if (!attemptId) return new NextResponse("Missing attemptId", { status: 400 });

  const formData = await request.formData();
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = String(value);
  });

  const signature = request.headers.get("X-Twilio-Signature");
  if (!verifyTwilioSignature(resolvePublicUrl(request), params, signature)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new NextResponse("Server not configured", { status: 500 });
  }

  const supabase = createSupabaseClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const callStatus = params.CallStatus || "";
  const mappedStatus = STATUS_MAP[callStatus];
  const update: Record<string, unknown> = {};
  if (mappedStatus) update.status = mappedStatus;
  if (params.CallDuration) update.duration_seconds = parseInt(params.CallDuration, 10) || null;
  if (params.RecordingUrl) update.recording_url = params.RecordingUrl;
  // Present once Twilio's Answering Machine Detection (MachineDetection on
  // the original calls.create) resolves -- 'human', 'machine_start',
  // 'machine_end_beep', 'fax', etc. See the answered_by column comment in
  // 20260914000002_candidate_call_attempts.sql for why this is kept
  // separate from outcome='voicemail'.
  if (params.AnsweredBy) update.answered_by = params.AnsweredBy;
  if (callStatus === "completed" || callStatus === "busy" || callStatus === "failed" || callStatus === "no-answer" || callStatus === "canceled") {
    update.ended_at = new Date().toISOString();
  }

  if (Object.keys(update).length > 0) {
    await supabase
      .from("candidate_call_attempts" as never)
      .update(update as never)
      .eq("id" as never, attemptId as never);
  }

  return new NextResponse("OK", { status: 200 });
}
