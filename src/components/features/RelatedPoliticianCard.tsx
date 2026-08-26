import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, Avatar, Badge } from "@/components/primitives";
import type { RelatedPolitician } from "@/lib/services/politicians";

// One compact "related person" tile for the wall page's Related People rail
// (see PoliticianWallClient's empty-wall motivation section). Kept as its
// own file rather than inlined in the wall page, the same reasoning
// NewsArticleCard already documents for itself: this shape (avatar, role,
// jurisdiction, party, link to their wall) is generic enough that a future
// "similar politicians" widget elsewhere (search results, party pages)
// can reuse it instead of growing a second near-duplicate card.
export default function RelatedPoliticianCard({ politician }: { politician: RelatedPolitician }) {
  return (
    <Card
      as={Link}
      href={politician.wallHref}
      interactive
      padding="sm"
      className="group flex items-center gap-3 hover:border-primary/40 transition-all duration-200"
    >
      <Avatar src={politician.photoUrl} name={politician.fullName} size="md" className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-text-main truncate group-hover:text-primary transition-colors">
          {politician.fullName}
        </p>
        <p className="text-xs text-text-muted truncate">
          {[politician.roleTitle, politician.jurisdictionName].filter(Boolean).join(" · ") || "Public leader"}
        </p>
        {politician.partyName && (
          <Badge tone="neutral" size="xs" className="mt-1">
            {politician.partyName}
          </Badge>
        )}
      </div>
      <ArrowRight size={14} className="shrink-0 text-text-muted group-hover:text-primary transition-colors" />
    </Card>
  );
}
