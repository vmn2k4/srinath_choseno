"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { getCandidateVideoAnswersForReel } from "@/lib/services/elections";
import { createComment, voteOnPost, getPostVoteCounts } from "@/lib/services/feed";
import { createClient } from "@/lib/supabase/client";
import PitchPlayer, { type PitchSlide } from "./PitchPlayer";

interface ReelAnswer {
  id: string;
  video_url: string;
  election_questions: {
    id: string;
    question_text: string;
    rank: number;
    question_video_url?: string | null;
  };
  posts: {
    id: string;
    likes_count: number;
    dislikes_count: number;
    comments: { id: string; ghost_id: string; content: string; created_at: string }[];
  } | { id: string; likes_count: number; dislikes_count: number; comments: any[] }[] | null;
  election_candidates?: {
    id: string;
    profiles: {
      current_ghost_id: string | null;
      politician_profiles: { avatar_url: string | null } | { avatar_url: string | null }[] | null;
    } | null;
  } | { profiles: any }[] | null;
}

// Sequenced "play all" reel: one candidate's full interview as one
// continuous experience -- each question's own video plays first (same clip
// shown during the actual interview), then that candidate's answer, then the
// next question, and so on, auto-advancing the whole way through. Not 9
// separate clips a viewer has to click through one at a time: press play
// once and it plays like a single interview video, question-then-answer,
// start to finish, with the exact same like/comment/share rail an
// individual pitch gets (via PitchPlayer) on each answer clip -- a question
// clip has nothing to react to, so its slide just omits the rail entirely.
// Falls back straight to the answer when a question has no video of its own
// (older questions created before video generation).
//
// Same shell as QuestionAnswerCarousel (both wrap PitchPlayer) — this is the
// other of the two entry points into "play entire interview" described in
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
  const { user, profile } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<ReelAnswer[]>([]);
  const [index, setIndex] = useState(0);
  const [complete, setComplete] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    getCandidateVideoAnswersForReel(supabase, candidateId).then(({ data }) => {
      if (cancelled) return;
      setAnswers((data as unknown as ReelAnswer[]) || []);
      setIndex(0);
      setComplete(false);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [candidateId, supabase]);

  // Flatten "question video, then answer video" per question into one
  // ordered slide list -- a plain index +/- 1 through this list reproduces
  // exactly the old stage machine (question -> answer -> next question's
  // question, or straight to the next answer when a question has no video
  // of its own) with no separate stage state needed.
  const avatarUrl = (() => {
    const ec = answers[0]?.election_candidates;
    const cand = Array.isArray(ec) ? ec[0] : ec;
    const pp = cand?.profiles?.politician_profiles;
    return Array.isArray(pp) ? pp[0]?.avatar_url ?? undefined : pp?.avatar_url ?? undefined;
  })();
  const candidateGhostId = (() => {
    const ec = answers[0]?.election_candidates;
    const cand = Array.isArray(ec) ? ec[0] : ec;
    return cand?.profiles?.current_ghost_id ?? null;
  })();

  // Built alongside `slides` so the footer can say "Question 3 of 9" off the
  // real question number, not the slide index (each question contributes
  // one or two slides, so those two counts diverge as soon as any question
  // has its own video).
  const slides: PitchSlide[] = [];
  const questionNumberBySlideIndex: number[] = [];
  answers.forEach((a, qIdx) => {
    const post = normalizePost(a.posts);
    const q = a.election_questions;
    const shared = {
      authorName: candidateName,
      authorAvatarUrl: avatarUrl,
      autoPlayOnEnd: true,
    };
    if (q?.question_video_url) {
      slides.push({
        id: `${a.id}-q`,
        videoUrl: q.question_video_url,
        postId: null,
        caption: { label: "Question", text: q.question_text },
        comments: [],
        likesCount: 0,
        ...shared,
      });
      questionNumberBySlideIndex.push(qIdx + 1);
    }
    slides.push({
      id: `${a.id}-a`,
      videoUrl: a.video_url,
      postId: post?.id ?? null,
      caption: { label: "Answer", text: q?.question_text || "" },
      likesCount: post?.likes_count ?? 0,
      comments: post?.comments ?? [],
      ownerGhostId: candidateGhostId,
      shareUrl: typeof window !== "undefined" ? window.location.href : undefined,
      noVideoMessage: "No video for this answer.",
      ...shared,
    });
    questionNumberBySlideIndex.push(qIdx + 1);
  });

  const goNext = () => {
    setShowComments(false);
    if (index < slides.length - 1) {
      setIndex((i) => i + 1);
    } else {
      setComplete(true);
    }
  };
  const goPrev = () => {
    setShowComments(false);
    setIndex((i) => Math.max(0, i - 1));
  };

  // Find the source answer for whichever slide is showing a real post, so
  // like/comment can look up and patch the right entry in `answers`.
  const findAnswerForPost = (postId: string) =>
    answers.find((a) => normalizePost(a.posts)?.id === postId);

  const handleLike = async (slide: PitchSlide) => {
    if (!user) {
      router.push("/auth");
      return;
    }
    const postId = slide.postId;
    if (!postId) return;
    const { error } = await voteOnPost(supabase, postId, 1);
    if (!error) {
      const { data } = await getPostVoteCounts(supabase, postId);
      setAnswers((prev) =>
        prev.map((a) => {
          const p = normalizePost(a.posts);
          if (!p || p.id !== postId) return a;
          return { ...a, posts: { ...p, likes_count: data?.likes_count ?? p.likes_count, dislikes_count: data?.dislikes_count ?? p.dislikes_count } };
        })
      );
      setLikedPostIds((prev) => {
        const next = new Set(prev);
        if (next.has(postId)) next.delete(postId);
        else next.add(postId);
        return next;
      });
    }
  };

  const handleComment = async () => {
    if (!user) {
      router.push("/auth");
      return;
    }
    const current = slides[index];
    const postId = current?.postId;
    if (!commentText.trim() || !postId) return;
    const sourceAnswer = findAnswerForPost(postId);
    if (!sourceAnswer) return;
    setPosting(true);
    const { error } = await createComment(supabase, postId, commentText.trim());
    setPosting(false);
    if (!error) {
      setCommentText("");
      setAnswers((prev) =>
        prev.map((a) => {
          const p = normalizePost(a.posts);
          if (!p || p.id !== postId) return a;
          return {
            ...a,
            posts: {
              ...p,
              comments: [
                ...p.comments,
                {
                  id: `local-${Date.now()}`,
                  ghost_id: profile?.current_ghost_id || "",
                  content: commentText.trim(),
                  created_at: new Date().toISOString(),
                },
              ],
            },
          };
        })
      );
    }
  };

  return (
    <PitchPlayer
      title={`${candidateName}'s Interview`}
      slides={slides}
      index={index}
      loading={loading}
      emptyMessage="No video answers yet."
      isComplete={complete}
      completeTitle="That's the full interview"
      completeSubtitle={`${answers.length} question${answers.length !== 1 ? "s" : ""} answered by ${candidateName}.`}
      onWatchAgain={() => {
        setComplete(false);
        setIndex(0);
      }}
      footerLabel={`Question ${questionNumberBySlideIndex[index] ?? answers.length} of ${answers.length}`}
      showComments={showComments}
      onToggleComments={() => setShowComments((v) => !v)}
      commentText={commentText}
      onCommentTextChange={setCommentText}
      onSubmitComment={handleComment}
      posting={posting}
      canComment={!!user}
      likedSlideIds={likedPostIds}
      onLike={handleLike}
      onClose={onClose}
      canGoPrev={index > 0}
      canGoNext={true}
      onNext={goNext}
      onPrev={goPrev}
    />
  );
}

function normalizePost(posts: ReelAnswer["posts"]) {
  if (!posts) return null;
  return Array.isArray(posts) ? posts[0] || null : posts;
}
