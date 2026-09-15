import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { inviteCandidateToClaim } from "./elections";

type Client = SupabaseClient<Database>;

// candidate_call_attempts isn't in the generated Database type yet
// (supabase/migrations/20260914000002_candidate_call_attempts.sql -- apply
// via psql, then `supabase gen types`). Shaped by hand in the meantime,
// same as politician_claim_campaigns in campaigns.ts.
export interface CallAttemptRow {
  id: string;
  candidate_id: string;
  seat_id: string;
  candidate_name: string;
  seat_role_title: string;
  jurisdiction_name: string;
  phone_number: string;
  email: string | null;
  status: "queued" | "ringing" | "in_progress" | "completed" | "failed" | "no_answer" | "busy" | "canceled";
  // Twilio's own Answering Machine Detection result -- a real-time signal
  // from Twilio itself, distinct from (and more reliable than) outcome ===
  // "voicemail", which is the bridge's own after-the-fact transcript guess.
  answered_by: string | null;
  outcome: "interested" | "not_interested" | "callback_requested" | "voicemail" | "wrong_number" | null;
  outcome_summary: string | null;
  transcript: string | null;
  recording_url: string | null;
  duration_seconds: number | null;
  follow_up_email_sent_at: string | null;
  claimed_at: string | null;
  error_message: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

// Every call attempt this caller is authorized to see (all of them for a
// site admin; only their approved seats' for an election admin) -- same
// authorization list_candidate_claim_invite_status already uses. Pass
// seatId to scope to one seat's page; omit for the cross-seat admin
// dashboard.
export async function listCandidateCallAttempts(supabase: Client, seatId?: string) {
  const { data, error } = await supabase.rpc(
    "list_candidate_call_attempts" as never,
    { p_seat_id: seatId || null } as never
  );
  return { data: (data as unknown as CallAttemptRow[] | null) || [], error };
}

// Places the actual outbound call. Not a direct Supabase call -- dialing
// needs TWILIO_*/XAI_API_KEY, which only the server should hold -- so this
// goes through the app's own API route, same pattern as sendEmail() in
// email.ts routing through /api/admin/send-email rather than hitting an
// external provider from the browser. The route re-derives authorization
// from the caller's own cookie session (is_claim_reviewer_for_candidate),
// it isn't just trusting this input.
export async function startCandidateCall(input: {
  candidateId: string;
  seatId: string;
  phoneNumber: string;
  email?: string | null;
}) {
  try {
    const res = await fetch("/api/admin/calls/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.error) {
      return { data: null, error: { message: json?.error || "Failed to start call" } };
    }
    return { data: json, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Call request failed";
    return { data: null, error: { message } };
  }
}

// Fires the EXISTING claim/interview email invite (same function
// SendInterviewInviteFlow uses) for a call that came back interested. Kept
// as its own named export -- rather than inlined at every call site -- so
// the "mark as sent" bookkeeping always happens right alongside the send,
// never drifts from it.
export async function sendCallFollowUpEmail(supabase: Client, attempt: Pick<CallAttemptRow, "id" | "candidate_id" | "email">) {
  if (!attempt.email) {
    return { data: null, error: { message: "No email on file for this candidate" } };
  }
  const { error: inviteError } = await inviteCandidateToClaim(supabase, attempt.candidate_id, attempt.email);
  if (inviteError) return { data: null, error: inviteError };

  const { data, error } = await supabase
    .from("candidate_call_attempts" as never)
    .update({ follow_up_email_sent_at: new Date().toISOString() } as never)
    .eq("id" as never, attempt.id as never)
    .select()
    .single();

  return { data, error };
}

// Manual correction/override for the bridge's best-effort auto-classified
// outcome (see classifyOutcome() in voice-bridge/index.js) -- an admin
// reading the transcript is the source of truth, the heuristic is just a
// head start.
export async function setCallOutcome(
  supabase: Client,
  attemptId: string,
  outcome: CallAttemptRow["outcome"],
  outcomeSummary?: string | null
) {
  return supabase
    .from("candidate_call_attempts" as never)
    .update({ outcome, outcome_summary: outcomeSummary ?? null } as never)
    .eq("id" as never, attemptId as never)
    .select()
    .single();
}

export async function deleteCallAttempt(supabase: Client, attemptId: string) {
  const { error } = await supabase.from("candidate_call_attempts" as never).delete().eq("id" as never, attemptId as never);
  return { error };
}
