import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Users, ShieldCheck, CornerDownRight, Award, Flag, ArrowRight, Languages, Loader2 } from "lucide-react";
import Card from "@/components/primitives/Card";
import Badge from "@/components/primitives/Badge";
import Button from "@/components/primitives/Button";
import LinkPreview, { type LinkMetadata } from "./LinkPreview";
import VoteBar from "./VoteBar";
import CommentComposer from "./CommentComposer";
import MediaThumbnail from "./MediaThumbnail";
import ReportDialog from "./ReportDialog";
import PostHeader, { type PoliticianAuthorInfo, type NewsAuthorInfo } from "./PostHeader";
import { getGhostDisplayName } from "@/lib/utils/ghostName";
import { normalizeMediaUrl } from "@/lib/services/video";
import { useTranslation } from "@/contexts/LanguageContext";
import type { ReportTargetType } from "@/lib/services/moderation";
import type { Database } from "@/lib/supabase/types";

type PostRow = Database["public"]["Tables"]["posts"]["Row"];
type CommentRow = Database["public"]["Tables"]["comments"]["Row"];
export type PostWithComments = PostRow & {
  comments?: CommentRow[] | null;
  news_articles?: { slug: string; event_date?: string | null; published_at?: string | null } | null;
};

export type PostMention = { politicianId: string; fullName: string; wallHref: string };

