"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { getQuestionForAnswer } from "@/lib/services/elections";
import { createComment, voteOnPost, getPostVoteCounts } from "@/lib/services/feed";
import { createClient } from "@/lib/supabase/client";
import PitchPlayer, { type PitchSlide, type PitchComment } from "./PitchPlayer";

// A single answer_pitch post, opened standalone (from a wall or the main
// feed, wherever PostCard renders one individually rather than through the
// full interview reel or the per-question comparison carousel). Plays the
// same "question video, then answer video" sequence PlayInterviewReel does
// for the full interview -- so a lone pitch post never drops a viewer
// straight into an answer with no idea what was asked -- using the same
// PitchPlayer shell, so the like/comment/share rail on the answer clip is
// the exact same one everywhere else in the app.
export default function PitchPostPlayer({
  post,
  authorName,
  authorAvatarUrl,
  onClose,
}: {
  post: {
    id: string;
    video_url: string | null;
    likes_count: number | null;
    dislikes_count: number | null;
    ghost_id: string;
    election_answer_id: string | null;
    comments?: { id: string; ghost_id: string; content: string; created_at: string | null }[] | null;
  };
  authorName: string;
  authorAvatarUrl?: string | null;
  onClose: () => void;
}) {
  const supabase = createClient();
  const { user, profile } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState<{ question_text: string; question_video_url: string | null } | null>(
    null
  );
  const [likesCount, setLikesCount] = useState(post.likes_count ?? 0);
  const [comments, setComments] = useState<PitchComment[]>(post.comments ?? []);
  const [index, setIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!post.election_answer_id) {
      setLoading(false);
      return;
    }
    getQuestionForAnswer(supabase, post.election_answer_id).then(({ data }) => {
      if (cancelled) return;
      const q = Array.isArray(data?.election_questions) ? data?.election_questions[0] : data?.election_questions;
      setQuestion(q ? { question_text: q.question_text, question_video_url: q.question_video_url } : null);
      // Question clip plays first when there is one, matching the actual
      // interview sequencing -- otherwise start straight on the answer.
      setIndex(0);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [post.election_answer_id, supabase]);

  const slides: PitchSlide[] = [];
  if (question?.question_video_url) {
    slides.push({
      id: `${post.id}-q`,
      videoUrl: question.question_video_url,
      postId: null,
      caption: { label: "Question", text: question.question_text },
      authorName,
      authorAvatarUrl,
      likesCount: 0,
      comments: [],
      autoPlayOnEnd: true,
    });
  }
  slides.push({
    id: `${post.id}-a`,
    videoUrl: post.video_url,
    postId: post.id,
    caption: question ? { label: "Answer", text: question.question_text } : null,
    authorName,
    authorAvatarUrl,
    likesCount,
    comments,
    ownerGhostId: post.ghost_id,
    // Deep-links back to this exact pitch (not just the wall it lives on) --
    // the wall page reads ?pitch=<id> on load and reopens this same player
    // for it, so someone opening a shared link lands straight on the clip
    // instead of the top of a whole profile.
    shareUrl:
      typeof window !== "undefined"
        ? `${window.location.origin}${window.location.pathname}?pitch=${post.id}`
        : undefined,
    noVideoMessage: "No video for this pitch.",
    autoPlayOnEnd: false,
  });

  const goNext = () => setIndex((i) => Math.min(slides.length - 1, i + 1));
  const goPrev = () => setIndex((i) => Math.max(0, i - 1));

  const handleLike = async () => {
    if (!user) {
      router.push("/auth");
      return;
    }
    const { error } = await voteOnPost(supabase, post.id, 1);
    if (!error) {
      const { data } = await getPostVoteCounts(supabase, post.id);
      setLikesCount(data?.likes_count ?? likesCount);
      setLiked((v) => !v);
    }
  };

  const handleComment = async () => {
    if (!user) {
      router.push("/auth");
      return;
    }
    if (!commentText.trim()) return;
    setPosting(true);
    const { error } = await createComment(supabase, post.id, commentText.trim());
    setPosting(false);
    if (!error) {
      setComments((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          ghost_id: profile?.current_ghost_id || "",
          content: commentText.trim(),
          created_at: new Date().toISOString(),
        },
      ]);
      setCommentText("");
    }
  };

  return (
    <PitchPlayer
      slides={slides}
      index={index}
      loading={loading}
      showComments={showComments}
      onToggleComments={() => setShowComments((v) => !v)}
      commentText={commentText}
      onCommentTextChange={setCommentText}
      onSubmitComment={handleComment}
      posting={posting}
      canComment={!!user}
      likedSlideIds={liked ? new Set([post.id]) : new Set()}
      onLike={handleLike}
      onClose={onClose}
      canGoPrev={index > 0}
      canGoNext={index < slides.length - 1}
      onNext={goNext}
      onPrev={goPrev}
    />
  );
}
