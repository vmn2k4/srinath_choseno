"use client";

import React, { useMemo, useState } from "react";
import Modal from "@/components/primitives/Modal";
import { Card, Button, Badge, Textarea, Spinner } from "@/components/primitives";
import { updateElectionQuestionVideo, updateElectionQuestionNarrationText } from "@/lib/services/elections";
import { createClient } from "@/lib/supabase/client";
import { X, Video, Wand2, ChevronLeft, ChevronRight, Check, RefreshCw, AlertCircle } from "lucide-react";

interface QuestionRow {
  id: string;
  question_text: string;
  question_type: string;
  narration_text?: string | null;
  question_video_url?: string | null;
  election_question_options?: { id: string; option_text: string; rank: number }[];
}

type GenStatus = "idle" | "generating" | "ready" | "error";

// A sensible spoken-script default: for a question type whose raw
// question_text alone doesn't read naturally on its own (ranking/choice --
// "Rank the following issues..." needs the options actually spoken),
// append them; other types (text/rating) already read fine as-is. Still
// fully editable per question -- this is only the starting point, not the
// final script.
function defaultNarration(q: QuestionRow): string {
  if (q.narration_text) return q.narration_text;
  const opts = (q.election_question_options || []).sort((a, b) => a.rank - b.rank).map((o) => o.option_text);
  if (opts.length > 0) {
    return `${q.question_text} The options are: ${opts.join(", ")}.`;
  }
  return q.question_text;
}

