"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "@/contexts/AuthContext";
import {
  getCandidateById,
  getElectionQuestions,
  getCandidateAnswers,
  updateCandidateStatement,
  upsertCandidateAnswer,
  setCandidateAnswerOptions,
  setCandidateAnswerRanking,
  updateCandidateIntroVideoUrl,
  submitCandidateApplication,
  upsertAnswerPitchPost,
} from "@/lib/services/elections";
import { ArrowLeft, Send, Video, RefreshCw, ChevronUp, ChevronDown, CheckCircle2 } from "lucide-react";
import {
  Card,
  Button,
  Badge,
  Textarea,
  Spinner,
  Modal,
} from "@/components/primitives";
import RatingScale from "@/components/features/RatingScale";
import { createClient } from "@/lib/supabase/client";

// Only rendered once a candidate opts into recording a video answer, so
// it's pulled out of this page's initial JS bundle and fetched on demand.
const VideoRecorder = dynamic(() => import("@/components/features/VideoRecorder"), {
  ssr: false,
  loading: () => <Spinner />,
});

// The full-screen, one-question-at-a-time reels-style interview flow --
// pulled out of the initial bundle the same way VideoRecorder is, since
// it's only needed once the candidate opens the video interview.
const CandidateVideoInterviewPlayer = dynamic(
  () => import("@/components/features/CandidateVideoInterviewPlayer"),
  { ssr: false, loading: () => <Spinner fullPage /> }
);

// Submission auto-approves (submit_candidate_application flips status
// straight to 'approved') -- 'pending' never means "waiting on an admin", it
// only ever means "still a draft, not submitted yet". See isDraft below,
// which is what the badge actually keys off.
const STATUS_COPY: Record<string, { label: string; tone: "amber" | "emerald" | "rose" }> = {
  draft: { label: "Not Submitted", tone: "amber" },
  pending: { label: "Pending Review", tone: "amber" },
  approved: { label: "Approved", tone: "emerald" },
  rejected: { label: "Not Approved", tone: "rose" },
};

function hasStartedAnswering(question: any, answer: any) {
  if (!answer) return false;
  switch (question.question_type) {
    case "multiple_choice":
      return (answer.optionIds || []).length > 0;
    case "text":
      return !!answer.textAnswer?.trim();
    case "rating":
      return answer.ratingValue != null;
    case "ranking":
      return (answer.rankedOptionIds || []).length > 0;
    default:
      return !!answer.optionId;
  }
}

type QuestionOption = { id: string; option_text: string; rank: number };

// A "ranking" answer always has a full order once the question is shown
// (defaults to the admin's option order until the candidate reorders it),
// so this reads the working order rather than requiring rankedOptionIds to
// already be populated in state.
function getRankedOptions(
  question: { election_question_options?: QuestionOption[] },
  answer?: { rankedOptionIds?: string[] }
): QuestionOption[] {
  const options = question.election_question_options || [];
  const order = answer?.rankedOptionIds?.length ? answer.rankedOptionIds : options.map((o) => o.id);
  return order
    .map((id) => options.find((o) => o.id === id))
    .filter((o): o is QuestionOption => Boolean(o));
}

interface CandidateApplicationClientProps {
  candidateId: string;
}

