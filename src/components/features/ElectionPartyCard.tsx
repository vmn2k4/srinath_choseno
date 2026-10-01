import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, Avatar } from "@/components/primitives";
import { partyTone, type PartySummary } from "@/lib/utils/electionParties";

// One party tile on the election hub: identity color, how many people it
// is running, how much of the election it covers, and who they are.
// The whole tile is clickable (stretched title link), while the candidate
// names are their own real links -- crawlers get candidate text + links on
// the hub, not just avatars.
export default function ElectionPartyCard({
  party,
  totalRaces,
  href,
}: {
  party: PartySummary;
  totalRaces: number;
  href: string;
}) {
  const tone = partyTone(party.name, party.id);
  const coverage = totalRaces > 0 ? Math.min(100, Math.round((party.raceCount / totalRaces) * 100)) : 0;
  const preview = party.candidates.slice(0, 5);
  const named = party.candidates.slice(0, 6);
  const more = party.candidates.length - named.length;

  return (
    <Card as="article" interactive padding="none" className="group relative flex flex-col overflow-hidden">
      <div className={`h-1.5 w-full ${tone.bar}`} aria-hidden />
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 text-lg font-bold leading-snug text-text-main">
            <Link href={href} className="after:absolute after:inset-0 after:content-['']">
              {party.name}
            </Link>
          </h2>
          <ChevronRight
            size={18}
            className="mt-1 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
          />
        </div>

        <div className="flex items-baseline gap-2">
          <span className={`font-display text-4xl font-bold leading-none ${tone.text}`}>{party.candidates.length}</span>
          <span className="text-sm text-text-muted">{party.candidates.length === 1 ? "candidate" : "candidates"}</span>
        </div>

        {totalRaces > 0 && (
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs text-text-muted">
              <span>
                Running in {party.raceCount} of {totalRaces} races
              </span>
              <span className="font-semibold text-text-secondary">{coverage}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-active" role="presentation">
              <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${coverage}%` }} />
            </div>
          </div>
        )}

        <div className="mt-auto space-y-2">
          <div className="flex -space-x-2" aria-hidden>
            {preview.map((c) => (
              <Avatar key={c.id} src={c.avatarUrl} name={c.name} size="sm" className="ring-2 ring-surface" />
            ))}
          </div>
          <p className="text-xs leading-relaxed text-text-muted">
            {named.map((c, i) => (
              <span key={c.id}>
                {i > 0 && ", "}
                <Link href={c.href} className="relative z-10 text-text-secondary hover:text-primary hover:underline">
                  {c.name}
                </Link>
              </span>
            ))}
            {more > 0 && <span> and {more} more</span>}
          </p>
        </div>
      </div>
    </Card>
  );
}
