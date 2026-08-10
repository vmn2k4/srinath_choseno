import Link from "next/link";
import { Users, Award, Flag, Newspaper } from "lucide-react";
import Badge from "@/components/primitives/Badge";
import Button from "@/components/primitives/Button";
import { getGhostDisplayName } from "@/lib/utils/ghostName";

export interface PoliticianAuthorInfo {
  fullName: string;
  wallHref: string;
}

export interface NewsAuthorInfo {
  articleHref?: string;
}

export default function PostHeader({
  ghostId,
  createdAt,
  politicianAuthor,
  newsAuthor,
  isOwnerPost = false,
  ownerBadgeLabel = "Candidate",
  boundaryName,
  civicScoreSnapshot,
  onReport,
}: {
  ghostId: string;
  createdAt?: string | null;
  politicianAuthor?: PoliticianAuthorInfo | null;
  newsAuthor?: NewsAuthorInfo | null;
  isOwnerPost?: boolean;
  ownerBadgeLabel?: string;
  boundaryName?: string | null;
  civicScoreSnapshot?: number | null;
  onReport?: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <div className="w-8 h-8 rounded-full bg-surface/50 flex items-center justify-center border border-border-light/30 shrink-0">
        {newsAuthor ? (
          <Newspaper size={14} className="text-accent" />
        ) : (
          <Users size={14} className="text-text-muted" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        {newsAuthor ? (
          <>
            <span className="text-sm font-bold text-accent">News</span>
            <Badge tone="accent" className="ml-2">
              News
            </Badge>
          </>
        ) : politicianAuthor ? (
          <>
            <Link
              href={politicianAuthor.wallHref}
              className="text-sm font-bold text-primary hover:underline"
            >
              {politicianAuthor.fullName}
            </Link>
            <Badge tone="primary" className="ml-2">
              Politician
            </Badge>
          </>
        ) : (
          <span className="text-sm font-bold text-text-secondary font-mono">
            {getGhostDisplayName(ghostId)}
          </span>
        )}
        {isOwnerPost && !politicianAuthor && (
          <Badge tone="primary" className="ml-2">
            {ownerBadgeLabel}
          </Badge>
        )}
        <span className="text-xs text-text-muted ml-2.5">
          {createdAt ? new Date(createdAt).toLocaleDateString() : ""}
        </span>
        {boundaryName && (
          <span className="text-xs text-accent ml-2.5 font-medium">
            📍 {boundaryName}
          </span>
        )}
        {civicScoreSnapshot != null && (
          <span
            className="text-xs text-text-muted ml-2.5 inline-flex items-center gap-1"
            title="Poster's civic score at the time of posting"
          >
            <Award size={11} className="text-primary-light" /> {civicScoreSnapshot}
          </span>
        )}
      </div>
      {onReport && (
        <Button
          variant="icon"
          size="sm"
          tone="danger"
          onClick={onReport}
          title="Report this post"
        >
          <Flag size={14} />
        </Button>
      )}
    </div>
  );
}
