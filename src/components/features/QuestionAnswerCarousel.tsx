"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { getCandidateAnswersByQuestion } from "@/lib/services/elections";
import { createComment, voteOnPost, getPostVoteCounts } from "@/lib/services/feed";
import { createClient } from "@/lib/supabase/client";
import PitchPlayer, { type PitchSlide } from "./PitchPlayer";

interface CarouselAnswer {
  id: string;
  video_url: string | null;
  context_text: string | null;
  // election_candidates has no display_name/avatar_url columns of its own
  // (getCandidateAnswersByQuestion doesn't select any) -- name/avatar always
  // come from the joined profiles/politician_profiles row.
  election_candidates: {
    id: string;
    profiles: {
      id: string;
      full_name: string | null;
      current_ghost_id: string | null;
      politician_profiles: { avatar_url: string | null } | { avatar_url: string | null }[] | null;
    } | null;
  };
  posts: {
    id: string;
    likes_count: number;
    dislikes_count: number;
    comments: { id: string; ghost_id: string; content: string; created_at: string }[];
  } | { id: string; likes_count: number; dislikes_count: number; comments: any[] }[] | null;
}

// One question, every candidate's video answer to it -- swipeable via
// next/prev, wheel, touch, or Up/Down arrow keys (all handled by
// PitchPlayer). Rank/order is deliberately simple — engagement + a mild
// recency decay computed on already-loaded rows, no separate view/skip-
// tracking system (see Gap 3 in docs/VIRTUAL_INTERVIEW_SYSTEM.md).
export default function QuestionAnswerCarousel({
  questionId,
  questionText,
  questionVideoUrl,
  initialCandidateId,
  onClose,
  onNextQuestion,
  onPrevQuestion,
}: {
  questionId: string;
  questionText: string;
  questionVideoUrl?: string | null;
  initialCandidateId?: string;
  onClose: () => void;
  // Present only when there's an adjacent question to move to -- lets
  // swiping/arrow-keying past the last (or before the first) candidate for
  // this question carry straight into the next/previous question instead of
  // dead-ending. Caller (ElectionInterviewTab) owns the question list and
  // re-mounts this component with the new questionId/questionText when
  // called.
  onNextQuestion?: () => void;
  onPrevQuestion?: () => void;
}) {
  const supabase = createClient();
  const { user, profile } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<CarouselAnswer[]>([]);
  const [index, setIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);
  // Purely a local "did I just tap this" flag for the heart's filled state --
  // vote_on_post toggles server-side, so this is only ever wrong for a post
  // the viewer already liked in a past session (shows unfilled until their
  // next tap here), never in the direction that would let them re-add likes.
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getCandidateAnswersByQuestion(supabase, questionId).then(({ data }) => {
      if (cancelled) return;
      const rows = (data as unknown as CarouselAnswer[]) || [];
      // Engagement-weighted, mild recency decay, no view/skip instrumentation
      // — see the ORDER BY note in docs/VIRTUAL_INTERVIEW_SYSTEM.md Gap 3.
      const scored = [...rows].sort((a, b) => scoreAnswer(b) - scoreAnswer(a));
      setAnswers(scored);
      const startAt = initialCandidateId
        ? Math.max(0, scored.findIndex((a) => a.election_candidates?.id === initialCandidateId))
        : 0;
      setIndex(startAt);
      setShowComments(false);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [questionId, supabase, initialCandidateId]);

  const goNext = () => {
    if (index < answers.length - 1) {
      setShowComments(false);
      setIndex((i) => i + 1);
    } else if (onNextQuestion) {
      onNextQuestion();
    }
  };
  const goPrev = () => {
    if (index > 0) {
      setShowComments(false);
      setIndex((i) => i - 1);
    } else if (onPrevQuestion) {
      onPrevQuestion();
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown" || e.key === "ArrowRight") goNext();
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers.length, index, onNextQuestion, onPrevQuestion]);

  const handleLike = async (slide: PitchSlide) => {
    if (!user) {
      router.push("/auth");
      return;
    }
    const postId = slide.postId;
    if (!postId) return;
    // vote_on_post toggles server-side -- voting "like" again on a post you
    // already liked REMOVES it (count goes down). Read the real count back
    // instead of guessing the delta, so repeated taps can't just climb
    // forever if the toggle-off case gets missed.
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
    const current = answers[index];
    const postId = normalizePost(current?.posts)?.id;
    if (!commentText.trim() || !postId) return;
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
                  // The signed-in user's real current_ghost_id -- getGhostDisplayName
                  // renders an empty ghost_id as the literal string "Ghost-Unknown".
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

  const shareUrl = typeof window !== "undefined" ? window.location.href : undefined;

  const slides: PitchSlide[] = answers.map((a) => {
    const post = normalizePost(a.posts);
    return {
      id: a.id,
      videoUrl: a.video_url,
      postId: post?.id ?? null,
      authorName: a.election_candidates?.profiles?.full_name || "Candidate",
      authorAvatarUrl: resolveAvatar(a),
      likesCount: post?.likes_count ?? 0,
      comments: post?.comments ?? [],
      ownerGhostId: a.election_candidates?.profiles?.current_ghost_id ?? null,
      shareUrl,
      noVideoMessage: "No video for this answer.",
      autoPlayOnEnd: false,
    };
  });

  return (
    <PitchPlayer
      title={questionText}
      slides={slides}
      index={index}
      loading={loading}
      emptyMessage="No candidate has answered this question yet."
      footerLabel={`Candidate ${index + 1} of ${answers.length} — swipe or use ↑/↓`}
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
      canGoPrev={index > 0 || !!onPrevQuestion}
      canGoNext={index < answers.length - 1 || !!onNextQuestion}
      onNext={goNext}
      onPrev={goPrev}
    />
  );
}

function normalizePost(posts: CarouselAnswer["posts"]) {
  if (!posts) return null;
  return Array.isArray(posts) ? posts[0] || null : posts;
}

function resolveAvatar(answer?: CarouselAnswer) {
  if (!answer) return undefined;
  const pp = answer.election_candidates?.profiles?.politician_profiles;
  return Array.isArray(pp) ? pp[0]?.avatar_url ?? undefined : pp?.avatar_url ?? undefined;
}

function scoreAnswer(a: CarouselAnswer) {
  const post = normalizePost(a.posts);
  if (!post) return 0;
  return (post.likes_count - post.dislikes_count) * 2 + post.comments.length;
}
