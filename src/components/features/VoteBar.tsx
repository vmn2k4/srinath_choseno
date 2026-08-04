import { ThumbsUp, ThumbsDown, MessageSquare } from "lucide-react";

// Extracted from FeedPage.jsx's inline action bar — the vote/comment-count
// row below a Feed post. Not used by WallPostFeed (candidacy/wall posts
// aren't voteable), which is why PostCard takes this as an optional slot
// rather than baking it in unconditionally.
export default function VoteBar({
  likesCount,
  dislikesCount,
  commentsCount,
  onUpvote,
  onDownvote,
}: {
  likesCount: number;
  dislikesCount: number;
  commentsCount: number;
  onUpvote: () => void;
  onDownvote: () => void;
}) {
  return (
    <div className="px-5 py-3 bg-surface/20 border-t border-border-light/20 flex items-center gap-5">
      <button
        onClick={onUpvote}
        className="flex items-center gap-1.5 text-sm font-semibold text-text-muted hover:text-success transition-colors"
      >
        <ThumbsUp size={16} />
        <span>{likesCount}</span>
      </button>
      <button
        onClick={onDownvote}
        className="flex items-center gap-1.5 text-sm font-semibold text-text-muted hover:text-danger-light transition-colors"
      >
        <ThumbsDown size={16} />
        <span>{dislikesCount}</span>
      </button>
      <div className="flex items-center gap-1.5 text-sm font-semibold text-text-muted ml-auto">
        <MessageSquare size={16} />
        <span>{commentsCount}</span>
      </div>
    </div>
  );
}
