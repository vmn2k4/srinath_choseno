import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Users } from "lucide-react";
import { Card, EmptyState } from "@/components/primitives";
import ElectionBreadcrumb from "@/components/features/ElectionBreadcrumb";
import FaqSection from "@/components/features/FaqSection";
import DistrictRacesBanner from "@/components/features/DistrictRacesBanner";
import JsonLdScript from "@/components/features/JsonLdScript";
import RidingCandidatesTable, { type RidingRow } from "@/components/features/RidingCandidatesTable";
import { summarizeParties } from "@/lib/utils/electionParties";
import { buildSeatSlug } from "@/lib/utils/slugs";
import { withProvince } from "@/lib/utils/regionLabel";
import { createPublicClient } from "@/lib/supabase/publicServer";
import { getProvinceNamesForShapes } from "@/lib/services/boundaries";
import { formatElectionDate, hubPath, ridingsPath } from "@/lib/utils/electionPartySeo";
import {
  areaNounForSeats,
  ridingsDescription,
  ridingsFacts,
  ridingsJsonLd,
  ridingsTitle,
} from "@/lib/utils/electionRidingsSeo";
import { SITE_URL } from "@/lib/constants/site";
import { loadElection } from "../loadElection";

export const revalidate = 86400; // daily; /api/revalidate/elections refreshes sooner when the roster changes

// Same ISR opt-in as the election hub: nothing prerendered, each election's
// page is generated on first visit and then served from cache. Every election
// gets this page automatically -- there is nothing to configure per election.
export function generateStaticParams() {
  return [];
}

interface PageProps {
  params: Promise<{ electionSlug: string }>;
}

const lastWord = (name: string) => name.trim().split(/\s+/).pop()?.toLowerCase() || "";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { electionSlug } = await params;
  const data = await loadElection(electionSlug);
  if (!data) return { title: "Election Not Found | Choseno", robots: { index: false } };

  const { election, roster, seats } = data;
  const noun = areaNounForSeats(seats);
  const races = new Set(roster.map((c) => c.seatId)).size;
  const title = ridingsTitle(election, noun);
  const description = ridingsDescription(election, noun, roster.length, races);
  const url = `${SITE_URL}${ridingsPath(election)}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    // Nothing to list for an election with no candidates yet (mirrors the hub).
    robots: roster.length === 0 ? { index: false, follow: true } : undefined,
    openGraph: { title, description, url, siteName: "Choseno", type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function WhoIsRunningPage({ params }: PageProps) {
  const { electionSlug } = await params;
  const data = await loadElection(electionSlug);
  if (!data) notFound();

  const { election, roster, seats } = data;
  const noun = areaNounForSeats(seats);
  const parties = summarizeParties(roster);
  const partyCount = parties.filter((p) => p.id != null).length;
  const date = formatElectionDate(election.election_date);

  const bySeat = new Map<string, typeof roster>();
  roster.forEach((c) => bySeat.set(c.seatId, [...(bySeat.get(c.seatId) ?? []), c]));
  const seatsWithCandidates = seats.filter((s) => bySeat.has(s.id));
  const shapeIdOf = (seat: unknown) => (seat as { map_shapes?: { id?: number } | null }).map_shapes?.id;
  const provinceByShape = await getProvinceNamesForShapes(
    await createPublicClient(),
    seatsWithCandidates.map((s) => shapeIdOf(s)).filter((id): id is number => typeof id === "number")
  );

  const rows: RidingRow[] = seatsWithCandidates
    .map((seat) => ({
      seatId: seat.id,
      href: `/elections/seat/${buildSeatSlug(seat as Parameters<typeof buildSeatSlug>[0])}`,
      areaLabel: seat.map_shapes?.name
        ? withProvince(seat.map_shapes.name, provinceByShape.get(shapeIdOf(seat) ?? -1))
        : "Unnamed area",
      roleTitle: seat.role_title,
      // Alphabetical by surname: neutral, since ballot order is not known here.
      candidates: [...(bySeat.get(seat.id) ?? [])]
        .sort((a, b) => lastWord(a.name).localeCompare(lastWord(b.name)) || a.name.localeCompare(b.name))
        .map((c) => ({ id: c.id, name: c.name, href: c.href, partyId: c.partyId, partyName: c.partyName })),
    }))
    .sort((a, b) => a.areaLabel.localeCompare(b.areaLabel) || a.roleTitle.localeCompare(b.roleTitle));
  const showRole = new Set(rows.map((r) => r.roleTitle)).size > 1;

  const { summary, faqs } = ridingsFacts(election, noun, roster.length, rows.length, partyCount);

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 space-y-6">
      {roster.length > 0 && (
        <JsonLdScript
          data={ridingsJsonLd(
            election,
            noun,
            summary,
            faqs,
            rows.map((r) => ({ name: `${r.roleTitle} — ${r.areaLabel}`, path: r.href }))
          )}
        />
      )}

      <ElectionBreadcrumb
        items={[
          { name: "Elections", href: "/elections" },
          { name: election.name, href: hubPath(election) },
          { name: `Who's running in my ${noun.singular}` },
        ]}
      />

      <Card variant="hero" padding="lg" as="header">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {date && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-secondary">
              <CalendarDays size={14} /> Election day: <time dateTime={election.election_date || undefined}>{date}</time>
            </span>
          )}
        </div>
        <h1 className="font-display text-3xl sm:text-5xl font-bold text-text-main leading-tight">
          Who&apos;s running in my {noun.singular}? {election.name}
        </h1>
        <p className="mt-3 max-w-3xl text-text-secondary leading-relaxed">{summary}</p>
        <p className="mt-3 text-sm">
          <Link href={hubPath(election)} className="font-semibold text-primary hover:underline">
            Browse the {election.name} by party →
          </Link>
        </p>
      </Card>

      {roster.length > 0 && (
        <DistrictRacesBanner
          title={`Which ${noun.singular} am I in?`}
          description={`Find your district to see every race you can vote in and the candidates running in it.`}
        />
      )}

      {rows.length === 0 ? (
        <EmptyState icon={Users} title="No candidates yet" description="Candidates will appear here as nominations are confirmed." />
      ) : (
        <RidingCandidatesTable rows={rows} nounTitle={noun.title} showRole={showRole} />
      )}

      {roster.length > 0 && <FaqSection faqs={faqs} heading={`Who's running in my ${noun.singular}? Common questions`} />}
    </div>
  );
}
