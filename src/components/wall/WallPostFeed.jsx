import React from 'react';
import { Users, MessageSquare, Send, ShieldCheck, CornerDownRight } from 'lucide-react';
import LinkPreview from '../LinkPreview';
import { getGhostDisplayName } from '../../utils/ghostName';
import { Card, Badge, Input, Button, EmptyState } from '../ui';

// Shared by PoliticianWall.jsx (a politician's own public wall) and
// CandidacyWall.jsx (a candidate's election wall).
// For ANY post where the candidate replies (or candidate comments exist),
// those replies are promoted to a prominent "Official Candidate Response"
// spotlight section directly below the post content, ensuring the candidate
// always has their authoritative say highlighted.
export default function WallPostFeed({
  posts,
  ownerGhostId,
  ownerBadgeLabel = 'Candidate',
  viewerIsOwner = false,
  emptyMessage = 'No posts yet.',
  canComment = true,
  commentInputs,
  onCommentInputChange,
  onSubmitComment,
}) {
  if (posts.length === 0) {
    return <EmptyState description={emptyMessage} />;
  }

  const byDate = (a, b) => new Date(a.created_at) - new Date(b.created_at);

  return (
    <div className="space-y-6">
      {posts.map(post => {
        const isOwnerPost = post.ghost_id === ownerGhostId;

        // Candidate replies: comments made by the candidate's current or previous ghost ID
        const candidateReplies = (post.comments || []).filter(c =>
          c.ghost_id === ownerGhostId || (isOwnerPost && c.ghost_id === post.ghost_id)
        ).sort(byDate);

        // Community / Constituent comments: all other comments
        const generalComments = (post.comments || []).filter(c =>
          !candidateReplies.some(cr => cr.id === c.id)
        ).sort(byDate);

        // Highlight candidate response in spotlight section whenever candidate replies exist
        const hasSpotlightResponse = candidateReplies.length > 0;
        const commentsToDisplayInThread = hasSpotlightResponse ? generalComments : [...candidateReplies, ...generalComments];

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
                <div className="text-xs text-text-muted">{new Date(post.created_at).toLocaleString()}</div>
              </div>
            </div>

            {/* Post Content */}
            <p className="text-text-tertiary text-sm whitespace-pre-wrap leading-relaxed mb-3">{post.content}</p>

            {post.image_url && (
              <div className="mb-4 rounded-xl overflow-hidden border border-border-light/45">
                <img src={post.image_url} alt="Post Attachment" className="w-full max-h-[500px] object-cover" loading="lazy" />
              </div>
            )}

            {post.link_metadata ? (
              <div className="mb-4"><LinkPreview url={post.link_metadata.url} metadata={post.link_metadata} /></div>
            ) : (() => {
              const match = post.content?.match(/(https?:\/\/[^\s]+)/);
              return match ? <div className="mb-4"><LinkPreview url={match[1]} /></div> : null;
            })()}

            {post.video_url && (
              <div className="mt-3 rounded-xl overflow-hidden border border-border-light/45 bg-black">
                <video src={post.video_url} controls className="w-full max-h-96 object-contain" />
              </div>
            )}

            {/* SPECIAL SPOTLIGHT SECTION: Official Candidate Response */}
            {hasSpotlightResponse && (
              <div className="mt-4 p-4 bg-primary/10 border border-primary/30 rounded-xl space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-primary-light">
                    <ShieldCheck size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Official Candidate Response
                    </span>
                  </div>
                  <Badge tone="primary">{viewerIsOwner ? 'You (Candidate)' : ownerBadgeLabel}</Badge>
                </div>
                <div className="space-y-3">
                  {candidateReplies.map(reply => (
                    <div key={reply.id} className="pl-3 border-l-2 border-primary/50 space-y-1">
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
                      <CornerDownRight size={12} /> Community Comments ({commentsToDisplayInThread.length})
                    </div>
                  )}
                  {commentsToDisplayInThread.map(comment => (
                    <div key={comment.id} className="pl-3">
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-xs font-bold text-text-muted font-mono">
                          {getGhostDisplayName(comment.ghost_id)}
                        </span>
                        {comment.ghost_id === ownerGhostId && (
                          <Badge tone="primary">{viewerIsOwner ? 'You' : ownerBadgeLabel}</Badge>
                        )}
                        <span className="text-[10px] text-text-muted/60">
                          {new Date(comment.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-text-tertiary">{comment.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {canComment && (
                <div className="flex items-center gap-2">
                  <MessageSquare size={14} className="text-text-muted shrink-0" />
                  <Input
                    type="text"
                    size="sm"
                    value={commentInputs[post.id] || ''}
                    onChange={(e) => onCommentInputChange(post.id, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') onSubmitComment(post.id); }}
                    placeholder={viewerIsOwner ? "Reply officially as Candidate..." : "Write an anonymous comment..."}
                    className="flex-1"
                  />
                  <Button
                    variant="icon"
                    tone="primary"
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
