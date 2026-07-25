import React from 'react';
import { Users, MessageSquare, Send } from 'lucide-react';
import LinkPreview from '../LinkPreview';

// Shared by PoliticianWall.jsx (a politician's own public wall) and
// CandidacyWall.jsx (a candidate's election wall) -- both are "the same
// wall": the owner's own replies always sort to the top of a post's comment
// thread, ahead of everyone else's, so a reply to a review is the first
// thing a visitor sees. Purely presentational -- posts/comments are fetched
// by the parent page, this component only renders them and reports comment
// input back up via callbacks.
export default function WallPostFeed({
  posts,
  ownerGhostId,
  ownerBadgeLabel = 'Author',
  viewerIsOwner = false,
  emptyMessage = 'No posts yet.',
  commentInputs,
  onCommentInputChange,
  onSubmitComment,
}) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-10 text-text-muted text-sm bg-surface/20 rounded-2xl border border-dashed border-border-light/60">
        {emptyMessage}
      </div>
    );
  }

  const byDate = (a, b) => new Date(a.created_at) - new Date(b.created_at);

  return (
    <div className="space-y-6">
      {posts.map(post => {
        const mine = (post.comments || []).filter(c => c.ghost_id === ownerGhostId).sort(byDate);
        const others = (post.comments || []).filter(c => c.ghost_id !== ownerGhostId).sort(byDate);
        const sortedComments = [...mine, ...others];
        const isOwnerPost = post.ghost_id === ownerGhostId;

        return (
          <div key={post.id} className="bg-surface/30 backdrop-blur-md rounded-2xl border border-border-light/40 overflow-hidden p-5 hover:border-primary/25 transition-all duration-300 shadow-md">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-surface/50 border border-border-light/30 flex items-center justify-center">
                <Users size={16} className="text-text-muted" />
              </div>
              <div>
                <div className="text-sm font-bold text-text-secondary font-mono">
                  Ghost-{post.ghost_id.split('-')[0]}
                  {isOwnerPost && (
                    <span className="ml-2 text-[10px] bg-primary/20 text-primary-light px-2 py-0.5 rounded uppercase tracking-wider font-bold">{ownerBadgeLabel}</span>
                  )}
                </div>
                <div className="text-xs text-text-muted">{new Date(post.created_at).toLocaleString()}</div>
              </div>
            </div>

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

            {/* Comments -- the owner's own replies always lead. */}
            <div className="mt-4 pt-4 border-t border-border-light/20">
              {sortedComments.length > 0 && (
                <div className="space-y-3 mb-4 pl-2.5 border-l border-primary/30">
                  {sortedComments.map(comment => (
                    <div key={comment.id} className="pl-3">
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-xs font-bold text-text-muted font-mono">
                          Ghost-{comment.ghost_id.split('-')[0]}
                        </span>
                        {comment.ghost_id === ownerGhostId && (
                          <span className="text-[9px] bg-primary/20 text-primary-light px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">
                            {viewerIsOwner ? 'You' : ownerBadgeLabel}
                          </span>
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

              <div className="flex items-center gap-2">
                <MessageSquare size={14} className="text-text-muted shrink-0" />
                <input
                  type="text"
                  value={commentInputs[post.id] || ''}
                  onChange={(e) => onCommentInputChange(post.id, e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onSubmitComment(post.id); }}
                  placeholder="Write an anonymous comment..."
                  className="flex-1 bg-surface/50 border border-border-light/40 rounded-xl px-3 py-2 text-sm text-text-secondary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
                />
                <button
                  onClick={() => onSubmitComment(post.id)}
                  disabled={!commentInputs[post.id]?.trim()}
                  className="p-2 bg-primary/10 text-primary-light hover:bg-primary hover:text-slate-950 rounded-xl transition-all disabled:opacity-40"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
