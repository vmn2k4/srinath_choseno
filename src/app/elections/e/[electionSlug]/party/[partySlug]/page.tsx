import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Card, Badge, Avatar } from "@/components/primitives";
import PartyRosterClient from "@/components/features/PartyRosterClient";
import ElectionBreadcrumb from "@/components/features/ElectionBreadcrumb";
import FaqSection from "@/components/features/FaqSection";
import FindDistrictPromo from "@/components/features/FindDistrictPromo";
import JsonLdScript from "@/components/features/JsonLdScript";
import { buildPartyView, partyTone, summarizeParties } from "@/lib/utils/electionParties";
import { clip, formatElectionDate, hubPath, partyFacts, partyJsonLd, partyPath } from "@/lib/utils/electionPartySeo";
import { extractPartyIdFromSlug, UNAFFILIATED_PARTY_SLUG } from "@/lib/utils/slugs";
import { SITE_URL } from "@/lib/constants/site";
import { loadElection } from "../../loadElection";

export const revalidate = 86400; // daily; /api/revalidate/elections refreshes sooner when the roster changes

// Without this export Next renders a dynamic-segment route on every request
// and ignores `revalidate`. An empty list prerenders nothing at build time
// but lets each URL be generated once on first visit, then served from the
// cache (ISR) until `revalidate` expires.
export function generateStaticParams() {
  return [];
}

interface PageProps {
  params: Promise<{ electionSlug: string; partySlug: string }>;
}

async function resolve(electionSlug: string, partySlug: string) {
  const data = await loadElection(electionSlug);
  if (!data) return null;
  const parties = summarizeParties(data.roster);
  // Match on the numeric id (or "unaffiliated"), not the full slug text, so
  // a renamed party's old links keep working.
  const partyId = extractPartyIdFromSlug(partySlug);
  const party = parties.find((p) => p.id === partyId && (partyId != null || partySlug === UNAFFILIATED_PARTY_SLUG));
  if (!party) return null;
  return { ...data, parties, party };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { electionSlug, partySlug } = await params;
  const data = await resolve(electionSlug, partySlug);
  if (!data) return { title: "Party Not Found | Choseno", robots: { index: false } };

  const { election, party, roster, seats } = data;
  const races = seats.length || new Set(roster.map((c) => c.seatId)).size;
  const { summary } = partyFacts(election, party, buildPartyView(roster, seats, party.slug), races);
  const title = `${party.name} Candidates — ${election.name} | Choseno`;
  const description = clip(summary);
  const url = `${SITE_URL}${partyPath(election, party)}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: "Choseno", type: "website", images: [{ url: `${SITE_URL}/og-elections.jpg`, width: 1200, height: 630, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [`${SITE_URL}/og-elections.jpg`] },
  };
}

export default async function ElectionPartyPage({ params }: PageProps) {
  const { electionSlug, partySlug } = await params;
  const data = await resolve(electionSlug, partySlug);
  if (!data) notFound();

  const { election, roster, seats, parties, party } = data;
  const tone = partyTone(party.name, party.id);
  const view = buildPartyView(roster, seats, party.slug);
  const totalRaces = seats.length || new Set(roster.map((c) => c.seatId)).size;
  const coverage = totalRaces > 0 ? Math.round((party.raceCount / totalRaces) * 100) : 0;
  const rivalHrefs = Object.fromEntries(parties.map((p) => [p.slug, partyPath(election, p)]));
  const { summary, faqs } = partyFacts(election, party, view, totalRaces);
  const date = formatElectionDate(election.election_date);
  const otherParties = parties.filter((p) => p.slug !== party.slug);

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 space-y-6">
      <JsonLdScript data={partyJsonLd(election, party, party.candidates, summary, faqs)} />

      <ElectionBreadcrumb
        items={[{ name: "Elections", href: "/elections" }, { name: election.name, href: hubPath(election) }, { name: party.name }]}
      />

      <Card variant="hero" padding="none" as="header">
        <div className={`h-2 w-full ${tone.bar}`} aria-hidden />
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge tone="neutral">Party</Badge>
            {date && (
              <span className="inline-flex items-center gap-1.5 text-sm text-text-muted">
                <CalendarDays size={14} /> {election.name} · <time dateTime={election.election_date || undefined}>{date}</time>
              </span>
            )}
          </div>
          <h1 className={`font-display text-3xl sm:text-5xl font-bold leading-tight ${tone.text}`}>
            {party.name} candidates
          </h1>
          <p className="mt-3 max-w-3xl text-text-secondary leading-relaxed">{summary}</p>

          <dl className="mt-6 grid grid-cols-3 gap-4 max-w-xl">
            <div>
              <dt className="text-xs uppercase tracking-wider text-text-muted">Candidates</dt>
              <dd className="font-display text-3xl font-bold text-text-main">{party.candidates.length}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-text-muted">Races</dt>
              <dd className="font-display text-3xl font-bold text-text-main">
                {party.raceCount}
                <span className="text-lg text-text-muted"> / {totalRaces}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-text-muted">Coverage</dt>
              <dd className="font-display text-3xl font-bold text-text-main">{coverage}%</dd>
            </div>
          </dl>
          <div className="mt-4 h-2 max-w-xl overflow-hidden rounded-full bg-surface-active" role="presentation">
            <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${coverage}%` }} />
          </div>

          <div className="mt-6 flex -space-x-2 overflow-hidden [&>*:nth-child(n+8)]:hidden sm:[&>*:nth-child(n+8)]:block">
            {party.candidates.slice(0, 12).map((c) => (
              <Link key={c.id} href={c.href} title={c.name}>
                <Avatar src={c.avatarUrl} name={c.name} size="md" className="ring-2 ring-surface" />
              </Link>
            ))}
          </div>
        </div>
      </Card>

      <FindDistrictPromo
        title={`Which ${party.name} candidate is on your ballot?`}
        description="Find your district to see every race you can vote in, from mayor to MLA, and the candidates running in it."
      />

      <PartyRosterClient partyName={party.name} partyId={party.id} view={view} rivalHrefs={rivalHrefs} />

      <FaqSection faqs={faqs} heading={`${party.name} in the ${election.name} — frequently asked questions`} />

      {otherParties.length > 0 && (
        <nav aria-labelledby="other-parties-heading">
          <h2 id="other-parties-heading" className="mb-3 text-xl font-bold text-text-main">
            Other parties in the {election.name}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {otherParties.map((p) => {
              const t = partyTone(p.name, p.id);
              return (
                <li key={p.slug}>
                  <Link
                    href={partyPath(election, p)}
                    className={`inline-flex items-center gap-2 rounded-full border bg-surface/40 px-3 py-1.5 text-sm transition-colors hover:bg-surface-hover ${t.border}`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${t.bar}`} aria-hidden />
                    <span className="font-semibold text-text-main">{p.name}</span>
                    <span className="text-xs text-text-muted">{p.candidates.length}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
