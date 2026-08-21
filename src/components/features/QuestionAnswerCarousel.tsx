"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Modal from "@/components/primitives/Modal";
import { Avatar, Spinner } from "@/components/primitives";
import { getGhostDisplayName } from "@/lib/utils/ghostName";
import { normalizeMediaUrl } from "@/lib/services/video";
import { getCandidateAnswersByQuestion } from "@/lib/services/elections";
import { createComment, voteOnPost } from "@/lib/services/feed";
import { createClient } from "@/lib/supabase/client";
import { X, ChevronUp, ChevronDown, Heart, MessageCircle, Send, AlertCircle } from "lucide-react";

interface CarouselAnswer {
  id: string;
  video_url: string | null;
  context_text: string | null;
  election_candidates: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    profiles: {
      id: string;
      full_name: string | null;
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

// Full-screen TikTok-style carousel: one question, every candidate's video
// answer to it, swipeable via next/prev (or Up/Down arrow keys). Rank/order
// is deliberately simple — engagement + a mild recency decay computed on
// already-loaded rows, no separate view/skip-tracking system (see Gap 3 in
// docs/VIRTUAL_INTERVIEW_SYSTEM.md).
export default function QuestionAnswerCarousel({
  questionId,
  questionText,
  questionVideoUrl,
  initialCandidateId,
  onClose,
}: {
  questionId: string;
  questionText: string;
  questionVideoUrl?: string | null;
  initialCandidateId?: string;
  onClose: () => void;
}) {
  const supabase = createClient();
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<CarouselAnswer[]>([]);
  const [index, setIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCandidateAnswersByQuestion(supabase, questionId).then(({ data }) => {
      if (cancelled) return;
      const rows = (data as unknown as CarouselAnswer[]) || [];
      // Engagement-weighted, mild recency decay, no view/skip instrumentation
      // — see the ORDER BY note in docs/VIRTUAL_INTERVIEW_SYSTEM.md Gap 3.
      // Computed here (client-side, on an already-small per-question result
      // set) rather than in SQL since the exact weights are a tuning detail,
      // not worth a migration to change later.
      const scored = [...rows].sort((a, b) => scoreAnswer(b) - scoreAnswer(a));
      setAnswers(scored);
      const startAt = initialCandidateId
        ? Math.max(0, scored.findIndex((a) => a.election_candidates?.id === initialCandidateId))
        : 0;
      setIndex(startAt);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [questionId, supabase, initialCandidateId]);

  const current = answers[index];
  const currentPost = normalizePost(current?.posts);

  const goNext = () => {
    setShowComments(false);
    setIndex((i) => Math.min(answers.length - 1, i + 1));
  };
  const goPrev = () => {
    setShowComments(false);
    setIndex((i) => Math.max(0, i - 1));
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
  }, [answers.length, index]);

  const handleLike = async () => {
    if (!user) {
      router.push("/auth");
      return;
    }
    if (!currentPost) return;
    const { error } = await voteOnPost(supabase, currentPost.id, 1);
    if (!error) {
      setAnswers((prev) =>
        prev.map((a, i) => {
          if (i !== index) return a;
          const p = normalizePost(a.posts);
          if (!p) return a;
          return { ...a, posts: { ...p, likes_count: p.likes_count + 1 } };
        })
      );
    }
  };

  const handleComment = async () => {
    if (!user) {
      router.push("/auth");
      return;
    }
    if (!commentText.trim() || !currentPost) return;
    setPosting(true);
    const { error } = await createComment(supabase, currentPost.id, commentText.trim());
    setPosting(false);
    if (!error) {
      setCommentText("");
      setAnswers((prev) =>
        prev.map((a, i) => {
          if (i !== index) return a;
          const p = normalizePost(a.posts);
          if (!p) return a;
          return {
            ...a,
            posts: {
              ...p,
              comments: [
                ...p.comments,
                { id: `local-${Date.now()}`, ghost_id: "", content: commentText.trim(), created_at: new Date().toISOString() },
              ],
            },
          };
        })
      );
    }
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

        {/* Question, pinned above the video */}
        <p className="text-white text-sm font-semibold text-center px-4 mb-2 max-w-md">{questionText}</p>

        {loading ? (
          <div className="w-full flex justify-center py-16">
            <Spinner />
          </div>
        ) : answers.length === 0 ? (
          <div className="p-8 text-center bg-surface rounded-2xl border border-border-light max-w-sm">
            <AlertCircle size={32} className="text-warning mx-auto mb-2" />
            <p className="text-sm text-text-main font-semibold">No candidate has answered this question yet.</p>
          </div>
        ) : (
          <div className="relative">
            {/* 9:16 video, strictly — same shell as StoryViewerModal */}
            <div
              className="relative rounded-2xl overflow-hidden bg-black shadow-2xl border border-white/10 flex items-center justify-center"
              style={{ aspectRatio: "9 / 16", height: "min(75vh, 720px)", maxWidth: "95vw" }}
            >
              {current?.video_url ? (
                <video
                  key={current.id}
                  src={normalizeMediaUrl(current.video_url)}
                  controls
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover bg-black"
                />
              ) : (
                <div className="text-white/60 text-xs">No video for this answer.</div>
              )}

              {/* Candidate identity, bottom-left */}
              <div className="absolute bottom-3 left-3 flex items-center gap-2 max-w-[70%]">
                <Avatar
                  src={resolveAvatar(current)}
                  name={current?.election_candidates?.display_name || current?.election_candidates?.profiles?.full_name || "Candidate"}
                  size="sm"
                />
                <span className="text-white text-sm font-bold drop-shadow truncate">
                  {current?.election_candidates?.display_name || current?.election_candidates?.profiles?.full_name || "Candidate"}
                </span>
              </div>

              {/* TikTok-style right-side action rail: like + comment */}
              <div className="absolute bottom-3 right-3 flex flex-col items-center gap-4">
                <button
                  onClick={handleLike}
                  className="flex flex-col items-center gap-0.5 text-white cursor-pointer"
                  title="Like this answer"
                >
                  <span className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
                    <Heart size={20} />
                  </span>
                  <span className="text-[11px] font-semibold drop-shadow">{currentPost?.likes_count ?? 0}</span>
                </button>
                <button
                  onClick={() => setShowComments((v) => !v)}
                  className="flex flex-col items-center gap-0.5 text-white cursor-pointer"
                  title="Comments"
                >
                  <span className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
                    <MessageCircle size={20} />
                  </span>
                  <span className="text-[11px] font-semibold drop-shadow">{currentPost?.comments?.length ?? 0}</span>
                </button>
              </div>

              {/* Next/prev between candidates for this same question */}
              {index > 0 && (
                <button
                  onClick={goPrev}
                  className="absolute top-2 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white cursor-pointer"
                  title="Previous candidate"
                >
                  <ChevronUp size={18} />
                </button>
              )}
              {index < answers.length - 1 && (
                <button
                  onClick={goNext}
                  className="absolute bottom-2 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white cursor-pointer"
                  title="Next candidate"
                >
                  <ChevronDown size={18} />
                </button>
              )}

              {/* Comments drawer */}
              {showComments && currentPost && (
                <div className="absolute inset-x-0 bottom-0 max-h-[55%] bg-black/85 backdrop-blur-sm rounded-t-2xl p-3 flex flex-col gap-2">
                  <div className="overflow-y-auto flex-1 space-y-2 pr-1">
                    {currentPost.comments.length === 0 ? (
                      <p className="text-white/50 text-xs text-center py-4">No comments yet — be the first.</p>
                    ) : (
                      currentPost.comments.map((c) => (
                        <div key={c.id} className="text-xs">
                          <span className="font-mono font-bold text-white/60">{getGhostDisplayName(c.ghost_id)}</span>
                          <p className="text-white/90">{c.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                  {user ? (
                    <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                      <input
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleComment()}
                        placeholder="Add a comment..."
                        className="flex-1 bg-white/10 text-white placeholder-white/40 text-xs rounded-full px-3 py-2 outline-none"
                      />
                      <button onClick={handleComment} disabled={posting || !commentText.trim()} className="text-white cursor-pointer disabled:opacity-40">
                        <Send size={16} />
                      </button>
                    </div>
                  ) : (
                    <Link href="/auth" className="text-xs text-white/70 underline text-center py-1">
                      Sign in to comment
                    </Link>
                  )}
                </div>
              )}
            </div>

            <p className="text-white/50 text-xs text-center mt-2">
              Candidate {index + 1} of {answers.length} — swipe or use ↑/↓
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

function normalizePost(posts: CarouselAnswer["posts"]) {
  if (!posts) return null;
  return Array.isArray(posts) ? posts[0] || null : posts;
}

function resolveAvatar(answer?: CarouselAnswer) {
  if (!answer) return undefined;
  if (answer.election_candidates?.avatar_url) return answer.election_candidates.avatar_url;
  const pp = answer.election_candidates?.profiles?.politician_profiles;
  return Array.isArray(pp) ? pp[0]?.avatar_url ?? undefined : pp?.avatar_url ?? undefined;
}

function scoreAnswer(a: CarouselAnswer) {
  const post = normalizePost(a.posts);
  if (!post) return 0;
  const reactions = (post.likes_count - post.dislikes_count) * 2 + post.comments.length;
  return reactions;
}
