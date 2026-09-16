import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";
import type { Database } from "@/lib/supabase/types";

// The standalone voice-bridge/ service posts here once a call's audio
// finishes -- final transcript + outcome classification. This app never
// sees call audio itself, only this text summary.
//
// Deliberately does NOT send the follow-up claim/interview email from
// here. inviteCandidateToClaim's edge function (send-claim-invite) requires
// the REAL election admin's own JWT so create_claim_invite's authorization
// check runs as them, not as a service role (see that function's own
// header comment) -- weakening that just to make this webhook fire emails
// would open a hole in a security-sensitive path for a convenience. So
// this route only ever writes call metadata (service role, same
// bypass-RLS pattern as api/telephony/status). The admin "Calls" dashboard
// (CallCampaignDashboardClient) does the actual follow-up send, in the
// browser as the logged-in admin, exactly the way SendInterviewInviteFlow
// already sends the same email -- see sendCallFollowUpEmail() in
// lib/services/calls.ts.
//
// Auth: a shared secret header, since this is a server-to-server call
// between our own two services, not something Twilio signs.

const INTERNAL_WEBHOOK_SECRET = process.env.INTERNAL_WEBHOOK_SECRET;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const VALID_OUTCOMES = new Set(["interested", "not_interested", "callback_requested", "voicemail", "wrong_number"]);

export async function POST(request: NextRequest) {
  if (!INTERNAL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "INTERNAL_WEBHOOK_SECRET is not configured on the server" }, { status: 500 });
  }

  const provided = request.headers.get("x-internal-secret");
  const a = Buffer.from(provided || "");
  const b = Buffer.from(INTERNAL_WEBHOOK_SECRET);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const attemptId: string | undefined = body?.attemptId;
  if (!attemptId) {
    return NextResponse.json({ error: "attemptId is required" }, { status: 400 });
  }

  const update: Record<string, unknown> = {
    status: "completed",
    ended_at: new Date().toISOString(),
  };
  if (typeof body.transcript === "string") update.transcript = body.transcript;
  if (typeof body.outcomeSummary === "string") update.outcome_summary = body.outcomeSummary;
  if (typeof body.outcome === "string" && VALID_OUTCOMES.has(body.outcome)) update.outcome = body.outcome;
  if (typeof body.durationSeconds === "number") update.duration_seconds = body.durationSeconds;
  // Best-effort, reconstructed from the candidate spelling their email out
  // loud on the call (see extractSpokenEmail() in voice-bridge/index.js) --
  // only ever set when something was actually found, never overwrite a
  // real pre-existing address with a failed extraction. Feeds the SAME
  // follow-up-email flow as an email entered up front in StartCallFlow --
  // no separate code path for "email that came from the call itself".
  if (typeof body.email === "string" && body.email.trim()) update.email = body.email.trim();

  const supabase = createSupabaseClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { error } = await supabase
    .from("candidate_call_attempts" as never)
    .update(update as never)
    .eq("id" as never, attemptId as never);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
