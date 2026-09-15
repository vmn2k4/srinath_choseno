"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import AdminSubNav from "./AdminSubNav";
import StartCallFlow from "./StartCallFlow";
import {
  Phone,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Mail,
  CheckCircle2,
  Loader2,
  Trash2,
  X,
  PhoneCall,
} from "lucide-react";
import { Card, Button, Spinner, PageHeader, Badge, Modal, Select } from "@/components/primitives";
import { createClient } from "@/lib/supabase/client";
import {
  listCandidateCallAttempts,
  sendCallFollowUpEmail,
  setCallOutcome,
  deleteCallAttempt,
  type CallAttemptRow,
} from "@/lib/services/calls";
import { getElections, getElectionSeatsByElectionId, getCandidatesBySeatIds } from "@/lib/services/elections";

interface ElectionOption {
  id: string;
  name: string;
}
interface SeatOption {
  id: string;
  role_title: string;
  map_shapes?: { name?: string } | { name?: string }[] | null;
}

// This page is under /admin -- gated to site admins only (see
// src/app/admin/layout.tsx), who can act on any seat, unlike an election
// administrator who's scoped to their own approved seats via the seat
// page's own "Call Candidate" button (ElectionSeatPageClient.tsx). So the
// entry point here has to resolve a seat first -- an admin browsing this
// dashboard hasn't necessarily come from any one seat's page -- then hands
// off to the exact same StartCallFlow component the seat page uses, just
// fed a seatId + candidate list resolved through this picker instead of
// already being on hand.
function CallSeatPicker({ onClose, onCalled }: { onClose: () => void; onCalled: () => void }) {
  const supabase = createClient();
  const [elections, setElections] = useState<ElectionOption[]>([]);
  const [seats, setSeats] = useState<SeatOption[]>([]);
  const [electionId, setElectionId] = useState("");
  const [seatId, setSeatId] = useState("");
  const [candidates, setCandidates] = useState<{ id: string; profiles?: { full_name?: string } | null }[]>([]);
  const [loadingElections, setLoadingElections] = useState(true);
  const [loadingSeats, setLoadingSeats] = useState(false);

  useEffect(() => {
    getElections(supabase).then(({ data }) => {
      setElections((data as ElectionOption[] | null) || []);
      setLoadingElections(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectElection = async (id: string) => {
    setElectionId(id);
    setSeatId("");
    setSeats([]);
    if (!id) return;
    setLoadingSeats(true);
    const { data } = await getElectionSeatsByElectionId(supabase, id);
    setSeats((data as SeatOption[] | null) || []);
    setLoadingSeats(false);
  };

  const selectSeat = async (id: string) => {
    setSeatId(id);
    if (!id) return;
    const { data } = await getCandidatesBySeatIds(supabase, [id]);
    setCandidates((data as { id: string; profiles?: { full_name?: string } | null }[] | null) || []);
  };

  const seatLabel = (seat: SeatOption) => {
    const shape = Array.isArray(seat.map_shapes) ? seat.map_shapes[0] : seat.map_shapes;
    return [seat.role_title, shape?.name].filter(Boolean).join(" — ");
  };

  if (seatId) {
    return <StartCallFlow seatId={seatId} existingCandidates={candidates} onClose={onClose} onCalled={onCalled} />;
  }

  return (
    <Modal onOverlayClick={onClose}>
      <Card padding="md" className="w-full max-w-lg space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-text-main flex items-center gap-2">
            <PhoneCall size={16} className="text-primary" /> Call Candidate
          </h3>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>
        <p className="text-xs text-text-muted">
          Pick the race first, then who to call — same flow as the seat page's own "Call Candidate" button.
        </p>
        {loadingElections ? (
          <div className="flex justify-center py-3">
            <Spinner size="sm" />
          </div>
        ) : (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-text-muted">Election</label>
            <Select value={electionId} onChange={(e) => selectElection(e.target.value)}>
              <option value="">Select an election…</option>
              {elections.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        {electionId && (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-text-muted">Seat</label>
            {loadingSeats ? (
              <div className="flex justify-center py-3">
                <Spinner size="sm" />
              </div>
            ) : (
              <Select value={seatId} onChange={(e) => selectSeat(e.target.value)}>
                <option value="">Select a seat…</option>
                {seats.map((s) => (
                  <option key={s.id} value={s.id}>
                    {seatLabel(s)}
                  </option>
                ))}
              </Select>
            )}
          </div>
        )}
      </Card>
    </Modal>
  );
}

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
  const [showCallPicker, setShowCallPicker] = useState(false);
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
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 space-y-6">
      <AdminSubNav active="calls" className="mb-5" />
      <PageHeader
        icon={Phone}
        title="Candidate Calls"
        subtitle="Outbound outreach calls placed via the xAI Voice Agent -- status, transcript, outcome, and follow-up email tracking."
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setShowCallPicker(true)} className="gap-1.5">
              <Phone size={14} /> Call Candidate
            </Button>
            <Button size="sm" variant="outline" onClick={fetchAttempts} className="gap-1.5">
              <RefreshCw size={14} /> Refresh
            </Button>
          </div>
        }
      />

      {showCallPicker && (
        <CallSeatPicker
          onClose={() => setShowCallPicker(false)}
          onCalled={() => {
            setShowCallPicker(false);
            fetchAttempts();
          }}
        />
      )}

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
        <Card padding="lg" className="text-center space-y-3">
          <p className="text-sm text-text-muted">
            No calls yet. Click "Call Candidate" above, or start one from a seat's own admin panel.
          </p>
          <Button size="sm" onClick={() => setShowCallPicker(true)} className="gap-1.5 mx-auto">
            <Phone size={14} /> Call Candidate
          </Button>
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
