"use client";

import React, { useState, useEffect, useCallback } from "react";
import { MessageSquare, LogIn, Clock } from "lucide-react";
import { Card, Button, Spinner } from "@/components/primitives";
import CommentComposer from "./CommentComposer";
import { createClient } from "@/lib/supabase/client";
import { getNewsArticleComments, createNewsArticleComment } from "@/lib/services/news";
import { getSession, onAuthStateChange } from "@/lib/services/auth";
import { getOwnProfile } from "@/lib/services/profile";
import { getGhostDisplayName } from "@/lib/utils/ghostName";
import type { PostWithComments } from "./PostCard";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";

interface Props {
  articleId: string;
  articleSlug: string;
}

export default function NewsComments({ articleId, articleSlug }: Props) {
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [ghostId, setGhostId] = useState<string | null>(null);
  const [comments, setComments] = useState<PostWithComments[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Auth ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    getSession(supabase).then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
    const { data: sub } = onAuthStateChange(supabase, async (_ev, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!user) { setGhostId(null); return; }
    getOwnProfile(supabase, user.id, { columns: "current_ghost_id" }).then(({ data }) =>
      setGhostId((data as { current_ghost_id: string | null } | null)?.current_ghost_id ?? null)
    );
  }, [user, supabase]);

  // ── Load comments ─────────────────────────────────────────────────────────

  const loadComments = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await getNewsArticleComments(supabase, articleId);
    if (!err) setComments(data ?? []);
    setLoading(false);
  }, [supabase, articleId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadComments();
  }, [loadComments]);

  // ── Submit comment ────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!commentText.trim() || submitting) return;
    setSubmitting(true);
    setError(null);

    const { error: err } = await createNewsArticleComment(supabase, articleId, commentText.trim());
    setSubmitting(false);

    if (err) {
      setError(err.message);
    } else {
      setCommentText("");
      await loadComments();
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Card padding="md" className="space-y-5">
      <h2 className="text-base font-bold text-text-main flex items-center gap-2">
        <MessageSquare size={16} className="text-primary" />
        Comments{comments.length > 0 ? ` (${comments.length})` : ""}
      </h2>

      {/* Composer — logged-in only */}
      {user ? (
        <div className="space-y-2">
          <CommentComposer
            value={commentText}
            onChange={setCommentText}
            onSubmit={handleSubmit}
            placeholder="Share your thoughts on this article (posts to your regional feed too)…"
          />
          {submitting && (
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Spinner size="sm" /> Posting…
            </div>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
          <p className="text-xs text-text-muted">
            💡 Your comment will also appear in your local regional feed
            {ghostId ? (
              <>
                {" "}
                as{" "}
                <span className="font-semibold text-primary/70">
                  {getGhostDisplayName(ghostId)}
                </span>
              </>
            ) : null}
            .
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 py-3 px-4 rounded-xl bg-surface/40 border border-border-light/20">
          <p className="text-xs text-text-muted">Sign in to leave a comment on this article.</p>
          <Button size="sm" as={Link} href={`/auth?next=/news/${articleSlug}`}>
            <LogIn size={13} /> Sign in
          </Button>
        </div>
      )}

      {/* Comment list */}
      {loading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-text-muted text-center py-4">
          Be the first to comment on this article.
        </p>
      ) : (
        <div className="space-y-3 divide-y divide-border-light/10">
          {comments.map((post) => {
            const relativeTime = post.created_at
              ? getRelativeTime(post.created_at)
              : "";
            return (
              <div key={post.id} className="pt-3 space-y-1">
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <span className="font-semibold text-primary/70">
                    {getGhostDisplayName(post.ghost_id)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={10} /> {relativeTime}
                  </span>
                </div>
                <p className="text-sm text-text-secondary leading-relaxed">{post.content}</p>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ── Relative time helper ──────────────────────────────────────────────────

function getRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}
