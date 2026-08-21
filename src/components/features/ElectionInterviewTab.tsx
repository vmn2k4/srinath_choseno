"use client";

import React, { useEffect, useState } from "react";
import { Card, Spinner, EmptyState } from "@/components/primitives";
import { getElectionQuestions } from "@/lib/services/elections";
import { createClient } from "@/lib/supabase/client";
import QuestionAnswerCarousel from "./QuestionAnswerCarousel";
import { Video, MessageSquare } from "lucide-react";

interface Question {
  id: string;
  question_text: string;
  visible_to_public: boolean;
  allow_video: boolean;
  question_video_url: string | null;
  rank: number;
}

// "Candidate Interview" tab on the seat page (elections/seat/[seatId]) —
// sibling to the existing "Community Support" tab, per
// docs/VIRTUAL_INTERVIEW_SYSTEM.md's Gap 3 UI mapping. Lists every public
// question for this seat's election; clicking one opens
// QuestionAnswerCarousel scoped to that question, swiping through every
// candidate's answer to it.
export default function ElectionInterviewTab({ electionId }: { electionId: string }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [openQuestion, setOpenQuestion] = useState<Question | null>(null);

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
      {questions.map((q, idx) => (
        <Card
          key={q.id}
          padding="md"
          className="cursor-pointer hover:border-primary/40 transition-all flex items-center gap-3"
          onClick={() => setOpenQuestion(q)}
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

      {openQuestion && (
        <QuestionAnswerCarousel
          questionId={openQuestion.id}
          questionText={openQuestion.question_text}
          questionVideoUrl={openQuestion.question_video_url}
          onClose={() => setOpenQuestion(null)}
        />
      )}
    </div>
  );
}
