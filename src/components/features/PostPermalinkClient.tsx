"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PostCard, { type PostWithComments } from "./PostCard";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  getPostById,
  canCommentOnPost,
  createComment,
  voteOnPost,
  hydratePoliticianAuthors,
  hydratePostMentions,
} from "@/lib/services/feed";
import { reportContent, type ReportTargetType } from "@/lib/services/moderation";

type Mention = { politicianId: string; fullName: string; wallHref: string };

// A single post on its own page — what a shared link opens. Everyone can read
// the whole conversation; only signed-in people in the post's districts get
// the comment box (the same rule create_comment() enforces server-side).
export default function PostPermalinkClient({ postId }: { postId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [post, setPost] = useState<PostWithComments | null>(null);
  const [loading, setLoading] = useState(true);
  const [author, setAuthor] = useState<{ fullName: string; wallHref: string } | null>(null);
  const [mentions, setMentions] = useState<Mention[] | undefined>(undefined);
  const [canComment, setCanComment] = useState(false);
  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState<string | undefined>();

  const load = useCallback(async () => {
    const { data } = await getPostById(supabase, postId);
    const p = (data as unknown as PostWithComments) || null;
    setPost(p);
    if (p) {
      const [authors, ment] = await Promise.all([
        hydratePoliticianAuthors(supabase, [p]),
        hydratePostMentions(supabase, [p]),
      ]);
      setAuthor(authors.get(p.ghost_id) ?? null);
      setMentions(ment.get(p.id));
    }
    setLoading(false);
  }, [supabase, postId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setCanComment(false);
      return;
    }
    canCommentOnPost(supabase, postId).then(({ allowed }) => setCanComment(allowed));
  }, [authLoading, user, supabase, postId]);

  const areas = ((post as any)?.post_boundaries || [])
    .map((b: any) => b.map_shapes?.name)
    .filter(Boolean) as string[];
  const areaLabel = areas.length > 0 ? [...new Set(areas)].slice(0, 3).join(", ") : "this area";

  const requireAuth = () => router.push(`/auth?next=${encodeURIComponent(`/post/${postId}`)}`);

  const handleVote = async (id: string, voteType: 1 | -1) => {
    if (!user) return requireAuth();
    const { error } = await voteOnPost(supabase, id, voteType);
    if (!error) await load();
  };

  const handleComment = async () => {
    if (!comment.trim()) return;
    setCommentError(undefined);
    const { error } = await createComment(supabase, postId, comment.trim());
    if (error) {
      setCommentError(error.message || "Failed to post comment.");
      return;
    }
    setComment("");
    await load();
  };

  const handleReport = async (targetType: ReportTargetType, targetId: string, abuseType: string) =>
    reportContent(supabase, targetType, targetId, abuseType);

  if (loading) {
    return <div className="max-w-4xl mx-auto px-4 py-16 text-center text-text-muted">Loading…</div>;
  }
  if (!post) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-3">
        <p className="text-text-main font-semibold">This post isn&apos;t available.</p>
        <Link href="/feed" className="text-primary text-sm font-semibold">
          Go to your feed
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
      <Link href="/feed" className="text-sm font-semibold text-text-muted hover:text-text-main">
        ← Feed
      </Link>
      <PostCard
        post={post}
        showVoteBar
        onVote={handleVote}
        canComment={canComment}
        onRequireAuth={user ? undefined : requireAuth}
        commentBlockedMessage={
          user && !canComment
            ? `Only people in ${areaLabel} can join this conversation. You can read the thread and see the reactions.`
            : null
        }
        commentValue={comment}
        onCommentChange={setComment}
        onSubmitComment={handleComment}
        commentError={commentError}
        politicianAuthor={author}
        onReport={user ? handleReport : undefined}
        boundaryName={areas[0] ?? null}
        mentions={mentions}
      />
    </div>
  );
}
