"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import AdminSubNav from "./AdminSubNav";
import {
  Phone,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Mail,
  CheckCircle2,
  Loader2,
  Trash2,
} from "lucide-react";
import { Card, Button, Spinner, PageHeader, Badge } from "@/components/primitives";
import { createClient } from "@/lib/supabase/client";
import {
  listCandidateCallAttempts,
  sendCallFollowUpEmail,
  setCallOutcome,
  deleteCallAttempt,
  type CallAttemptRow,
} from "@/lib/services/calls";

const STATUS_TONE: Record<string, "neutral" | "amber" | "emerald" | "rose" | "primary"> = {
  queued: "neutral",
  ringing: "amber",
  in_progress: "primary",
  completed: "emerald",
  failed: "rose",
  no_answer: "amber",
  busy: "amber",
  canceled: "neutral",
};

const OUTCOME_LABEL: Record<string, string> = {
  interested: "Interested",
  not_interested: "Not interested",
  callback_requested: "Callback requested",
  voicemail: "Left voicemail",
  wrong_number: "Wrong number",
};

const OUTCOME_TONE: Record<string, "neutral" | "amber" | "emerald" | "rose" | "primary"> = {
  interested: "emerald",
  not_interested: "rose",
  callback_requested: "amber",
  voicemail: "neutral",
  wrong_number: "neutral",
};

// A candidate the bridge (or the auto-classifier's heuristic) flagged as
// worth following up on -- these are the rows eligible for the SAME
// inviteCandidateToClaim() email SendInterviewInviteFlow sends, just
// triggered here instead of typed by hand. See sendCallFollowUpEmail() in
// lib/services/calls.ts for why this can only fire from an authenticated
// admin's own browser session, not from the telephony webhooks themselves.
const AUTO_FOLLOW_UP_OUTCOMES = new Set(["interested", "callback_requested"]);

