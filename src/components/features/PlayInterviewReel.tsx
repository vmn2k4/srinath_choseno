"use client";

import React, { useEffect, useRef, useState } from "react";
import Modal from "@/components/primitives/Modal";
import { Spinner } from "@/components/primitives";
import { normalizeMediaUrl } from "@/lib/services/video";
import { getCandidateVideoAnswersForReel } from "@/lib/services/elections";
import { createClient } from "@/lib/supabase/client";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface ReelAnswer {
  id: string;
  video_url: string;
  election_questions: { id: string; question_text: string; rank: number };
}

// Sequenced "play all" reel: one candidate's video answers, back to back, in
// question-rank order, full-screen and closeable, strictly 9:16. Same shell
// as QuestionAnswerCarousel (and StoryViewerModal) — this is the other of
// the two entry points into "play entire interview" described in
// docs/VIRTUAL_INTERVIEW_SYSTEM.md (the seat-page candidate strip and the
// candidate's own CandidacyWall both open this same component).
export default function PlayInterviewReel({
  candidateId,
  candidateName,
  onClose,
}: {
  candidateId: string;
  candidateName: string;
  onClose: () => void;
}) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<ReelAnswer[]>([]);
  const [index, setIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCandidateVideoAnswersForReel(supabase, candidateId).then(({ data }) => {
      if (cancelled) return;
      setAnswers((data as unknown as ReelAnswer[]) || []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [candidateId, supabase]);

  const current = answers[index];

  const goNext = () => setIndex((i) => Math.min(answers.length - 1, i + 1));
  const goPrev = () => setIndex((i) => Math.max(0, i - 1));

  // Auto-advance to the next answer when one finishes, so it plays as one
  // continuous reel instead of requiring a click after every clip.
  const handleEnded = () => {
    if (index < answers.length - 1) goNext();
  };

  return (
    <Modal overlayClassName="bg-black/95 backdrop-blur-md" zIndexClassName="z-modal" onOverlayClick={onClose}>
      <div className="relative flex flex-col items-center w-full" style={{ maxWidth: "95vw" }}>
        <button
          onClick={onClose}
          className="absolute -top-12 right-2 sm:top-2 sm:right-2 z-30 w-9 h-9 flex items-center justify-center bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors cursor-pointer border border-white/20 shadow-lg"
          title="Close"
        >
          <X size={18} />
        </button>

        <p className="text-white text-sm font-semibold text-center px-4 mb-2">{candidateName}'s Interview</p>

        {loading ? (
          <div className="w-full flex justify-center py-16">
            <Spinner />
          </div>
        ) : answers.length === 0 ? (
          <div className="p-8 text-center bg-surface rounded-2xl border border-border-light max-w-sm">
            <p className="text-sm text-text-main font-semibold">No video answers yet.</p>
          </div>
        ) : (
          <div className="relative">
            <div
              className="relative rounded-2xl overflow-hidden bg-black shadow-2xl border border-white/10 flex items-center justify-center"
              style={{ aspectRatio: "9 / 16", height: "min(75vh, 720px)", maxWidth: "95vw" }}
            >
              <video
                ref={videoRef}
                key={current.id}
                src={normalizeMediaUrl(current.video_url)}
                controls
                autoPlay
                playsInline
                onEnded={handleEnded}
                className="w-full h-full object-cover bg-black"
              />

              {/* Question caption, same idea as VIRTUAL_INTERVIEW_SYSTEM.md's
                  "play all" description — question text overlaid while its
                  answer plays. */}
              <div className="absolute top-3 inset-x-3 bg-black/50 rounded-xl px-3 py-2">
                <p className="text-white text-xs font-medium line-clamp-2">{current.election_questions?.question_text}</p>
              </div>

              {/* Progress dots */}
              <div className="absolute top-1.5 inset-x-3 flex gap-1">
                {answers.map((a, i) => (
                  <div key={a.id} className={`h-0.5 flex-1 rounded-full ${i <= index ? "bg-white" : "bg-white/25"}`} />
                ))}
              </div>

              {index > 0 && (
                <button
                  onClick={goPrev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white cursor-pointer"
                  title="Previous question"
                >
                  <ChevronLeft size={18} />
                </button>
              )}
              {index < answers.length - 1 && (
                <button
                  onClick={goNext}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white cursor-pointer"
                  title="Next question"
                >
                  <ChevronRight size={18} />
                </button>
              )}
            </div>

            <p className="text-white/50 text-xs text-center mt-2">
              Question {index + 1} of {answers.length}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
