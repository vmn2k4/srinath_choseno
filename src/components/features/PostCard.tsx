import { Users, ShieldCheck, CornerDownRight, Award } from "lucide-react";
import Card from "@/components/primitives/Card";
import Badge from "@/components/primitives/Badge";
import LinkPreview, { type LinkMetadata } from "./LinkPreview";
import VoteBar from "./VoteBar";
import CommentComposer from "./CommentComposer";
import MediaThumbnail from "./MediaThumbnail";
import { getGhostDisplayName } from "@/lib/utils/ghostName";
import { normalizeMediaUrl } from "@/lib/services/video";
import type { Database } from "@/lib/supabase/types";

type PostRow = Database["public"]["Tables"]["posts"]["Row"];
type CommentRow = Database["public"]["Tables"]["comments"]["Row"];
export type PostWithComments = PostRow & { comments?: CommentRow[] | null };

// Unifies what were two independently-implemented ~80%-identical post cards:
// FeedPage.jsx's inline post markup (vote bar, civic-score badge) and
// WallPostFeed.jsx's card (owner spotlight section, no voting). Parameterized
// by `showVoteBar`/`onVote` for the Feed case and `ownerGhostId` for the
// Wall/CandidacyWall case — a plain Feed post simply never sets
// `ownerGhostId`, so the spotlight/owner-badge logic below is a no-op for it
// rather than a separate code path.
export default function PostCard({
  post,
  ownerGhostId,
  ownerBadgeLabel = "Candidate",
  viewerIsOwner = false,
  showVoteBar = false,
  onVote,
  canComment = true,
  commentValue,
  onCommentChange,
  onSubmitComment,
  onMediaClick,
}: {
  post: PostWithComments;
  ownerGhostId?: string | null;
  ownerBadgeLabel?: string;
  viewerIsOwner?: boolean;
  showVoteBar?: boolean;
  onVote?: (postId: string, voteType: 1 | -1) => void;
  canComment?: boolean;
  commentValue: string;
  onCommentChange: (value: string) => void;
  onSubmitComment: () => void;
  onMediaClick?: (url: string) => void;
}) {
  const isOwnerPost = ownerGhostId != null && post.ghost_id === ownerGhostId;
  const comments = post.comments || [];
  const byDate = (a: CommentRow, b: CommentRow) =>
    new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();

  const candidateReplies = ownerGhostId
    ? comments
        .filter((c) => c.ghost_id === ownerGhostId || (isOwnerPost && c.ghost_id === post.ghost_id))
        .sort(byDate)
    : [];
  const hasSpotlightResponse = candidateReplies.length > 0;
  const generalComments = comments
    .filter((c) => !candidateReplies.some((cr) => cr.id === c.id))
    .sort(byDate);
  const commentsToDisplayInThread = hasSpotlightResponse
    ? generalComments
    : [...candidateReplies, ...generalComments];

  const linkMetadata = post.link_metadata as unknown as LinkMetadata | null;
  const inlineUrlMatch = !linkMetadata && post.content?.match(/(https?:\/\/[^\s]+)/);

  return (
    <Card interactive padding="none" className="overflow-hidden">
      <div className="p-5">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-full bg-surface/50 flex items-center justify-center border border-border-light/30 shrink-0">
            <Users size={14} className="text-text-muted" />
          </div>
          <div>
            <span className="text-sm font-bold text-text-secondary font-mono">
              {getGhostDisplayName(post.ghost_id)}
            </span>
            {isOwnerPost && (
              <Badge tone="primary" className="ml-2">
                {ownerBadgeLabel}
              </Badge>
            )}
            <span className="text-xs text-text-muted ml-2.5">
              {post.created_at ? new Date(post.created_at).toLocaleDateString() : ""}
            </span>
            {post.civic_score_snapshot != null && (
              <span
                className="text-xs text-text-muted ml-2.5 inline-flex items-center gap-1"
                title="Poster's civic score at the time of posting"
              >
                <Award size={11} className="text-primary-light" /> {post.civic_score_snapshot}
              </span>
            )}
          </div>
        </div>

        <p className="text-text-tertiary text-sm whitespace-pre-wrap leading-relaxed mb-3">
          {post.content}
        </p>

        {(post.image_url || post.video_url) && (
          <div className="mb-4 flex gap-3 items-start flex-wrap">
            {post.image_url && (
              <MediaThumbnail
                url={post.image_url}
                type="image"
                alt="Post Attachment"
                onClick={() => onMediaClick?.(normalizeMediaUrl(post.image_url))}
              />
            )}

            {post.video_url && (
              <MediaThumbnail
                url={post.video_url}
                type="video"
                onClick={() => onMediaClick?.(normalizeMediaUrl(post.video_url))}
              />
            )}
          </div>
        )}

        {linkMetadata ? (
          <div className="mb-4">
            <LinkPreview url={linkMetadata.url} metadata={linkMetadata} />
          </div>
        ) : inlineUrlMatch ? (
          <div className="mb-4">
            <LinkPreview url={inlineUrlMatch[1]} />
          </div>
        ) : null}

        {hasSpotlightResponse && (
          <div className="mt-4 p-4 bg-primary/10 border border-primary/30 rounded-xl space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary-light">
                <ShieldCheck size={16} />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Official Candidate Response
                </span>
              </div>
              <Badge tone="primary">{viewerIsOwner ? "You (Candidate)" : ownerBadgeLabel}</Badge>
            </div>
            <div className="space-y-3">
              {candidateReplies.map((reply) => (
                <div key={reply.id} className="pl-3 border-l-2 border-primary/50 space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-bold text-text-main font-mono">
                      {getGhostDisplayName(reply.ghost_id)}
                    </span>
                    <span className="text-[10px] text-text-muted">
                      {reply.created_at ? new Date(reply.created_at).toLocaleString() : ""}
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
      </div>

      {showVoteBar && (
        <VoteBar
          likesCount={post.likes_count ?? 0}
          dislikesCount={post.dislikes_count ?? 0}
          commentsCount={comments.length}
          onUpvote={() => onVote?.(post.id, 1)}
          onDownvote={() => onVote?.(post.id, -1)}
        />
      )}

      <div className="bg-surface/10 p-4 border-t border-border-light/20">
        {commentsToDisplayInThread.length > 0 && (
          <div className="space-y-3 mb-4 pl-2.5 border-l border-primary/20">
            {hasSpotlightResponse && (
              <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                <CornerDownRight size={12} /> Community Comments ({commentsToDisplayInThread.length})
              </div>
            )}
            {commentsToDisplayInThread.map((comment) => (
              <div key={comment.id} className="pl-3">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-xs font-bold text-text-muted font-mono">
                    {getGhostDisplayName(comment.ghost_id)}
                  </span>
                  {ownerGhostId && comment.ghost_id === ownerGhostId && (
                    <Badge tone="primary">{viewerIsOwner ? "You" : ownerBadgeLabel}</Badge>
                  )}
                  <span className="text-[10px] text-text-muted/60">
                    {comment.created_at ? new Date(comment.created_at).toLocaleString() : ""}
                  </span>
                </div>
                <p className="text-sm text-text-tertiary">{comment.content}</p>
              </div>
            ))}
          </div>
        )}

        {canComment && (
          <CommentComposer
            value={commentValue}
            onChange={onCommentChange}
            onSubmit={onSubmitComment}
            placeholder={viewerIsOwner ? "Reply officially as Candidate..." : "Write an anonymous comment..."}
          />
        )}
      </div>
    </Card>
  );
}
