"use client";

import React, { useEffect, useState } from "react";
import { Card, Spinner, EmptyState, Avatar } from "@/components/primitives";
import { getElectionQuestions } from "@/lib/services/elections";
import { createClient } from "@/lib/supabase/client";
import QuestionAnswerCarousel from "./QuestionAnswerCarousel";
import PlayInterviewReel from "./PlayInterviewReel";
import { Video, MessageSquare, PlayCircle } from "lucide-react";

interface Question {
  id: string;
  question_text: string;
  visible_to_public: boolean;
  allow_video: boolean;
  question_video_url: string | null;
  rank: number;
}

interface InterviewCandidate {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

// "Candidate Interview" tab on the seat page (elections/seat/[seatId]) —
// sibling to the existing "Community Support" tab, per
// docs/VIRTUAL_INTERVIEW_SYSTEM.md's Gap 3 UI mapping. Two ways into the same
// underlying video-answer data, side by side: the candidate strip up top
// plays one candidate's whole interview start to finish (PlayInterviewReel,
// question then answer, every question in order); the question list below
// swipes across every candidate's answer to one question at a time
// (QuestionAnswerCarousel). Same "play all" vs "per question, everyone's
// answer" split docs/VIRTUAL_INTERVIEW_SYSTEM.md describes -- this tab is
// where a viewer chooses which of the two they want.
export default function ElectionInterviewTab({
  electionId,
  candidates,
}: {
  electionId: string;
  candidates?: InterviewCandidate[];
}) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  // Index into `questions` rather than the Question object itself, so
  // QuestionAnswerCarousel's onNextQuestion/onPrevQuestion can move to the
  // adjacent one without the caller needing to look anything up.
  const [openQuestionIndex, setOpenQuestionIndex] = useState<number | null>(null);
  const [reelCandidate, setReelCandidate] = useState<InterviewCandidate | null>(null);
  const openQuestion = openQuestionIndex != null ? questions[openQuestionIndex] : null;

  useEffect(() => {
    let cancelled = false;
    getElectionQuestions(supabase, electionId).then(({ data }) => {
      if (cancelled) return;
      const visible = ((data as unknown as Question[]) || [])
        .filter((q) => q.visible_to_public && q.allow_video)
        .sort((a, b) => a.rank - b.rank);
      setQuestions(visible);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [electionId, supabase]);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No Interview Questions Yet"
        description="This election doesn't have any video-answerable questions configured yet."
      />
    );
  }

  return (
    <div className="space-y-3">
      {candidates && candidates.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-text-muted uppercase tracking-widest">
            Watch a Candidate's Complete Interview
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {candidates.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setReelCandidate(c)}
                className="flex items-center gap-2 pl-2 pr-3 py-2 rounded-full border border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all shrink-0 cursor-pointer"
                title={`Play ${c.name}'s complete interview`}
              >
                <Avatar src={c.avatarUrl} name={c.name} size="sm" />
                <span className="text-xs font-semibold text-text-main whitespace-nowrap">{c.name}</span>
                <PlayCircle size={16} className="text-primary shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs font-bold text-text-muted uppercase tracking-widest pt-1">
        Compare Answers Question by Question
      </p>

      {questions.map((q, idx) => (
        <Card
          key={q.id}
          padding="md"
          className="cursor-pointer hover:border-primary/40 transition-all flex items-center gap-3"
          onClick={() => setOpenQuestionIndex(idx)}
        >
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary-light text-sm font-bold shrink-0">
            {idx + 1}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-main">{q.question_text}</p>
            <p className="text-xs text-text-muted mt-0.5">Tap to watch every candidate's answer</p>
          </div>
          <Video size={18} className="text-primary shrink-0" />

        </Card>
      ))}

      {openQuestion && openQuestionIndex != null && (
        <QuestionAnswerCarousel
          key={openQuestion.id}
          questionId={openQuestion.id}
          questionText={openQuestion.question_text}
          questionVideoUrl={openQuestion.question_video_url}
          onClose={() => setOpenQuestionIndex(null)}
          onPrevQuestion={openQuestionIndex > 0 ? () => setOpenQuestionIndex((i) => (i ?? 0) - 1) : undefined}
          onNextQuestion={
            openQuestionIndex < questions.length - 1
              ? () => setOpenQuestionIndex((i) => (i ?? 0) + 1)
              : undefined
          }
        />
      )}

      {reelCandidate && (
        <PlayInterviewReel
          candidateId={reelCandidate.id}
          candidateName={reelCandidate.name}
          onClose={() => setReelCandidate(null)}
        />
      )}
    </div>
  );
}