// Linkifies the first-typed "@Full Name" occurrence for each of this post's
// resolved mentions (see hydratePostMentions in feed.ts) to that politician's
// wall. Best-effort text match, not a stored offset -- fine for the common
// case (mention inserted via the composer's autocomplete, never hand-edited
// afterward); a name that no longer appears verbatim in the content (e.g.
// the user rewrote around it) just doesn't get linked.
function renderContentWithMentions(content: string, mentions?: PostMention[] | null): ReactNode {
  if (!mentions || mentions.length === 0) return content;

  const names = [...new Set(mentions.map((m) => m.fullName))].sort((a, b) => b.length - a.length);
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`@(${escaped.join("|")})\\b`, "g");

  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) nodes.push(content.slice(lastIndex, match.index));
    const name = match[1];
    const mention = mentions.find((m) => m.fullName === name);
    nodes.push(
      mention ? (
        <Link key={`mention-${key++}`} href={mention.wallHref} className="text-primary font-semibold hover:underline">
          @{name}
        </Link>
      ) : (
        match[0]
      )
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) nodes.push(content.slice(lastIndex));
  return nodes;
}

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
  showVoteBar = true,
  onVote,
  canComment = true,
  commentValue,
  onCommentChange,
  onSubmitComment,
  onMediaClick,
  politicianAuthor,
  onReport,
  commentError,
  boundaryName,
  mentions,
  mentionBadge = false,
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
  onMediaClick?: (url: string, type: "image" | "video") => void;
  politicianAuthor?: PoliticianAuthorInfo | null;
  onReport?: (targetType: ReportTargetType, targetId: string, abuseType: string) => Promise<{ error?: unknown }>;
  commentError?: string;
  boundaryName?: string | null;
  mentions?: PostMention[];
  // True on a politician wall when this post shows up only because someone
  // else @mentioned the wall owner in it (see getMentionedWallPosts) -- not
  // one they authored themselves. Distinguishes it from isOwnerPost's
  // spotlight styling, which means the opposite (they wrote it).
  mentionBadge?: boolean;
}) {
  const { t, locale } = useTranslation();
  const [reportTarget, setReportTarget] = useState<{ targetType: ReportTargetType; targetId: string } | null>(null);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslated, setShowTranslated] = useState(false);

  const handleToggleTranslate = async () => {
    if (translatedText) {
      setShowTranslated((prev) => !prev);
      return;
    }
    if (!post.content) return;

    setIsTranslating(true);
    try {
      const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(post.content)}&langpair=autodetect|${locale}`
      );
      const data = await res.json();
      if (data?.responseData?.translatedText) {
        setTranslatedText(data.responseData.translatedText);
        setShowTranslated(true);
      }
    } catch {
      // Fallback silently if offline or translation API unavailable
    } finally {
      setIsTranslating(false);
    }
  };

  // A news article tagged to this wall is mirrored into a posts row by
  // admin_sync_news_article_tags() (see the news_politician_party_tagging
  // migration) -- news_article_id is the only signal needed to show "News"
  // instead of the ghost name; the row's own ghost_id is a fixed sentinel
  // that never matches a real politician, so isOwnerPost/spotlight below
  // stay false for it as intended. news_articles(slug) is embedded by
  // getWallPosts()/getWallPostBySlugOrId() so the header can link back to
  // the full article.
  const newsAuthor: NewsAuthorInfo | null = post.news_article_id
    ? { articleHref: post.news_articles?.slug ? `/news/${post.news_articles.slug}` : undefined }
    : null;

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

  const displayCreatedAt = post.news_articles?.event_date || post.news_articles?.published_at || post.created_at;

  return (
    <Card interactive padding="none" className="overflow-hidden">
      <div className="p-5">
        {mentionBadge && (
          <Badge tone="accent" size="xs" className="mb-2">
            Tagged in this post
          </Badge>
        )}
        <PostHeader
          ghostId={post.ghost_id}
          createdAt={displayCreatedAt}
          politicianAuthor={politicianAuthor}
          newsAuthor={newsAuthor}
          isOwnerPost={isOwnerPost}
          ownerBadgeLabel={ownerBadgeLabel}
          boundaryName={boundaryName}
          civicScoreSnapshot={post.civic_score_snapshot}
          onReport={onReport ? () => setReportTarget({ targetType: "post", targetId: post.id }) : undefined}
        />

        {newsAuthor && post.content?.includes("\n\n") ? (
          <div className="mb-3 space-y-2">
            <h3 className="text-base sm:text-lg font-semibold text-text-main leading-snug">
              {showTranslated && translatedText ? translatedText.split("\n\n")[0] : post.content.split("\n\n")[0]}
            </h3>
            <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
              {showTranslated && translatedText
                ? translatedText.split("\n\n").slice(1).join("\n\n")
                : renderContentWithMentions(post.content.split("\n\n").slice(1).join("\n\n"), mentions)}
            </p>
          </div>
        ) : (
          <p className="text-text-main text-sm sm:text-base font-normal whitespace-pre-wrap leading-relaxed mb-3">
            {showTranslated && translatedText ? translatedText : renderContentWithMentions(post.content, mentions)}
          </p>
        )}

        {locale !== "en" && post.content && post.content.length > 5 && (
          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={handleToggleTranslate}
              disabled={isTranslating}
              className="inline-flex items-center gap-1.5 text-xs text-primary/80 hover:text-primary transition-colors cursor-pointer font-medium"
            >
              {isTranslating ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  <span>{t("post.translating")}</span>
                </>
              ) : (
                <>
                  <Languages size={12} />
                  <span>{showTranslated ? t("post.original") : t("post.translate")}</span>
                </>
              )}
            </button>
            {showTranslated && (
              <span className="text-[10px] text-text-muted italic">
                ({t("post.translatedBy")})
              </span>
            )}
          </div>
        )}

        {(post.image_url || post.video_url) && (
          <div className="mb-4 flex gap-3 items-start flex-wrap">
            {post.image_url && (
              <MediaThumbnail
                url={post.image_url}
                type="image"
                alt="Post Attachment"
                // News posts carry the article's auto-generated OG card
                // (1200x630, ~1.91:1) as their image_url -- the landscape
                // variant matches that ratio instead of cropping it down
                // through the portrait box every regular photo post uses.
                variant={newsAuthor ? "landscape" : "portrait"}
                onClick={() => onMediaClick?.(normalizeMediaUrl(post.image_url), "image")}
              />
            )}

            {post.video_url && (
              <MediaThumbnail
                url={post.video_url}
                type="video"
                onClick={() => onMediaClick?.(normalizeMediaUrl(post.video_url), "video")}
              />
            )}
          </div>
        )}

        {newsAuthor?.articleHref && (
          <Link
            href={newsAuthor.articleHref}
            className="inline-flex items-center gap-1.5 mb-4 text-xs font-bold text-accent hover:text-accent-hover"
          >
            Read Full Article <ArrowRight size={12} />
          </Link>
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
          <div className="mt-3 p-3 bg-primary/10 border border-primary/30 rounded-xl space-y-2 shadow-sm">
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

      <div className="bg-surface/10 p-3 border-t border-border-light/20">
        {commentsToDisplayInThread.length > 0 && (
          <div className="space-y-2 mb-3 pl-2.5 border-l border-primary/20">
            {hasSpotlightResponse && (
              <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                <CornerDownRight size={12} /> Community Comments ({commentsToDisplayInThread.length})
              </div>
            )}
            {commentsToDisplayInThread.map((comment) => (
              <div key={comment.id} className="pl-3 group/comment">
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
                  {onReport && (
                    <button
                      type="button"
                      onClick={() => setReportTarget({ targetType: "comment", targetId: comment.id })}
                      className="text-text-muted/40 hover:text-danger opacity-0 group-hover/comment:opacity-100 transition-opacity cursor-pointer"
                      title="Report this comment"
                    >
                      <Flag size={11} />
                    </button>
                  )}
                </div>
                <p className="text-sm text-text-main font-medium">{comment.content}</p>
              </div>
            ))}
          </div>
        )}

        {canComment && (
          <>
            <CommentComposer
              value={commentValue}
              onChange={onCommentChange}
              onSubmit={onSubmitComment}
              placeholder={viewerIsOwner ? "Reply officially as Candidate..." : "Write an anonymous comment..."}
            />
            {commentError && <p className="text-danger-light text-xs mt-1.5">{commentError}</p>}
          </>
        )}
      </div>

      {reportTarget && onReport && (
        <ReportDialog
          targetType={reportTarget.targetType}
          targetId={reportTarget.targetId}
          onReport={onReport}
          onClose={() => setReportTarget(null)}
        />
      )}
    </Card>
  );
}