// Bulk "Generate Question Videos" flow: edit a per-question video script
// (defaults to question_text, pre-expanded with options for ranking/choice
// questions -- see 20260821000002_election_question_narration_text.sql),
// generate each one sequentially (the generator's shared working files make
// parallel calls unsafe -- see generate.py's own header comment), then
// review every result in a full-screen swipeable carousel and approve
// individually. The SAME edited script drives both what the video shows on
// screen and what it speaks -- no separate "display" vs "narration" text,
// so there's no way for the two to silently diverge. Approving persists
// question_video_url + narration_text; anything not approved is simply
// discarded. The existing per-question edit panel (upload/replace video) is
// untouched -- this is an additional, faster path, not a replacement.
export default function GenerateQuestionVideosFlow({
  questions,
  onClose,
  onApproved,
}: {
  questions: QuestionRow[];
  onClose: () => void;
  onApproved: () => void;
}) {
  const supabase = createClient();
  const [mode, setMode] = useState<"edit" | "reviewing">("edit");
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(questions.map((q) => [q.id, defaultNarration(q)]))
  );
  const [status, setStatus] = useState<Record<string, GenStatus>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, { videoUrl: string; videoPath: string }>>({});
  const [generatingAll, setGeneratingAll] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [approved, setApproved] = useState<Record<string, boolean>>({});

  const generateOne = async (questionId: string) => {
    const q = questions.find((x) => x.id === questionId);
    if (!q) return;
    setStatus((p) => ({ ...p, [questionId]: "generating" }));
    setErrors((p) => ({ ...p, [questionId]: "" }));
    try {
      // Both the on-screen text and the spoken narration come from the SAME
      // edited script -- no silent divergence between what's shown and
      // what's said (an earlier version sent question_text as the on-screen
      // text regardless of edits here, which is exactly the mismatch this
      // was reported against).
      const script = drafts[questionId] || q.question_text;
      const res = await fetch("/api/admin/generate-question-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ narrationText: script, displayText: script }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Generation failed");
      setResults((p) => ({ ...p, [questionId]: { videoUrl: data.videoUrl, videoPath: data.videoPath } }));
      setStatus((p) => ({ ...p, [questionId]: "ready" }));
    } catch (err: any) {
      setStatus((p) => ({ ...p, [questionId]: "error" }));
      setErrors((p) => ({ ...p, [questionId]: err?.message || "Generation failed" }));
    }
  };

  const generateAll = async () => {
    setGeneratingAll(true);
    // Sequential, deliberately -- see the component doc comment above.
    for (const q of questions) {
      if (status[q.id] === "ready") continue;
      await generateOne(q.id);
    }
    setGeneratingAll(false);
    // Straight into review -- a generated video is only held in memory
    // until approved (see approveCurrent), so the natural next step after
    // "Generate All" finishes is reviewing it, not a separate button click
    // that's easy to miss and walk away from.
    setReviewIndex(0);
    setMode("reviewing");
  };

  const readyQuestionIds = useMemo(() => questions.filter((q) => status[q.id] === "ready").map((q) => q.id), [questions, status]);
  const unapprovedReadyCount = readyQuestionIds.filter((id) => !approved[id]).length;

  const startReview = () => {
    setReviewIndex(0);
    setMode("reviewing");
  };

  // Jump straight into review for one specific question -- reachable right
  // from its row in edit mode, not just the global "Review & Approve"
  // button, so approving a single generated video doesn't require
  // remembering a separate step.
  const startReviewFor = (questionId: string) => {
    const idx = readyQuestionIds.indexOf(questionId);
    if (idx === -1) return;
    setReviewIndex(idx);
    setMode("reviewing");
  };

  // Generated-but-unapproved videos exist only in this component's memory
  // (results state) -- closing without approving silently discards them,
  // which is exactly what was reported. Confirm first whenever there's
  // something real to lose.
  const handleCloseAttempt = () => {
    if (unapprovedReadyCount > 0) {
      const ok = window.confirm(
        `${unapprovedReadyCount} generated video${unapprovedReadyCount > 1 ? "s haven't" : " hasn't"} been approved yet. Closing now will discard ${unapprovedReadyCount > 1 ? "them" : "it"}. Close anyway?`
      );
      if (!ok) return;
    }
    onClose();
  };

  const currentReviewId = readyQuestionIds[reviewIndex];
  const currentReviewQuestion = questions.find((q) => q.id === currentReviewId);
  const currentReviewResult = currentReviewId ? results[currentReviewId] : null;

  const approveCurrent = async () => {
    if (!currentReviewId || !currentReviewResult) return;
    await updateElectionQuestionVideo(supabase, currentReviewId, {
      videoUrl: currentReviewResult.videoUrl,
      videoPath: currentReviewResult.videoPath,
    });
    await updateElectionQuestionNarrationText(supabase, currentReviewId, drafts[currentReviewId] || null);
    setApproved((p) => ({ ...p, [currentReviewId]: true }));
    onApproved();

    // Nothing left to review (this was the only video, or the last one in
    // the queue) -- show the "Approved" confirmation briefly so it's clear
    // it landed, then close on its own instead of leaving the admin
    // stranded on an already-approved video with no next step.
    if (reviewIndex >= readyQuestionIds.length - 1) {
      setTimeout(onClose, 700);
      return;
    }
    setReviewIndex((i) => i + 1);
  };

  const regenerateCurrent = async () => {
    if (!currentReviewId) return;
    await generateOne(currentReviewId);
  };

  if (mode === "reviewing") {
    return (
      <Modal overlayClassName="bg-black/95 backdrop-blur-md" zIndexClassName="z-modal" onOverlayClick={handleCloseAttempt}>
        <div className="relative flex flex-col items-center w-full" style={{ maxWidth: "95vw" }}>
          <button
            onClick={handleCloseAttempt}
            className="absolute -top-12 right-2 sm:top-2 sm:right-2 z-30 w-9 h-9 flex items-center justify-center bg-black/60 hover:bg-black/80 rounded-full text-white cursor-pointer border border-white/20 shadow-lg"
            title="Close"
          >
            <X size={18} />
          </button>

          {!currentReviewQuestion || !currentReviewResult ? (
            <div className="p-8 text-center bg-surface rounded-2xl border border-border-light max-w-sm">
              <p className="text-sm text-text-main font-semibold">No generated videos to review.</p>
            </div>
          ) : (
            <>
              {/* Shows the actual script the video was generated from (what
                  it displays AND speaks), not question_text -- they can
                  differ once edited, and this should match what's really in
                  the video, not the original prompt. */}
              <p className="text-white text-sm font-semibold text-center px-4 mb-2 max-w-md">
                {drafts[currentReviewId] || currentReviewQuestion.question_text}
              </p>
              <div
                className="relative rounded-2xl overflow-hidden bg-black shadow-2xl border border-white/10 flex items-center justify-center"
                style={{ aspectRatio: "9 / 16", height: "min(70vh, 680px)", maxWidth: "95vw" }}
              >
                <video
                  key={currentReviewResult.videoUrl}
                  src={currentReviewResult.videoUrl}
                  controls
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover bg-black"
                />
                {approved[currentReviewId] && (
                  <div className="absolute top-3 right-3 bg-success/90 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                    <Check size={12} /> Approved
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 mt-4 flex-wrap justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReviewIndex((i) => Math.max(0, i - 1))}
                  disabled={reviewIndex === 0}
                  className="gap-1.5"
                >
                  <ChevronLeft size={14} /> Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={regenerateCurrent}
                  disabled={status[currentReviewId] === "generating"}
                  className="gap-1.5"
                >
                  {status[currentReviewId] === "generating" ? (
                    <Spinner size="sm" />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                  Regenerate
                </Button>
                <Button onClick={approveCurrent} size="sm" className="gap-1.5 bg-success hover:bg-success/85 text-white">
                  <Check size={14} /> Approve & Attach
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReviewIndex((i) => Math.min(readyQuestionIds.length - 1, i + 1))}
                  disabled={reviewIndex >= readyQuestionIds.length - 1}
                  className="gap-1.5"
                >
                  Next <ChevronRight size={14} />
                </Button>
              </div>
              <p className="text-white/50 text-xs text-center mt-3">
                Video {reviewIndex + 1} of {readyQuestionIds.length}
              </p>
            </>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal onOverlayClick={handleCloseAttempt}>
      <Card padding="md" className="w-full max-w-2xl max-h-[85vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-text-main flex items-center gap-2">
            <Video size={16} className="text-primary" /> Generate Question Videos
          </h3>
          <Button size="sm" variant="ghost" onClick={handleCloseAttempt}>
            <X size={16} />
          </Button>
        </div>
        <p className="text-xs text-text-muted">
          Edit each question's video script below before generating — this is exactly what the video will both show
          on screen and speak aloud (already pre-filled with the options spelled out for ranking/choice questions).
        </p>

        <div className="space-y-3">
          {questions.map((q, idx) => (
            <div key={q.id} className="p-3 bg-surface/40 rounded-xl border border-border-light/30 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-bold text-text-secondary flex-1">
                  {idx + 1}. {q.question_text}
                </p>
                {status[q.id] === "ready" && approved[q.id] && <Badge tone="emerald">Approved</Badge>}
                {status[q.id] === "ready" && !approved[q.id] && <Badge tone="amber">Generated — not approved yet</Badge>}
                {status[q.id] === "generating" && <Badge tone="amber">Generating…</Badge>}
                {status[q.id] === "error" && <Badge tone="rose">Failed</Badge>}
              </div>
              <Textarea
                value={drafts[q.id] || ""}
                onChange={(e) => setDrafts((p) => ({ ...p, [q.id]: e.target.value }))}
                rows={2}
                className="text-xs"
                placeholder="Spoken script for this question's video..."
              />
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => generateOne(q.id)}
                  disabled={status[q.id] === "generating" || generatingAll}
                  className="text-xs gap-1.5"
                >
                  {status[q.id] === "generating" ? <Spinner size="sm" /> : <Wand2 size={13} />}
                  {status[q.id] === "ready" ? "Regenerate" : "Generate"}
                </Button>
                {/* Reachable right here, not just via the global "Review &
                    Approve" button below — the whole point is nothing should
                    require remembering a separate step to actually stick. */}
                {status[q.id] === "ready" && !approved[q.id] && (
                  <Button size="sm" onClick={() => startReviewFor(q.id)} className="text-xs gap-1.5 bg-success hover:bg-success/85 text-white">
                    <Check size={13} /> Review & Approve This One
                  </Button>
                )}
                {errors[q.id] && (
                  <span className="text-[11px] text-danger flex items-center gap-1">
                    <AlertCircle size={12} /> {errors[q.id]}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-border-light/30">
          <Button onClick={generateAll} disabled={generatingAll} className="gap-1.5">
            {generatingAll ? <Spinner size="sm" /> : <Wand2 size={14} />}
            {generatingAll ? "Generating All…" : "Generate All"}
          </Button>
          <Button
            variant="outline"
            onClick={startReview}
            disabled={readyQuestionIds.length === 0}
            className="gap-1.5"
          >
            Review {unapprovedReadyCount > 0 ? `(${unapprovedReadyCount})` : ""} & Approve
          </Button>
        </div>
        {unapprovedReadyCount > 0 && (
          <p className="text-[11px] text-warning-light font-semibold">
            {unapprovedReadyCount} generated video{unapprovedReadyCount > 1 ? "s" : ""} not yet approved — nothing is
            attached to a question until you approve it in review.
          </p>
        )}
        <p className="text-[11px] text-text-muted">
          Videos generate locally on this machine and take roughly 15–60s each depending on script length — this only
          works from <code>next dev</code>, not in production.
        </p>
      </Card>
    </Modal>
  );
}
