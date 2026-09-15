import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfileRole } from "@/lib/services/profile";

// Places one outbound candidate-outreach call. This route is the only place
// that holds TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN -- they never reach the
// browser -- mirroring how api/admin/news-import/generate/route.ts is the
// only place holding GROK_API_KEY.
//
// Authorization is NOT re-implemented here: this uses the caller's own
// cookie session to call is_claim_reviewer_for_candidate() -- the exact
// same "approved election admin for this seat, or a site admin" check the
// existing claim-invite RPC (create_claim_invite) and the new
// candidate_call_attempts RLS policy both already use. That also means the
// insert below runs AS the caller, not as a service role, so a caller who
// fails that check gets blocked by RLS even if this handler had a bug.
//
// Request: POST { candidateId, seatId, phoneNumber, email? } for a real
// candidate call, or POST { phoneNumber, isTest: true } for a bare
// site-admin-only test call with no candidate/seat attached (see
// 20260915000000_test_calls.sql).
// Response: { ok: true, attemptId } | { error: string }
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.choseno.com";

export async function POST(request: NextRequest) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    return NextResponse.json(
      { error: "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER must be set on the server" },
      { status: 500 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const candidateId: string | undefined = body?.candidateId;
  const seatId: string | undefined = body?.seatId;
  const phoneNumber: string | undefined = body?.phoneNumber;
  const email: string | null = body?.email || null;
  const isTest: boolean = body?.isTest === true;

  if (!phoneNumber) {
    return NextResponse.json({ error: "phoneNumber is required" }, { status: 400 });
  }

  if (isTest) {
    // Bare test call -- no candidate/seat, so is_claim_reviewer_for_candidate
    // has nothing to check against. Gate on plain site-admin status instead
    // (matches the RLS policy's own site-admin bypass, and this UI only
    // exists on /admin/calls, already site-admin-gated at the layout level
    // -- this is defense in depth, not the only guard).
    const { data: profile } = await getProfileRole(supabase, user.id);
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Test calls are site-admin only" }, { status: 403 });
    }
  } else {
    if (!candidateId || !seatId) {
      return NextResponse.json({ error: "candidateId and seatId are required for a candidate call" }, { status: 400 });
    }

    // Belt-and-suspenders: the RLS policy on the insert below enforces this
    // regardless, but checking here lets us return a clear 403 instead of a
    // raw Postgres RLS error.
    const { data: isReviewer, error: reviewerError } = await supabase.rpc(
      "is_claim_reviewer_for_candidate" as never,
      { p_candidate_id: candidateId } as never
    );
    if (reviewerError || !isReviewer) {
      return NextResponse.json({ error: "You are not an approved administrator for this seat" }, { status: 403 });
    }

    // Do-not-call enforcement: a prior call where the candidate said "stop
    // calling" (outcome = not_interested) must actually block the next dial,
    // not just sit logged and ignored -- this is a compliance requirement,
    // not a nice-to-have, so there's no override path here. If a candidate
    // was marked not_interested by mistake, the fix is to correct that
    // attempt's outcome from the Calls dashboard (setCallOutcome), not to
    // force a new call through.
    const { data: priorAttempts } = await supabase
      .from("candidate_call_attempts" as never)
      .select("id" as never)
      .eq("candidate_id" as never, candidateId as never)
      .eq("outcome" as never, "not_interested" as never)
      .limit(1);
    if (priorAttempts && priorAttempts.length > 0) {
      return NextResponse.json(
        { error: "This candidate previously asked not to be called again. Correct that outcome on the Calls dashboard first if it was a mistake." },
        { status: 409 }
      );
    }
  }

  const { data: attempt, error: insertError } = await supabase
    .from("candidate_call_attempts" as never)
    .insert({
      candidate_id: isTest ? null : candidateId,
      seat_id: isTest ? null : seatId,
      is_test: isTest,
      phone_number: phoneNumber,
      email: isTest ? null : email,
      status: "queued",
      created_by: user.id,
    } as never)
    .select()
    .single();

  if (insertError || !attempt) {
    return NextResponse.json({ error: insertError?.message || "Failed to log call attempt" }, { status: 500 });
  }

  const attemptId = (attempt as unknown as { id: string }).id;

  const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: phoneNumber,
      From: TWILIO_PHONE_NUMBER,
      Url: `${SITE_URL}/api/telephony/voice?attemptId=${attemptId}`,
      StatusCallback: `${SITE_URL}/api/telephony/status?attemptId=${attemptId}`,
      StatusCallbackEvent: "initiated ringing answered completed",
      StatusCallbackMethod: "POST",
      // Disclosed up front by the agent's own opening line (see
      // docs/CALL_AGENT_SCRIPT.md) -- recording without disclosure is
      // illegal in two-party-consent jurisdictions, so the script and this
      // flag are a matched pair; don't flip this on without also updating
      // the agent's instructions.
      Record: "true",
      // Twilio's own Answering Machine Detection -- reported via
      // AnsweredBy on the status callback (api/telephony/status). Cheaper
      // and more reliable than only guessing "was this a voicemail?" from
      // the transcript after the fact (which the bridge still does too, as
      // a fallback for whatever AMD misses).
      MachineDetection: "DetectMessageEnd",
    }),
  });

  const twilioJson = await twilioRes.json().catch(() => null);

  if (!twilioRes.ok || !twilioJson?.sid) {
    await supabase
      .from("candidate_call_attempts" as never)
      .update({ status: "failed", error_message: twilioJson?.message || "Twilio call creation failed" } as never)
      .eq("id" as never, attemptId as never);
    return NextResponse.json({ error: twilioJson?.message || "Failed to place call via Twilio" }, { status: 502 });
  }

  await supabase
    .from("candidate_call_attempts" as never)
    .update({ status: "ringing", twilio_call_sid: twilioJson.sid, started_at: new Date().toISOString() } as never)
    .eq("id" as never, attemptId as never);

  return NextResponse.json({ ok: true, attemptId });
}
