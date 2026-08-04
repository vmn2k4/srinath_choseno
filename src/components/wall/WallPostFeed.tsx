"use client";

import React from "react";
import { Users, ShieldCheck, CornerDownRight, Send } from "lucide-react";
import LinkPreview from "@/components/features/LinkPreview";
import { getGhostDisplayName } from "@/lib/utils/ghostName";
import { Card, Badge, Input, Button, EmptyState } from "@/components/primitives";

export interface WallComment {
  id: string;
  ghost_id: string;
  content: string;
  created_at: string;
}

export interface WallPost {
  id: string;
  ghost_id: string;
  content: string;
  created_at: string;
  image_url?: string | null;
  video_url?: string | null;
  link_metadata?: {
    url: string;
    title?: string;
    description?: string;
    image?: string;
  } | null;
  comments?: WallComment[];
}

interface WallPostFeedProps {
  posts: WallPost[];
  ownerGhostId?: string | null;
  ownerBadgeLabel?: string;
  viewerIsOwner?: boolean;
  emptyMessage?: string;
  canComment?: boolean;
  commentInputs?: Record<string, string>;
  onCommentInputChange?: (postId: string, text: string) => void;
  onSubmitComment?: (postId: string) => void;
}

export default function WallPostFeed({
  posts,
  ownerGhostId,
  ownerBadgeLabel = "Candidate",
  viewerIsOwner = false,
  emptyMessage = "No posts yet.",
  canComment = true,
  commentInputs = {},
  onCommentInputChange,
  onSubmitComment,
}: WallPostFeedProps) {
  if (posts.length === 0) {
    return <EmptyState description={emptyMessage} />;
  }

  const byDate = (a: WallComment, b: WallComment) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime();

  return (
    <div className="space-y-6">
      {posts.map((post) => {
        const isOwnerPost = ownerGhostId && post.ghost_id === ownerGhostId;

        // Candidate replies
        const candidateReplies = (post.comments || [])
          .filter(
            (c) =>
              (ownerGhostId && c.ghost_id === ownerGhostId) ||
              (isOwnerPost && c.ghost_id === post.ghost_id)
          )
          .sort(byDate);

        // General comments
        const generalComments = (post.comments || [])
          .filter((c) => !candidateReplies.some((cr) => cr.id === c.id))
          .sort(byDate);

        const hasSpotlightResponse = candidateReplies.length > 0;
        const commentsToDisplayInThread = hasSpotlightResponse
          ? generalComments
          : [...candidateReplies, ...generalComments];

        return (
          <Card key={post.id} interactive padding="sm" className="overflow-hidden">
            {/* Post Header */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-surface/50 border border-border-light/30 flex items-center justify-center">
                <Users size={16} className="text-text-muted" />
              </div>
              <div>
                <div className="text-sm font-bold text-text-secondary font-mono flex items-center gap-2">
                  {getGhostDisplayName(post.ghost_id)}
                  {isOwnerPost && (
                    <Badge tone="primary">{ownerBadgeLabel}</Badge>
                  )}
                </div>
                <div className="text-xs text-text-muted">
                  {new Date(post.created_at).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Post Content */}
            <p className="text-text-tertiary text-sm whitespace-pre-wrap leading-relaxed mb-3">
              {post.content}
            </p>

            {post.image_url && (
              <div className="mb-4 rounded-xl overflow-hidden border border-border-light/45">
                <img
                  src={post.image_url}
                  alt="Post Attachment"
                  className="w-full max-h-[500px] object-cover"
                  loading="lazy"
                />
              </div>
            )}

            {post.link_metadata ? (
              <div className="mb-4">
                <LinkPreview
                  url={post.link_metadata.url}
                  metadata={post.link_metadata}
                />
              </div>
            ) : (() => {
              const match = post.content?.match(/(https?:\/\/[^\s]+)/);
              return match ? (
                <div className="mb-4">
                  <LinkPreview url={match[1]} />
                </div>
              ) : null;
            })()}

            {post.video_url && (
              <div className="mt-3 rounded-xl overflow-hidden border border-border-light/45 bg-black">
                <video
                  src={post.video_url}
                  controls
                  className="w-full max-h-96 object-contain"
                />
              </div>
            )}

            {/* Candidate Response Spotlight */}
            {hasSpotlightResponse && (
              <div className="mt-4 p-4 bg-primary/10 border border-primary/30 rounded-xl space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-primary-light">
                    <ShieldCheck size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Official Candidate Response
                    </span>
                  </div>
                  <Badge tone="primary">
                    {viewerIsOwner ? "You (Candidate)" : ownerBadgeLabel}
                  </Badge>
                </div>
                <div className="space-y-3">
                  {candidateReplies.map((reply) => (
                    <div
                      key={reply.id}
                      className="pl-3 border-l-2 border-primary/50 space-y-1"
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-bold text-text-main font-mono">
                          {getGhostDisplayName(reply.ghost_id)}
                        </span>
                        <span className="text-[10px] text-text-muted">
                          {new Date(reply.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-text-main whitespace-pre-wrap leading-relaxed">
                        {reply.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comments Thread Section */}
            <div className="mt-4 pt-4 border-t border-border-light/20">
              {commentsToDisplayInThread.length > 0 && (
                <div className="space-y-3 mb-4 pl-2.5 border-l border-primary/20">
                  {hasSpotlightResponse && (
                    <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                      <CornerDownRight size={12} /> Community Comments (
                      {commentsToDisplayInThread.length})
                    </div>
                  )}
                  {commentsToDisplayInThread.map((comment) => (
                    <div key={comment.id} className="pl-3">
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-xs font-bold text-text-muted font-mono">
                          {getGhostDisplayName(comment.ghost_id)}
                        </span>
                        {ownerGhostId && comment.ghost_id === ownerGhostId && (
                          <Badge tone="primary">
                            {viewerIsOwner ? "You" : ownerBadgeLabel}
                          </Badge>
                        )}
                        <span className="text-[10px] text-text-muted/60">
                          {new Date(comment.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-text-tertiary">
                        {comment.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {canComment && onCommentInputChange && onSubmitComment && (
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Write a reply..."
                    value={commentInputs[post.id] || ""}
                    onChange={(e) =>
                      onCommentInputChange(post.id, e.target.value)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        onSubmitComment(post.id);
                      }
                    }}
                    className="flex-1 text-xs"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onSubmitComment(post.id)}
                    disabled={!commentInputs[post.id]?.trim()}
                  >
                    <Send size={14} />
                  </Button>
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
