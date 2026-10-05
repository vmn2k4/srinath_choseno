import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Landmark, Users, Vote } from "lucide-react";
import { Card, Badge, EmptyState } from "@/components/primitives";
import ElectionPartyCard from "@/components/features/ElectionPartyCard";
import ElectionBreadcrumb from "@/components/features/ElectionBreadcrumb";
import FaqSection from "@/components/features/FaqSection";
import FindDistrictPromo from "@/components/features/FindDistrictPromo";
import JsonLdScript from "@/components/features/JsonLdScript";
import { summarizeParties } from "@/lib/utils/electionParties";
import { buildSeatSlug } from "@/lib/utils/slugs";
import { withProvince } from "@/lib/utils/regionLabel";
import { createPublicClient } from "@/lib/supabase/publicServer";
import { getProvinceNamesForShapes } from "@/lib/services/boundaries";
import { clip, formatElectionDate, hubFacts, hubJsonLd, hubPath, partyPath } from "@/lib/utils/electionPartySeo";
import { SITE_URL } from "@/lib/constants/site";
import { loadElection, STATUS_LABELS } from "./loadElection";

export const revalidate = 86400; // daily; /api/revalidate/elections refreshes sooner when the roster changes

// Without this export Next renders a dynamic-segment route on every request
// and ignores `revalidate`. An empty list prerenders nothing at build time
// but lets each URL be generated once on first visit, then served from the
// cache (ISR) until `revalidate` expires.
export function generateStaticParams() {
  return [];
}

interface PageProps {
  params: Promise<{ electionSlug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { electionSlug } = await params;
  const data = await loadElection(electionSlug);
  if (!data) return { title: "Election Not Found | Choseno", robots: { index: false } };

  const { election, roster, seats } = data;
  const parties = summarizeParties(roster);
  const races = seats.length || new Set(roster.map((c) => c.seatId)).size;
  const { summary } = hubFacts(election, parties, roster.length, races);
  const title = `${election.name}: Parties, Candidates & Races | Choseno`;
  const description = clip(summary);
  const url = `${SITE_URL}${hubPath(election)}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    // Nothing to index on an election with no candidates yet.
    robots: roster.length === 0 ? { index: false, follow: true } : undefined,
    // No explicit `images`: the dynamic card in ./opengraph-image.tsx supplies
    // og:image (and twitter:image) from live data.
    openGraph: { title, description, url, siteName: "Choseno", type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ElectionPartiesPage({ params }: PageProps) {
  const { electionSlug } = await params;
  const data = await loadElection(electionSlug);
  if (!data) notFound();

  const { election, roster, seats } = data;
  const parties = summarizeParties(roster);
  const namedCount = parties.filter((p) => p.id != null).length;
  const hasParties = namedCount > 0;
  const totalRaces = seats.length || new Set(roster.map((c) => c.seatId)).size;
  const date = formatElectionDate(election.election_date);
  const { summary, faqs } = hubFacts(election, parties, roster.length, totalRaces);
  const candidateCountBySeat = new Map<string, number>();
  roster.forEach((c) => candidateCountBySeat.set(c.seatId, (candidateCountBySeat.get(c.seatId) || 0) + 1));
  const racesWithCandidates = seats
    .filter((seat) => candidateCountBySeat.has(seat.id))
    .map((seat) => ({ seat, count: candidateCountBySeat.get(seat.id) || 0 }));
  // Province-qualified link text ("Mayor — Victoria, BC"); the href/slug is untouched.
  const shapeIdOf = (seat: unknown) => (seat as { map_shapes?: { id?: number } | null }).map_shapes?.id;
  const provinceByShape = await getProvinceNamesForShapes(
    await createPublicClient(),
    racesWithCandidates.map((r) => shapeIdOf(r.seat)).filter((id): id is number => typeof id === "number")
  );

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 space-y-6">
      {roster.length > 0 && <JsonLdScript data={hubJsonLd(election, parties, summary, faqs)} />}

      <ElectionBreadcrumb items={[{ name: "Elections", href: "/elections" }, { name: election.name }]} />

      <Card variant="hero" padding="lg" as="header">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Badge tone="primary">{STATUS_LABELS[election.status] || election.status}</Badge>
          {date && (
            <span className="inline-flex items-center gap-1.5 text-sm text-text-muted">
              <CalendarDays size={14} /> <time dateTime={election.election_date || undefined}>{date}</time>
            </span>
          )}
        </div>
        <h1 className="font-display text-3xl sm:text-5xl font-bold text-text-main leading-tight">
          {election.name}: parties &amp; candidates
        </h1>
        <p className="mt-3 max-w-3xl text-text-secondary leading-relaxed">{summary}</p>
        <dl className="mt-6 grid grid-cols-3 gap-4 max-w-xl">
          {[
            { icon: Users, label: "Candidates", value: roster.length },
            { icon: Landmark, label: "Parties", value: namedCount },
            { icon: Vote, label: "Races", value: totalRaces },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label}>
              <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-text-muted">
                <Icon size={13} /> {label}
              </dt>
              <dd className="font-display text-3xl font-bold text-primary">{value.toLocaleString()}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {roster.length > 0 && (
        <FindDistrictPromo
          title="Which of these candidates will be on your ballot?"
          description="Find your district to see every race you can vote in, from mayor to MLA, and the candidates running in it."
        />
      )}

      {roster.length === 0 ? (
        <EmptyState icon={Users} title="No candidates yet" description="Candidates will appear here as nominations are confirmed." />
      ) : !hasParties ? (
        <EmptyState
          icon={Landmark}
          title="No party affiliations for this election"
          description="Candidates in this election are running without a listed party. Browse them by race instead."
          action={
            <Link href="/elections" className="text-sm font-semibold text-primary hover:underline">
              Browse races
            </Link>
          }
        />
      ) : (
        <section aria-label="Participating parties" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {parties.map((party) => (
            <ElectionPartyCard key={party.slug} party={party} totalRaces={totalRaces} href={partyPath(election, party)} />
          ))}
        </section>
      )}

      {racesWithCandidates.length > 0 && (
        // Plain crawlable links to every race: this hub is linked from
        // /elections, so it is the path that gets each seat page (and from
        // there each candidate page) discovered, including seats the
        // 300-seat /elections list never reaches.
        <section aria-labelledby="all-races-heading">
          <h2 id="all-races-heading" className="font-display text-2xl font-bold text-text-main mb-3">
            Every race in the {election.name}
          </h2>
          <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {racesWithCandidates.map((r) => (
              <li key={r.seat.id}>
                <Link href={`/elections/seat/${buildSeatSlug(r.seat as Parameters<typeof buildSeatSlug>[0])}`} className="text-primary hover:underline">
                  {r.seat.role_title} — {r.seat.map_shapes?.name ? withProvince(r.seat.map_shapes.name, provinceByShape.get(shapeIdOf(r.seat) ?? -1)) : "District"}
                </Link>
                <span className="text-text-muted"> ({r.count})</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {roster.length > 0 && <FaqSection faqs={faqs} heading={`${election.name} — frequently asked questions`} />}
    </div>
  );
}
