"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PostCard, { type PostWithComments } from "./PostCard";
import ElectionBreadcrumb from "./ElectionBreadcrumb";
import PoliticianSidebar from "./PoliticianSidebar";
import { Card, Spinner, EmptyState, Badge, Button } from "@/components/primitives";
import { buildBoundarySlug } from "@/lib/utils/slugs";
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
    return (
      <div className="w-full max-w-none px-4 lg:px-8 py-16 flex justify-center">
        <Spinner />
      </div>
    );
  }
  if (!post) {
    return (
      <div className="w-full max-w-none px-4 lg:px-8 py-8 space-y-4">
        <ElectionBreadcrumb items={[{ name: "Home", href: "/" }, { name: "Feed", href: "/feed" }, { name: "Post" }]} />
        <EmptyState
          title="This post isn't available"
          description="It may have been removed, or the link is wrong."
          action={
            <Link href="/feed">
              <Button>Go to your feed</Button>
            </Link>
          }
        />
      </div>
    );
  }

  type Shape = { id: number; name: string; boundary_type: string; country: string };
  const rawBoundaries = ((post as unknown as { post_boundaries?: Array<{ map_shapes: Shape | null }> }).post_boundaries) || [];
  const shapes = rawBoundaries.map((b) => b.map_shapes).filter((m): m is Shape => !!m && m.id != null);
  const uniqueShapes = shapes.filter((m, i) => shapes.findIndex((x) => x.id === m.id) === i);
  const first = uniqueShapes[0];
  const crumbs: Array<{ name: string; href?: string }> = [{ name: "Home", href: "/" }, { name: "Feed", href: "/feed" }];
  if (first) crumbs.push({ name: first.name, href: `/elections/${buildBoundarySlug(first)}` });
  crumbs.push({ name: "Post" });

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 py-6 space-y-4">
      <ElectionBreadcrumb items={crumbs} />
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0 space-y-4">
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
        <div className="w-full lg:w-80 shrink-0 space-y-4">
          {uniqueShapes.length > 0 && (
            <Card padding="sm" className="space-y-2">
              <h2 className="text-sm font-bold text-text-main">Posted in</h2>
              <div className="flex flex-wrap gap-2">
                {uniqueShapes.map((m) => (
                  <Link key={m.id} href={`/elections/${buildBoundarySlug(m)}`}>
                    <Badge>{m.name}</Badge>
                  </Link>
                ))}
              </div>
            </Card>
          )}
          {first && (
            <PoliticianSidebar
              profile={{ country: first.country }}
              activeTab={`shape-${first.id}`}
              selectedPill={{
                key: `shape-${first.id}`,
                districtName: first.name,
                divisionType: first.boundary_type,
                filterType: "shape",
                shapeId: first.id,
              }}
              memberships={uniqueShapes}
            />
          )}
        </div>
      </div>
    </div>
  );
}