export default function CandidateApplicationClient({
  candidateId,
}: CandidateApplicationClientProps) {
  const supabase = createClient();
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [candidate, setCandidate] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [statement, setStatement] = useState("");
  const [introVideoUrl, setIntroVideoUrl] = useState<string | null>(null);
  const [showIntroRecorder, setShowIntroRecorder] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [submitResultStatus, setSubmitResultStatus] = useState<"approved" | "rejected" | null>(null);
  const [draggedItem, setDraggedItem] = useState<{ questionId: string; optionId: string } | null>(null);
  const [highlightedQuestionId, setHighlightedQuestionId] = useState<string | null>(null);
  // null = haven't been through the "choose your questions" screen yet this
  // session. Required questions are always included regardless of what's
  // toggled here -- selection only affects which OPTIONAL questions show in
  // the answering flow below, submission still needs every required one
  // answered (submit_candidate_application enforces that server-side
  // either way, this is just about what's shown, not a validation bypass).
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string> | null>(null);
  const [pendingSelection, setPendingSelection] = useState<Set<string>>(new Set());
  // Video Interview (watch the question, answer by recording/uploading) vs
  // Written Questionnaire (the original text/choice/rating/ranking form,
  // with no question video and no video-recording UI at all) -- two
  // distinct modes over the same question set + answers, not two different
  // question lists. A question only appears in the video tab when the admin
  // marked it allow_video; the written tab always shows every question,
  // exactly like the form worked before video answers existed.
  const [activeQuestionTab, setActiveQuestionTab] = useState<"video" | "written">("video");
  const [showVideoInterviewPlayer, setShowVideoInterviewPlayer] = useState(false);

  const fetchAll = async () => {
    if (!user || !candidateId) return;
    setLoading(true);

    const { data: c } = await getCandidateById(supabase, candidateId);

    if (!c || c.politician_id !== user.id) {
      setCandidate(null);
      setLoading(false);
      return;
    }

    setCandidate(c);
    setStatement(c.statement || "");
    setIntroVideoUrl(c.intro_video_url || null);

    const electionId = c.election_seats?.elections?.id;
    if (electionId) {
      const { data: qs } = await getElectionQuestions(supabase, electionId);
      setQuestions(
        (qs || []).map((q: any) => ({
          ...q,
          election_question_options: [
            ...(q.election_question_options || []),
          ].sort((a, b) => a.rank - b.rank),
        }))
      );

      const { data: existingAnswers } = await getCandidateAnswers(
        supabase,
        candidateId
      );
      const answerMap: Record<string, any> = {};
      (existingAnswers || []).forEach((a: any) => {
        const answerOptions = a.election_candidate_answer_options || [];
        answerMap[a.question_id] = {
          answerId: a.id,
          optionId: a.option_id,
          optionIds: answerOptions.map((o: any) => o.option_id),
          rankedOptionIds: [...answerOptions]
            .sort((x: any, y: any) => (x.rank ?? 0) - (y.rank ?? 0))
            .map((o: any) => o.option_id),
          textAnswer: a.text_answer,
          ratingValue: a.rating_value,
          context: a.context_text,
          videoUrl: a.video_url,
        };
      });

      // Initialize ranking answers: pre-populate all options in default order so they're counted as "started"
      for (const q of (qs || [])) {
        if (q.question_type === "ranking" && !answerMap[q.id]) {
          const defaultOrder = (q.election_question_options || []).map((o: any) => o.id);
          answerMap[q.id] = {
            rankedOptionIds: defaultOrder,
          };
        }
      }

      setAnswers(answerMap);
    }

    setLoading(false);
  };

  useEffect(() => {
    Promise.resolve().then(() => fetchAll());
  }, [user, candidateId]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveStatement = async () => {
    if (!candidateId) return;
    await updateCandidateStatement(supabase, candidateId, statement);
  };

  const findUnansweredRequiredQuestion = () => {
    const unanswered = [];
    for (const q of questions) {
      if (!q.required) continue;
      const ans = answers[q.id];
      if (!hasStartedAnswering(q, ans)) {
        unanswered.push({
          id: q.id,
          text: q.question_text,
          type: q.question_type,
          answer: ans,
        });
      }
    }
    if (unanswered.length > 0) {
      console.warn("Unanswered required questions:", unanswered);
      return unanswered[0].id;
    }
    return null;
  };

  const handleIntroVideoUploaded = async (url: string) => {
    setIntroVideoUrl(url);
    setShowIntroRecorder(false);
    await updateCandidateIntroVideoUrl(supabase, candidateId, url);
  };

  const persistAnswer = async (questionId: string, partial: Record<string, any>) => {
    const prev = answers[questionId] || {};
    const merged = { ...prev, ...partial };
    setAnswers((p) => ({ ...p, [questionId]: merged }));

    const question = questions.find((q) => q.id === questionId);
    const { data: answerRow, error } = await upsertCandidateAnswer(
      supabase,
      candidateId,
      questionId,
      {
        optionId: merged.optionId,
        textAnswer: merged.textAnswer,
        ratingValue: merged.ratingValue,
        contextText: merged.context,
        videoUrl: merged.videoUrl,
      }
    );

    const actualAnswerId = answerRow?.id || merged.answerId;
    if (!error && actualAnswerId && !merged.answerId) {
      setAnswers((p) => ({
        ...p,
        [questionId]: { ...p[questionId], answerId: actualAnswerId },
      }));
    }
    if (question?.question_type === "multiple_choice" && actualAnswerId) {
      await setCandidateAnswerOptions(supabase, actualAnswerId, merged.optionIds || []);
    }
    if (question?.question_type === "ranking" && actualAnswerId) {
      await setCandidateAnswerRanking(supabase, actualAnswerId, merged.rankedOptionIds || []);
    }
    return actualAnswerId;
  };

  // Initialize ranking answers on first load: ensure answer row exists with all options ranked
  const initializeRankingAnswers = async () => {
    for (const q of questions) {
      if (q.question_type === "ranking" && answers[q.id] && !answers[q.id].answerId) {
        const defaultOrder = (q.election_question_options || []).map((o: any) => o.id);
        await persistAnswer(q.id, { rankedOptionIds: defaultOrder });
      }
    }
  };

  useEffect(() => {
    if (questions.length > 0 && answers && Object.keys(answers).length > 0 && !loading) {
      initializeRankingAnswers();
    }
  }, [loading]);

  // Seed the question-picker: required questions start checked (and stay
  // locked -- see the selection screen below), optional ones start
  // unchecked. A question the candidate already has an answer for also
  // starts checked, so revisiting mid-application doesn't hide work already
  // in progress.
  useEffect(() => {
    if (questions.length === 0 || selectedQuestionIds !== null) return;
    setPendingSelection(
      new Set(questions.filter((q) => q.required || hasStartedAnswering(q, answers[q.id])).map((q) => q.id))
    );
  }, [questions, answers, selectedQuestionIds]);

  const selectOption = (questionId: string, optionId: string) =>
    persistAnswer(questionId, { optionId });

  const toggleMultiOption = (questionId: string, optionId: string) => {
    const current = answers[questionId]?.optionIds || [];
    const next = current.includes(optionId)
      ? current.filter((id: string) => id !== optionId)
      : [...current, optionId];
    persistAnswer(questionId, { optionIds: next });
  };

  const selectRating = (questionId: string, value: number) =>
    persistAnswer(questionId, { ratingValue: value });

  const moveRankedOption = (questionId: string, optionId: string, delta: number) => {
    const question = questions.find((q) => q.id === questionId);
    const current = getRankedOptions(question, answers[questionId]).map((o) => o.id);
    const idx = current.indexOf(optionId);
    const nextIdx = idx + delta;
    if (idx === -1 || nextIdx < 0 || nextIdx >= current.length) return;
    const next = [...current];
    [next[idx], next[nextIdx]] = [next[nextIdx], next[idx]];
    persistAnswer(questionId, { rankedOptionIds: next });
  };

  const handleRankingDragStart = (questionId: string, optionId: string) => {
    setDraggedItem({ questionId, optionId });
  };

  const handleRankingDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleRankingDrop = (questionId: string, targetOptionId: string) => {
    if (!draggedItem || draggedItem.questionId !== questionId) return;
    const { optionId: sourceOptionId } = draggedItem;
    if (sourceOptionId === targetOptionId) {
      setDraggedItem(null);
      return;
    }

    const question = questions.find((q) => q.id === questionId);
    const current = getRankedOptions(question, answers[questionId]).map((o) => o.id);
    const sourceIdx = current.indexOf(sourceOptionId);
    const targetIdx = current.indexOf(targetOptionId);

    if (sourceIdx === -1 || targetIdx === -1) {
      setDraggedItem(null);
      return;
    }

    const next = [...current];
    next.splice(sourceIdx, 1);
    next.splice(targetIdx, 0, sourceOptionId);
    persistAnswer(questionId, { rankedOptionIds: next });
    setDraggedItem(null);
  };

  const updateTextAnswer = (questionId: string, text: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...(prev[questionId] || {}), textAnswer: text },
    }));
  };

  const saveTextAnswer = (questionId: string) => persistAnswer(questionId, {});

  const updateContext = (questionId: string, text: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...(prev[questionId] || {}), context: text },
    }));
  };

  const saveContext = (questionId: string) => persistAnswer(questionId, {});

  const handleQuestionVideoUploaded = async (questionId: string, url: string) => {
    const answerId = await persistAnswer(questionId, { videoUrl: url });
    // Turns this video answer into a real wall post (create on first submit,
    // in-place video swap on retake) — see upsert_answer_pitch_post. Fire
    // after persistAnswer so the answer row's video_url is already saved;
    // errors here (e.g. transient network) shouldn't block the answer itself
    // from having saved, so this is best-effort and logged, not surfaced as
    // a blocking form error.
    if (answerId) {
      const { error } = await upsertAnswerPitchPost(supabase, answerId);
      if (error) console.error("Failed to publish video answer as a wall post:", error);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setStatusMessage("");

    // Debug: log all required questions and their answers
    const requiredQuestions = questions.filter((q) => q.required);
    console.log("Required questions:", requiredQuestions.map((q) => ({
      id: q.id,
      text: q.question_text,
      type: q.question_type,
      hasAnswer: !!answers[q.id],
      answer: answers[q.id],
    })));

    await saveStatement();

    const { data: result, error } = await submitCandidateApplication(
      supabase,
      candidateId
    );
    setSubmitting(false);

    if (error) {
      // RPC validation failed - show which required questions are missing
      if (error.message?.includes("Please answer all required questions")) {
        setStatusMessage("Error: Please answer all required questions before submitting");
        const unansweredId = findUnansweredRequiredQuestion();
        if (unansweredId) {
          setHighlightedQuestionId(unansweredId);
          setTimeout(() => {
            const el = document.getElementById(`question-${unansweredId}`);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            setTimeout(() => setHighlightedQuestionId(null), 2500);
          }, 100);
        }
      } else {
        setStatusMessage("Error: " + error.message);
      }
      return;
    }

    const resAny = result as any;
    if (resAny && resAny.success === false) {
      setStatusMessage(`Please complete required questions: ${resAny.message}`);
      const unansweredId = findUnansweredRequiredQuestion();
      if (unansweredId) {
        setHighlightedQuestionId(unansweredId);
        setTimeout(() => {
          const el = document.getElementById(`question-${unansweredId}`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          setTimeout(() => setHighlightedQuestionId(null), 2500);
        }, 100);
      }
      return;
    }

    // submit_candidate_application auto-approves on submit (no admin review
    // queue exists) unless this candidacy was previously rejected, in which
    // case it deliberately stays 'rejected' rather than silently reopening --
    // the dialog's wording below reflects whichever actually happened
    // instead of always claiming "for admin review".
    setSubmitResultStatus((resAny?.status as "approved" | "rejected") ?? "approved");
    await fetchAll();
  };

  if (loading) return <Spinner fullPage />;

  if (!candidate) {
    return (
      <div className="w-full max-w-none px-4 lg:px-8 mt-10">
        <Card padding="lg" className="text-center">
          <p className="text-text-muted text-sm">
            Candidacy record not found or you do not have permission to edit it.
          </p>
          <Button onClick={() => router.push("/politician/elections")} className="mt-4">
            Back to My Elections
          </Button>
        </Card>
      </div>
    );
  }

  const isDraft = candidate.status === "pending" && !candidate.submitted_at;
  const statusCfg = isDraft ? STATUS_COPY.draft : STATUS_COPY[candidate.status] || STATUS_COPY.pending;

  // "Choose your questions" gate -- shown once per session before the
  // answering flow. Required questions are pre-checked and can't be
  // unchecked (submission still needs them regardless of what's picked
  // here); optional ones are the candidate's choice. Skipped entirely once
  // questions is empty or already past this screen.
  if (selectedQuestionIds === null && questions.length > 0) {
    const toggle = (id: string, required: boolean) => {
      if (required) return;
      setPendingSelection((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    };
    return (
      <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 space-y-6">
        <Card padding="lg" className="max-w-2xl mx-auto space-y-4">
          <div>
            <h1 className="text-lg font-bold text-text-main">Choose Your Interview Questions</h1>
            <p className="text-sm text-text-muted mt-1">
              Required questions (marked below) must be answered. Pick which optional ones you'd also like to
              answer — you can always come back and add more later.
            </p>
          </div>
          <div className="space-y-2">
            {questions.map((q) => {
              const checked = q.required || pendingSelection.has(q.id);
              return (
                <label
                  key={q.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                    q.required
                      ? "border-primary/30 bg-primary/5 cursor-default"
                      : "border-border-light/30 hover:border-primary/30 cursor-pointer"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={q.required}
                    onChange={() => toggle(q.id, q.required)}
                    className="mt-0.5 shrink-0"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="text-sm text-text-main">{q.question_text}</span>
                    {q.required && (
                      <Badge tone="amber" className="ml-2 text-[10px]">
                        Required
                      </Badge>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
          <Button onClick={() => setSelectedQuestionIds(new Set(pendingSelection))} className="w-full">
            Continue to Interview
          </Button>
        </Card>
      </div>
    );
  }

  const visibleQuestions = selectedQuestionIds ? questions.filter((q) => selectedQuestionIds.has(q.id)) : questions;
  const videoQuestions = visibleQuestions.filter((q) => q.allow_video);
  const videoAnsweredCount = videoQuestions.filter((q) => answers[q.id]?.videoUrl).length;

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/politician/elections")}
            className="rounded-full"
          >
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-text-main">
              {candidate.election_seats?.role_title} Application
            </h1>
            <p className="text-xs text-text-muted">
              {candidate.election_seats?.elections?.name} ·{" "}
              {candidate.election_seats?.map_shapes?.name}
            </p>
          </div>
        </div>

        <Badge tone={statusCfg.tone}>{statusCfg.label}</Badge>
      </div>

      {/* Platform Statement */}
      <Card padding="md" className="space-y-3">
        <h3 className="text-sm font-bold text-text-main">
          Platform Statement / Opening Message
        </h3>
        <Textarea
          placeholder="Share your primary platform goals, vision, and reasons for running..."
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          onBlur={saveStatement}
          rows={4}
        />
      </Card>

      {/* Intro Campaign Video */}
      <Card padding="md" className="space-y-3">
        <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
          <Video size={18} className="text-primary" /> Introductory Campaign Video Pitch
        </h3>
        <p className="text-xs text-text-muted">
          Record a 30-90 second video pitch introducing yourself to constituents.
        </p>

        {introVideoUrl && !showIntroRecorder && (
          <div className="space-y-2">
            <video src={introVideoUrl} controls className="w-full max-h-72 rounded-xl bg-black" />
            <Button variant="outline" size="sm" onClick={() => setShowIntroRecorder(true)} className="gap-1.5 text-xs">
              <RefreshCw size={14} /> Re-record Intro Video
            </Button>
          </div>
        )}

        {showIntroRecorder && (
          <VideoRecorder maxDuration={90} onVideoUploaded={handleIntroVideoUploaded} />
        )}

        {!introVideoUrl && !showIntroRecorder && (
          <Button onClick={() => setShowIntroRecorder(true)} className="gap-2 text-xs">
            <Video size={16} /> Record Intro Video
          </Button>
        )}
      </Card>

      {/* Candidate Questionnaire */}
      {visibleQuestions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-sm font-bold text-text-muted uppercase tracking-wider">
              Official Election Questionnaire ({visibleQuestions.length} of {questions.length} Questions)
            </h2>
            {questions.length > visibleQuestions.length && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedQuestionIds(null)} className="text-xs">
                Add more questions
              </Button>
            )}
          </div>

          {/* Two modes over the same questions/answers, not two question
              lists -- see activeQuestionTab's own comment above. */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveQuestionTab("video")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all cursor-pointer ${
                activeQuestionTab === "video"
                  ? "border-primary bg-primary/10 text-primary-light"
                  : "border-border-light bg-surface-hover/40 text-text-secondary hover:border-primary/40"
              }`}
            >
              <Video size={14} /> Video Interview
            </button>
            <button
              type="button"
              onClick={() => setActiveQuestionTab("written")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all cursor-pointer ${
                activeQuestionTab === "written"
                  ? "border-primary bg-primary/10 text-primary-light"
                  : "border-border-light bg-surface-hover/40 text-text-secondary hover:border-primary/40"
              }`}
            >
              Written Questionnaire
            </button>
          </div>

          {activeQuestionTab === "video" &&
            (videoQuestions.length === 0 ? (
              <Card padding="md" className="text-center text-xs text-text-muted">
                No questions in this interview accept a video answer.
              </Card>
            ) : (
              <Card padding="md" className="space-y-4 text-center">
                <div className="space-y-1">
                  <h3 className="font-bold text-text-main text-sm">
                    {videoAnsweredCount === videoQuestions.length
                      ? "Video interview complete"
                      : videoAnsweredCount > 0
                        ? "Continue your video interview"
                        : "Start your video interview"}
                  </h3>
                  <p className="text-xs text-text-muted">
                    {videoAnsweredCount} of {videoQuestions.length} questions answered on video
                    {videoAnsweredCount > 0 && videoAnsweredCount < videoQuestions.length
                      ? " — pick up right where you left off."
                      : "."}
                  </p>
                </div>
                <Button size="sm" onClick={() => setShowVideoInterviewPlayer(true)} className="gap-1.5 text-xs">
                  <Video size={14} />
                  {videoAnsweredCount === 0
                    ? "Start Video Interview"
                    : videoAnsweredCount === videoQuestions.length
                      ? "Review or Re-record Answers"
                      : "Continue Video Interview"}
                </Button>
              </Card>
            ))}

          {showVideoInterviewPlayer && (
            <CandidateVideoInterviewPlayer
              questions={videoQuestions}
              answeredVideoUrls={Object.fromEntries(
                videoQuestions.map((q) => [q.id, answers[q.id]?.videoUrl])
              )}
              onAnswerSaved={handleQuestionVideoUploaded}
              onClose={() => setShowVideoInterviewPlayer(false)}
            />
          )}

          {activeQuestionTab === "written" &&
            visibleQuestions.map((q) => {
              const ans = answers[q.id] || {};
              const started = hasStartedAnswering(q, ans);

              return (
                <Card
                  key={q.id}
                  id={`question-${q.id}`}
                  padding="md"
                  className={`space-y-4 transition-all ${
                    highlightedQuestionId === q.id
                      ? "!ring-2 !ring-red-500 !ring-offset-2 animate-pulse !bg-red-50"
                      : ""
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-text-main text-sm">
                        {q.question_text}
                      </h3>
                      {q.required && <Badge tone="rose">Required</Badge>}
                    </div>
                    {q.description && (
                      <p className="text-xs text-text-muted mt-1">{q.description}</p>
                    )}
                  </div>

                  {/* Single Choice / Yes-No */}
                  {(q.question_type === "single_choice" ||
                    q.question_type === "yes_no") && (
                    <div className="flex flex-wrap gap-2">
                      {q.election_question_options.map((opt: any) => (
                        <button
                          key={opt.id}
                          onClick={() => selectOption(q.id, opt.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            ans.optionId === opt.id
                              ? "bg-primary text-text-on-primary border-primary shadow-sm"
                              : "bg-surface-elevated text-text-secondary border-border-light/40 hover:border-primary/40"
                          }`}
                        >
                          {opt.option_text}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Multiple Choice */}
                  {q.question_type === "multiple_choice" && (
                    <div className="flex flex-wrap gap-2">
                      {q.election_question_options.map((opt: any) => {
                        const selected = (ans.optionIds || []).includes(opt.id);
                        return (
                          <button
                            key={opt.id}
                            onClick={() => toggleMultiOption(q.id, opt.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                              selected
                                ? "bg-primary text-text-on-primary border-primary shadow-sm"
                                : "bg-surface-elevated text-text-secondary border-border-light/40 hover:border-primary/40"
                            }`}
                          >
                            {opt.option_text}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Priority Ranking */}
                  {q.question_type === "ranking" && (
                    <div className="space-y-2">
                      <div className="space-y-1.5">
                        {getRankedOptions(q, ans).map((opt, idx, arr) => (
                          <div
                            key={opt.id}
                            draggable
                            onDragStart={() => handleRankingDragStart(q.id, opt.id)}
                            onDragOver={handleRankingDragOver}
                            onDrop={() => handleRankingDrop(q.id, opt.id)}
                            onDragEnd={() => setDraggedItem(null)}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all cursor-move ${
                              draggedItem?.optionId === opt.id
                                ? "bg-primary/10 border-2 border-primary/50 opacity-60"
                                : draggedItem && draggedItem.questionId === q.id
                                ? "bg-surface-elevated/50 border border-border-light/20"
                                : "bg-surface-elevated border border-border-light/40 hover:border-primary/30"
                            }`}
                          >
                            <span className="w-6 h-6 shrink-0 rounded-full bg-primary/15 text-primary-light text-xs font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="flex-1 text-xs font-medium text-text-secondary">{opt.option_text}</span>
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveRankedOption(q.id, opt.id, -1)}
                              className="text-text-muted hover:text-primary disabled:opacity-25 disabled:hover:text-text-muted transition-colors p-1"
                              title="Move up"
                            >
                              <ChevronUp size={16} />
                            </button>
                            <button
                              type="button"
                              disabled={idx === arr.length - 1}
                              onClick={() => moveRankedOption(q.id, opt.id, 1)}
                              className="text-text-muted hover:text-primary disabled:opacity-25 disabled:hover:text-text-muted transition-colors p-1"
                              title="Move down"
                            >
                              <ChevronDown size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-text-muted">
                        Ranked 1 (highest) to {q.election_question_options.length} (lowest) — drag items to reorder, or use the arrows.
                      </p>
                    </div>
                  )}

                  {/* Rating Scale */}
                  {q.question_type === "rating" && (
                    <RatingScale
                      value={ans.ratingValue ?? null}
                      onChange={(val) => selectRating(q.id, val)}
                    />
                  )}

                  {/* Free Text */}
                  {q.question_type === "text" && (
                    <Textarea
                      placeholder="Type your response..."
                      value={ans.textAnswer || ""}
                      onChange={(e) => updateTextAnswer(q.id, e.target.value)}
                      onBlur={() => saveTextAnswer(q.id)}
                      rows={3}
                    />
                  )}

                  {/* Elaboration Context -- no question video, no video
                      recording UI on this tab at all; that's the video tab's
                      job. */}
                  {started && q.allow_context && (
                    <div className="pt-3 border-t border-border-light/20 space-y-2">
                      <label className="block text-xs font-semibold text-text-muted">
                        Optional Context / Elaboration:
                      </label>
                      <Textarea
                        placeholder="Add specific context to clarify your stance..."
                        value={ans.context || ""}
                        onChange={(e) => updateContext(q.id, e.target.value)}
                        onBlur={() => saveContext(q.id)}
                        rows={2}
                      />
                    </div>
                  )}
                </Card>
              );
            })}
        </div>
      )}

      {statusMessage && (
        <p className="text-xs font-semibold text-text-main p-3 bg-surface-elevated rounded-xl border border-border-light/30">
          {statusMessage}
        </p>
      )}

      {/* submit_candidate_application hard-blocks without an intro video --
          surfaced here, before the click, instead of only as an error
          message after a doomed submit attempt. */}
      {!introVideoUrl && (
        <p className="text-xs text-warning-light bg-warning/10 border border-warning/25 rounded-xl px-3 py-2">
          Record your Introductory Campaign Video Pitch above before submitting — it's required to submit.
        </p>
      )}

      <div className="flex justify-end pt-4 border-t border-border-light/20">
        <Button
          onClick={handleSubmit}
          disabled={submitting || !introVideoUrl}
          title={!introVideoUrl ? "Record your intro video pitch first" : undefined}
          className="gap-2 font-bold"
        >
          <Send size={15} /> {submitting ? "Submitting..." : "Submit Application"}
        </Button>
      </div>

      {/* Submission is instant, not a request that sits in a queue -- a
          dialog the candidate has to actively dismiss (rather than an inline
          line of text easy to miss while already scrolled past this button)
          makes that land, and routes straight back to My Elections where the
          new "Approved" status is visible. */}
      {submitResultStatus && (
        <Modal onOverlayClick={() => setSubmitResultStatus(null)}>
          <Card variant="hero" padding="lg" className="max-w-sm w-full text-center space-y-3">
            <CheckCircle2
              size={40}
              className={`mx-auto ${submitResultStatus === "approved" ? "text-success" : "text-warning"}`}
            />
            <h2 className="text-lg font-bold text-text-main">
              {submitResultStatus === "approved" ? "Application Submitted & Approved!" : "Application Resubmitted"}
            </h2>
            <p className="text-sm text-text-secondary">
              {submitResultStatus === "approved"
                ? "You're now a confirmed candidate for this seat — no admin review needed, it's live immediately."
                : "Your updated application has been saved. This candidacy was previously rejected, so it stays under that status rather than reopening automatically."}
            </p>
            <Button
              onClick={() => {
                setSubmitResultStatus(null);
                router.push("/politician/elections");
              }}
              className="w-full"
            >
              Go to My Elections
            </Button>
          </Card>
        </Modal>
      )}
    </div>
  );
}
