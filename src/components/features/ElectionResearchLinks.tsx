import Link from "next/link";
import { Newspaper, ArrowRight } from "lucide-react";
import { Card } from "@/components/primitives";
import type { ElectionResearchLink } from "@/lib/constants/electionResearch";

// Crawlable link cards to the "why people support / oppose" research articles.
export default function ElectionResearchLinks({
  heading,
  links,
  className,
}: {
  heading: string;
  links: ElectionResearchLink[];
  className?: string;
}) {
  if (!links.length) return null;
  return (
    <section aria-labelledby="election-research-heading" className={className}>
      <h2 id="election-research-heading" className="mb-3 flex items-center gap-2 text-xl font-bold text-text-main">
        <Newspaper size={18} className="text-primary" /> {heading}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {links.map((l) => (
          <Link key={l.slug} href={`/news/${l.slug}`} className="block group">
            <Card padding="md" className="h-full transition-colors group-hover:bg-surface-hover">
              <p className="font-semibold text-text-main group-hover:text-primary">{l.title}</p>
              <p className="mt-1 text-sm text-text-muted">{l.blurb}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary">
                Read and vote in the poll <ArrowRight size={12} />
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
