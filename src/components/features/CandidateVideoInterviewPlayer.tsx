"use client";

import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Modal from "@/components/primitives/Modal";
import { Spinner } from "@/components/primitives";
import { X, RotateCcw, CheckCircle2, Mic } from "lucide-react";

const VideoRecorder = dynamic(() => import("./VideoRecorder"), {
  ssr: false,
  loading: () => <Spinner />,
});

interface InterviewQuestion {
  id: string;
  question_text: string;
  question_video_url?: string | null;
  max_answer_seconds?: number | null;
}

type Stage = "intro" | "watch" | "record" | "transition" | "complete";

// Reels-style, one-question-at-a-time video interview -- built to feel like
// an actual interviewer walking the candidate through it, not a raw
// record/upload utility: a welcome beat before the first question, a short
// acknowledgment between each answer and the next question ("Thanks — next
// question"), and a real sign-off at the end, instead of silently cutting
// from one question straight to the next.
//
// Answers save through the same path the written tab uses (onAnswerSaved ->
// persistAnswer + upsert_answer_pitch_post in the parent) the instant each
// one is submitted, so leaving mid-interview never loses anything --
// resuming starts at the first still-unanswered question, not question 1.
export default function CandidateVideoInterviewPlayer({
  questions,
  answeredVideoUrls,
  onAnswerSaved,
  onClose,
}: {
  questions: InterviewQuestion[];
  answeredVideoUrls: Record<string, string | null | undefined>;
  onAnswerSaved: (questionId: string, videoUrl: string) => Promise<void>;
  onClose: () => void;
}) {
  const firstUnanswered = questions.findIndex((q) => !answeredVideoUrls[q.id]);
  const resumeIndex = firstUnanswered === -1 ? 0 : firstUnanswered;
  const isResuming = firstUnanswered > 0;

  const [index, setIndex] = useState(resumeIndex);
  // Skip the welcome beat when resuming partway through -- it already
  // happened the first time; jump straight to where they left off. Also
  // skip it if there's nothing to answer at all (shouldn't happen, but a
  // clean fallback beats a stuck intro screen).
  const [stage, setStage] = useState<Stage>(isResuming || questions.length === 0 ? "watch" : "intro");
  const [saving, setSaving] = useState(false);
  const questionVideoRef = useRef<HTMLVideoElement | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = questions[index];
  const isComplete = stage === "complete" || index >= questions.length;
  const alreadyAnswered = current ? Boolean(answeredVideoUrls[current.id]) : false;

  useEffect(() => {
    if (stage !== "watch") return;
    if (questionVideoRef.current) {
      questionVideoRef.current.currentTime = 0;
      questionVideoRef.current.play().catch(() => {});
    }
  }, [index, stage]);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, []);

  const replay = () => {
    if (questionVideoRef.current) {
      questionVideoRef.current.currentTime = 0;
      questionVideoRef.current.play().catch(() => {});
    }
  };

  const beginInterview = () => setStage("watch");

  const goNext = () => {
    const nextIndex = index + 1;
    if (nextIndex >= questions.length) {
      setStage("complete");
      return;
    }
    setIndex(nextIndex);
    setStage("watch");
  };

  const goPrev = () => {
    if (index === 0) return;
    setIndex((i) => i - 1);
    setStage("watch");
  };

  const skip = () => goNext();

  const handleAnswered = async (videoUrl: string) => {
    if (!current) return;
    setSaving(true);
    await onAnswerSaved(current.id, videoUrl);
    setSaving(false);
    // A brief "thanks, moving on" beat instead of an instant cut to the next
    // question -- the acknowledgment a real interviewer gives before moving
    // on, not just a raw state change.
    setStage("transition");
    transitionTimerRef.current = setTimeout(goNext, 1400);
  };

  return (
    <Modal overlayClassName="bg-black/95 backdrop-blur-md" zIndexClassName="z-modal" onOverlayClick={onClose}>
      <div className="relative flex flex-col items-center w-full" style={{ maxWidth: "95vw" }}>
        <button
          onClick={onClose}
          className="absolute -top-12 right-2 sm:top-2 sm:right-2 z-30 w-9 h-9 flex items-center justify-center bg-black/60 hover:bg-black/80 rounded-full text-white cursor-pointer border border-white/20 shadow-lg"
          title="Close"
        >
          <X size={18} />
        </button>

        {stage === "watch" && !isComplete && (
          <>
            <div className="flex gap-1 mb-2" style={{ width: "min(75vh * 9 / 16, 95vw)" }}>
              {questions.map((q, i) => (
                <div
                  key={q.id}
                  className={`h-0.5 flex-1 rounded-full ${
                    i < index || (i === index && answeredVideoUrls[q.id]) ? "bg-white" : i === index ? "bg-white/60" : "bg-white/25"
                  }`}
                />
              ))}
            </div>
            <p className="text-white text-sm font-semibold text-center px-4 mb-2 max-w-md">
              {current.question_text}
            </p>
          </>
        )}

        <div
          className={`relative rounded-2xl bg-black shadow-2xl border border-white/10 flex items-center justify-center ${
            // Every other stage is pure video playback and stays hard-clipped
            // to the 9:16 frame. The record stage hosts VideoRecorder's own
            // card (camera preview + Camera/Select File/Stop buttons), which
            // wasn't built to fit inside a fixed-height box -- clipping it
            // with overflow-hidden could crop its buttons out of the
            // tappable area on shorter/real-device viewports without any
            // visible sign why a tap does nothing. Scroll instead of clip so
            // every control stays reachable.
            stage === "record" ? "overflow-y-auto" : "overflow-hidden"
          }`}
          style={{ aspectRatio: "9 / 16", height: "min(75vh, 720px)", maxWidth: "95vw" }}
        >
          {stage === "intro" ? (
            <div className="text-center p-8 space-y-4">
              <Mic size={36} className="text-primary mx-auto" />
              <p className="text-white font-bold text-lg">Your Video Interview</p>
              <p className="text-white/70 text-sm leading-relaxed">
                I'll ask you {questions.length} question{questions.length !== 1 ? "s" : ""}, one at a time. Watch
                each one, then record or upload your answer whenever you're ready — take your time, and you can
                replay a question if you need to.
              </p>
              <button
                onClick={beginInterview}
                className="mt-2 px-6 py-3 bg-primary text-text-on-primary rounded-full text-sm font-bold cursor-pointer shadow-lg"
              >
                Start Interview
              </button>
            </div>
          ) : isComplete ? (
            <div className="text-center p-8 space-y-3">
              <CheckCircle2 size={40} className="text-success mx-auto" />
              <p className="text-white font-bold">Thanks — that's the interview!</p>
              <p className="text-white/60 text-xs">
                You answered {questions.filter((q) => answeredVideoUrls[q.id]).length} of {questions.length}{" "}
                questions. You can come back and finish the rest anytime.
              </p>
              <button
                onClick={onClose}
                className="mt-2 px-4 py-2 bg-white text-black rounded-full text-xs font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          ) : stage === "transition" ? (
            <div className="text-center p-8 space-y-2">
              <CheckCircle2 size={28} className="text-success mx-auto" />
              <p className="text-white/80 text-sm font-semibold">Got it, thanks!</p>
              <p className="text-white/50 text-xs">Next question…</p>
            </div>
          ) : stage === "watch" ? (
            <>
              {current.question_video_url ? (
                <video
                  ref={questionVideoRef}
                  key={current.id}
                  src={current.question_video_url}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover bg-black"
                />
              ) : (
                <div className="text-white/60 text-xs text-center p-6">
                  No video for this question — read it above, then record your answer whenever you're ready.
                </div>
              )}

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent pt-10 pb-4 px-4 flex flex-col items-center gap-3">
                {alreadyAnswered && (
                  <p className="text-white/70 text-[11px] flex items-center gap-1">
                    <CheckCircle2 size={12} className="text-success" /> Already answered — recording again replaces it
                  </p>
                )}
                <div className="flex items-center gap-3">
                  {current.question_video_url && (
                    <button
                      onClick={replay}
                      className="w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white cursor-pointer"
                      title="Replay question"
                    >
                      <RotateCcw size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => setStage("record")}
                    className="px-6 py-3 rounded-full bg-primary text-text-on-primary font-bold text-sm cursor-pointer shadow-lg"
                  >
                    {alreadyAnswered ? "Re-record Answer" : "Record or Upload Answer"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="w-full min-h-full flex flex-col items-center justify-center gap-3 p-4">
              {saving ? (
                <Spinner />
              ) : (
                <VideoRecorder
                  maxDuration={current.max_answer_seconds || 30}
                  onVideoUploaded={handleAnswered}
                />
              )}
              <button onClick={() => setStage("watch")} className="text-white/60 text-xs underline cursor-pointer">
                Back to question
              </button>
            </div>
          )}
        </div>

        {stage === "watch" && !isComplete && (
          <div className="flex items-center gap-4 mt-3">
            <button
              onClick={goPrev}
              disabled={index === 0}
              className="text-white/70 text-xs font-semibold disabled:opacity-30 cursor-pointer disabled:cursor-default"
            >
              ← Previous
            </button>
            <span className="text-white/50 text-xs">
              Question {index + 1} of {questions.length}
            </span>
            <button
              onClick={skip}
              disabled={index >= questions.length - 1}
              className="text-white/70 text-xs font-semibold disabled:opacity-30 cursor-pointer disabled:cursor-default"
            >
              Skip →
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