export default function CallCampaignDashboardClient() {
  const supabase = createClient();
  const [attempts, setAttempts] = useState<CallAttemptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sendingFollowUpId, setSendingFollowUpId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const autoSentRef = useRef<Set<string>>(new Set());

  const fetchAttempts = useCallback(async () => {
    const { data, error: fetchError } = await listCandidateCallAttempts(supabase);
    if (fetchError) {
      setError(fetchError.message || "Failed to load calls");
    } else {
      setError("");
      setAttempts(data);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchAttempts();
    // Polling, not a realtime channel -- this is a low-frequency admin
    // dashboard, not a live feed, and this keeps it simple. Also doubles as
    // the trigger for the auto-follow-up email check below.
    const interval = setInterval(fetchAttempts, 20000);
    return () => clearInterval(interval);
  }, [fetchAttempts]);

  const runFollowUp = useCallback(
    async (attempt: CallAttemptRow) => {
      if (autoSentRef.current.has(attempt.id)) return;
      autoSentRef.current.add(attempt.id);
      setSendingFollowUpId(attempt.id);
      await sendCallFollowUpEmail(supabase, attempt);
      setSendingFollowUpId(null);
      fetchAttempts();
    },
    [supabase, fetchAttempts]
  );

  // Auto-fire the follow-up the moment a completed call with a positive
  // outcome shows up and hasn't been emailed yet -- only happens while this
  // dashboard is open in an admin's browser (see the module comment above).
  useEffect(() => {
    for (const attempt of attempts) {
      if (
        attempt.status === "completed" &&
        attempt.outcome &&
        AUTO_FOLLOW_UP_OUTCOMES.has(attempt.outcome) &&
        !attempt.follow_up_email_sent_at &&
        attempt.email &&
        !autoSentRef.current.has(attempt.id)
      ) {
        runFollowUp(attempt);
      }
    }
  }, [attempts, runFollowUp]);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSetOutcome = async (attemptId: string, outcome: CallAttemptRow["outcome"]) => {
    await setCallOutcome(supabase, attemptId, outcome);
    fetchAttempts();
  };

  const handleDelete = async (attemptId: string) => {
    await deleteCallAttempt(supabase, attemptId);
    fetchAttempts();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <AdminSubNav active="calls" className="mb-5" />
      <PageHeader
        icon={Phone}
        title="Candidate Calls"
        subtitle="Outbound outreach calls placed via the xAI Voice Agent -- status, transcript, outcome, and follow-up email tracking."
        action={
          <Button size="sm" variant="outline" onClick={fetchAttempts} className="gap-1.5">
            <RefreshCw size={14} /> Refresh
          </Button>
        }
      />

      {error && (
        <Card padding="sm" className="mb-4 border-danger/40 bg-danger/5">
          <p className="text-xs text-danger">{error}</p>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : attempts.length === 0 ? (
        <Card padding="lg" className="text-center">
          <p className="text-sm text-text-muted">
            No calls yet. Start one from a seat's admin panel (Elections &amp; Seats → a seat you administer → "Call
            Candidate").
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {attempts.map((a) => {
            const isExpanded = expanded.has(a.id);
            const canFollowUp =
              a.status === "completed" &&
              a.outcome &&
              AUTO_FOLLOW_UP_OUTCOMES.has(a.outcome) &&
              !!a.email &&
              !a.follow_up_email_sent_at;
            return (
              <Card key={a.id} padding="md">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-text-main">{a.candidate_name}</p>
                      <Badge tone={STATUS_TONE[a.status] || "neutral"}>{a.status.replace(/_/g, " ")}</Badge>
                      {a.answered_by && a.answered_by.startsWith("machine") && (
                        <Badge tone="amber">Voicemail (Twilio-detected)</Badge>
                      )}
                      {a.outcome && <Badge tone={OUTCOME_TONE[a.outcome] || "neutral"}>{OUTCOME_LABEL[a.outcome]}</Badge>}
                      {a.claimed_at ? (
                        <Badge tone="emerald">Registered</Badge>
                      ) : (
                        <Badge tone="neutral">Not registered yet</Badge>
                      )}
                    </div>
                    <p className="text-xs text-text-muted mt-1">
                      {[a.seat_role_title, a.jurisdiction_name].filter(Boolean).join(" — ")} · {a.phone_number}
                      {a.email ? ` · ${a.email}` : ""}
                    </p>
                    {a.outcome_summary && <p className="text-xs text-text-muted mt-1 italic">"{a.outcome_summary}"</p>}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {sendingFollowUpId === a.id ? (
                      <Badge tone="primary" icon={<Loader2 size={10} className="animate-spin" />}>
                        Sending follow-up…
                      </Badge>
                    ) : a.follow_up_email_sent_at ? (
                      <Badge tone="emerald" icon={<CheckCircle2 size={10} />}>
                        Follow-up sent
                      </Badge>
                    ) : canFollowUp ? (
                      <Button size="sm" variant="outline" onClick={() => runFollowUp(a)} className="gap-1.5 text-xs">
                        <Mail size={12} /> Send Follow-up
                      </Button>
                    ) : null}
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(a.id)} title="Delete this call record">
                      <Trash2 size={13} className="text-danger" />
                    </Button>
                  </div>
                </div>

                {a.transcript && (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(a.id)}
                    className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary-light hover:underline"
                  >
                    {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    {isExpanded ? "Hide transcript" : "View transcript"}
                  </button>
                )}
                {isExpanded && a.transcript && (
                  <pre className="mt-2 whitespace-pre-wrap text-xs text-text-muted bg-surface-active/40 rounded-lg p-3 max-h-64 overflow-y-auto font-sans">
                    {a.transcript}
                  </pre>
                )}

                {a.status === "completed" && (
                  <div className="mt-3 pt-3 border-t border-border-light/30 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold text-text-muted mr-1">
                      {a.outcome ? "Correct outcome:" : "Mark outcome:"}
                    </span>
                    {(Object.keys(OUTCOME_LABEL) as Array<keyof typeof OUTCOME_LABEL>).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleSetOutcome(a.id, key as CallAttemptRow["outcome"])}
                        className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
                          a.outcome === key
                            ? "border-primary/40 bg-primary/15 text-primary-light font-semibold"
                            : "border-border-light/40 text-text-muted hover:border-primary/30"
                        }`}
                      >
                        {OUTCOME_LABEL[key]}
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
