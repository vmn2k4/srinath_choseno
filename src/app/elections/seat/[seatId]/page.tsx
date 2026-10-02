import { Metadata } from "next";
import { redirect } from "next/navigation";
import { cache } from "react";
import ElectionSeatPageClient from "@/components/features/ElectionSeatPageClient";
import { createPublicClient } from "@/lib/supabase/publicServer";
import { getSeatById, getCandidatesBySeatIds, getOfficeHoldersForShape } from "@/lib/services/elections";
import { buildRaceDescription, buildRaceParagraphs, buildRaceTitle, buildCandidateTitle, longDate, type RaceFacts } from "@/lib/utils/seatRaceSeo";
import { getPoliticianEngagementSummaries } from "@/lib/services/ratings";
import {
  buildSeatSlug,
  buildCandidateSlug,
  buildPoliticianWallSlug,
  extractIdFromSlug,
} from "@/lib/utils/slugs";
import { SITE_URL } from "@/lib/constants/site";

const BASE_URL = SITE_URL;

// election_candidates/election_seats/elections all share a "status <>
// 'draft' OR is-admin" RLS branch (an admin previewing a still-draft
// election is the one case this client can't see -- the anon session has
// no admin bypass). Safe here anyway: ElectionSeatPageClient re-fetches
// everything client-side on mount using the browser's own authenticated
// session regardless of what this SSR shell returned, so an admin viewing
// a draft election sees a brief loading state instead of instant content,
// never wrong/missing content. Everyone else (the overwhelming majority —
// non-draft elections, non-admin visitors) gets the real caching win.
export const revalidate = 300;

interface SeatPageProps {
  params: Promise<{ seatId: string }>;
  searchParams: Promise<{ candidate?: string }>;
}

// generateMetadata and the page component below both need the seat +
// candidates for the same seatId. Deduped via React cache() so it's one
// pair of DB round trips per request instead of two.
const getSeatWithCandidates = cache(async (seatId: string) => {
  const supabase = await createPublicClient();
  const { data: seat } = await getSeatById(supabase, seatId);
  const { data: candidates } = await getCandidatesBySeatIds(
    supabase,
    seat?.id ? [seat.id] : []
  );

  // Community-support numbers for the Results tab / SEO & AI-crawler text
  // below. Reuses the same politician_supporters-backed RPC the client
  // already calls for the heart-icon counts — no new field, no new table.
  const politicianIds = ((candidates as any[]) || [])
    .map((c) => c.profiles?.id)
    .filter((id): id is string => Boolean(id));
  const { data: engagementRows } =
    politicianIds.length > 0
      ? await getPoliticianEngagementSummaries(supabase, politicianIds)
      : { data: [] as any[] };
  const supporterCountByPolitician = new Map<string, number>(
    ((engagementRows as any[]) || []).map((r) => [r.politician_id, r.supporter_count || 0])
  );

  // Current office holder for this seat's boundary + role (the incumbent),
  // used for the per-seat meta description and "About this race" copy.
  const { data: holders } = seat?.map_shape_id
    ? await getOfficeHoldersForShape(supabase, seat.map_shape_id)
    : { data: [] as any[] };
  const incumbentRow = ((holders as any[]) || []).find(
    (h) => h.election_role_types?.role_title === seat?.role_title
  );

  return { seat, candidates, supporterCountByPolitician, incumbentRow };
});

function toRaceFacts(seat: any, candidates: any[], incumbentRow: any): RaceFacts {
  return {
    roleTitle: seat.role_title || "Electoral Seat",
    boundaryName: seat.map_shapes?.name || "District",
    electionName: seat.elections?.name || "2026 Election",
    electionDate: seat.elections?.election_date,
    candidates: candidates.map((c) => {
      const pp = c.profiles?.politician_profiles;
      const party = Array.isArray(pp?.political_parties) ? pp.political_parties[0] : pp?.political_parties;
      return {
        name: c.display_name || c.profiles?.full_name || "Candidate",
        party: party?.name ?? null,
        blurb: c.statement || pp?.bio || null,
      };
    }),
    incumbent: incumbentRow
      ? {
          name: incumbentRow.full_name,
          party: incumbentRow.political_parties?.name ?? null,
          since: incumbentRow.holding_since ?? null,
        }
      : null,
  };
}

// Sorts candidates by community-support count and returns the derived
// numbers used in metadata, JSON-LD, and the AI-crawler text snapshot.
function summarizeSupport(candidates: any[], supporterCountByPolitician: Map<string, number>) {
  const ranked = candidates
    .map((c) => ({
      candidate: c,
      name: c.display_name || c.profiles?.full_name || "Candidate",
      supporterCount: (c.profiles?.id && supporterCountByPolitician.get(c.profiles.id)) || 0,
    }))
    .sort((a, b) => b.supporterCount - a.supporterCount);
  const totalSupport = ranked.reduce((sum, r) => sum + r.supporterCount, 0);
  // A stable sort still picks an arbitrary "first" out of a tie — only call
  // it a leader when exactly one candidate holds the top count, otherwise
  // every fact-generating site below (meta description, FAQ answer,
  // AI-crawler text) would wrongly assert someone is "leading" at 1-1.
  const topSupportCount = ranked[0]?.supporterCount ?? 0;
  const topRanked = totalSupport > 0 ? ranked.filter((r) => r.supporterCount === topSupportCount) : [];
  const isTie = topRanked.length > 1;
  const leader = topRanked.length === 1 ? topRanked[0] : null;
  const leaderPct = totalSupport > 0 ? Math.round((topSupportCount / totalSupport) * 1000) / 10 : null;
  return { ranked, totalSupport, leader, leaderPct, isTie, tiedNames: topRanked.map((r) => r.name) };
}

export async function generateMetadata({
  params,
  searchParams,
}: SeatPageProps): Promise<Metadata> {
  const { seatId } = await params;
  const { candidate: candidateId } = await searchParams;

  const { seat, candidates, supporterCountByPolitician, incumbentRow } = await getSeatWithCandidates(seatId);

  if (!seat) {
    // Not a 404: an admin previewing a draft election lands here too (the
    // cookie-free client can't see drafts). noindex keeps every junk or
    // draft URL out of the index without breaking that preview.
    return {
      title: "Seat Not Found | Choseno",
      description: "The requested election seat could not be found.",
      robots: { index: false, follow: false },
    };
  }


  const selectedCandidate = candidateId
    ? (candidates as any[])?.find(
        (c) => c.id === candidateId || extractIdFromSlug(candidateId) === c.id || buildCandidateSlug(c) === candidateId
      )
    : null;

  const candidateName = selectedCandidate?.display_name || selectedCandidate?.profiles?.full_name;

  const roleTitle = seat.role_title || "Electoral Seat";
  const boundaryName = seat.map_shapes?.name || "District";
  const electionYear = seat.elections?.election_date?.slice(0, 4) || "2026";
  const candCount = (candidates as any[])?.length || 0;

  const candidateListNames = (candidates as any[])
    ?.slice(0, 3)
    .map((c) => c.display_name || c.profiles?.full_name)
    .filter(Boolean);

  const topMatchup =
    candidateListNames && candidateListNames.length >= 2
      ? `${candidateListNames[0]} vs. ${candidateListNames[1]}`
      : candidateListNames && candidateListNames.length === 1
      ? candidateListNames[0]
      : "";

  const raceFacts = toRaceFacts(seat, (candidates as any[]) || [], incumbentRow);
  const title = candidateName
    ? buildCandidateTitle({ name: candidateName, roleTitle, boundaryName })
    : buildRaceTitle(raceFacts);

  // Lead with the race, election, date and who is running for which party
  // (the facts a searcher wants); the community-support figure stays in the
  // page body, not the snippet. A selected candidate's own statement wins.
  const description = selectedCandidate?.statement
    ? selectedCandidate.statement.length > 155
      ? `${selectedCandidate.statement.slice(0, 152)}...`
      : selectedCandidate.statement
    : buildRaceDescription(raceFacts);

  const seatSlug = buildSeatSlug(seat);
  const candSlug = selectedCandidate ? buildCandidateSlug(selectedCandidate) : candidateId;

  // ?candidate= shows one candidate inside the seat view; their /candidacy/
  // page is the canonical URL for that person (see the candidate route).
  const canonicalUrl = selectedCandidate
    ? `${BASE_URL}/candidacy/${candSlug}`
    : candidateId
    ? `${BASE_URL}/elections/seat/${seatSlug}?candidate=${candSlug}`
    : `${BASE_URL}/elections/seat/${seatSlug}`;

  const ogImageUrl = selectedCandidate
    ? `${BASE_URL}/candidacy/${selectedCandidate.id}/opengraph-image`
    : `${BASE_URL}/elections/seat/${seatSlug}/opengraph-image`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "Choseno",
      type: "website",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function ElectionSeatPage({ params }: SeatPageProps) {
  const { seatId } = await params;

  const { seat, candidates, supporterCountByPolitician, incumbentRow } = await getSeatWithCandidates(seatId);

  const roleTitle = seat?.role_title || "Electoral Seat";
  const boundaryName = seat?.map_shapes?.name || "District";
  const electionDateRaw = seat?.elections?.election_date;
  const electionYear = electionDateRaw?.slice(0, 4) || "2026";
  // Formatted from the date string itself, not via Date (UTC parsing shifts it a day).
  const electionDateLabel = longDate(electionDateRaw);
  const { ranked, leader, leaderPct, totalSupport, isTie, tiedNames } = summarizeSupport(
    (candidates as any[]) || [],
    supporterCountByPolitician
  );
  const seatSlug = seat ? buildSeatSlug(seat) : seatId;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(seatId);
  if (seat && isUuid && seatSlug !== seatId) {
    redirect(`/elections/seat/${seatSlug}`);
  }
  const canonicalUrl = `${BASE_URL}/elections/seat/${seatSlug}`;

  const candList = (candidates as any[]) || [];
  const candidateNames = candList
    .map((c) => c.display_name || c.profiles?.full_name)
    .filter(Boolean);

  const jsonLd = seat
    ? [
        {
          "@context": "https://schema.org",
          "@type": "ItemPage",
          name: `${roleTitle} Candidates — ${boundaryName}`,
          description: `View candidates, policy positions, and constituent discussion for ${roleTitle} in ${boundaryName}.`,
          url: canonicalUrl,
        },
        {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `2026 ${roleTitle} Candidates — ${boundaryName}`,
          description: `List of official candidates running for ${roleTitle} in ${boundaryName} on Choseno.`,
          numberOfItems: candList.length,
          itemListElement: candList.map((c, idx) => {
            const candName = c.display_name || c.profiles?.full_name || "Candidate";
            const candSlug = buildCandidateSlug(c);
            const candWallSlug = c.profiles?.politician_profiles?.wall_slug;
            const candUrl = c.profiles?.current_ghost_id
              ? `${BASE_URL}/wall/${candWallSlug || buildPoliticianWallSlug(candName, roleTitle)}`
              : `${canonicalUrl}/candidate/${candSlug}`;

            return {
              "@type": "ListItem",
              position: idx + 1,
              name: candName,
              url: candUrl,
            };
          }),
        },
        ...(electionDateRaw
          ? [
              {
                "@context": "https://schema.org",
                "@type": "Event",
                name: `${electionYear} ${roleTitle} Election — ${boundaryName}`,
                startDate: electionDateRaw,
                eventStatus: "https://schema.org/EventScheduled",
                eventAttendanceMode: "https://schema.org/MixedEventAttendanceMode",
                location: { "@type": "Place", name: boundaryName },
                description: `${roleTitle} election for ${boundaryName} takes place on ${electionDateLabel}.`,
              },
            ]
          : []),
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: `Who is running for ${roleTitle} in ${boundaryName} in ${electionYear}?`,
              acceptedAnswer: {
                "@type": "Answer",
                text:
                  candidateNames.length > 0
                    ? `Official candidates running for ${roleTitle} in ${boundaryName} (${electionYear} Elections) on Choseno include: ${candidateNames.join(", ")}.`
                    : `Candidates for ${roleTitle} in ${boundaryName} are being updated on Choseno as nominations are filed.`,
              },
            },
            {
              "@type": "Question",
              name: `When is the ${roleTitle} election in ${boundaryName}?`,
              acceptedAnswer: {
                "@type": "Answer",
                text: electionDateLabel
                  ? `The ${roleTitle} election for ${boundaryName} is scheduled for ${electionDateLabel}.`
                  : `The election date for ${roleTitle} in ${boundaryName} has not yet been confirmed on Choseno.`,
              },
            },
            {
              "@type": "Question",
              name: `Who is leading in community support for ${roleTitle} in ${boundaryName}?`,
              acceptedAnswer: {
                "@type": "Answer",
                text:
                  leader && leaderPct !== null
                    ? `As of ${electionDateLabel ? "the latest update" : "now"}, ${leader.name} leads with ${leaderPct}% community support (${leader.supporterCount} of ${totalSupport} total supporters) among ${roleTitle} candidates in ${boundaryName} on Choseno. This reflects Choseno user activity, not a scientific poll, certified vote count, or official election result.`
                    : isTie && leaderPct !== null
                    ? `As of ${electionDateLabel ? "the latest update" : "now"}, ${tiedNames.join(" and ")} are tied at ${leaderPct}% community support each among ${roleTitle} candidates in ${boundaryName} on Choseno. This reflects Choseno user activity, not a scientific poll, certified vote count, or official election result.`
                    : `Community support data for ${roleTitle} candidates in ${boundaryName} is not yet available on Choseno — support totals appear once constituents start following candidates.`,
              },
            },
          ],
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
            { "@type": "ListItem", position: 2, name: "Elections & Races", item: `${BASE_URL}/elections` },
            {
              "@type": "ListItem",
              position: 3,
              name: `${roleTitle} (${boundaryName})`,
              item: canonicalUrl,
            },
          ],
        },
      ]
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      )}

      {/* SSR Content Snapshot for AI Crawlers (ChatGPT, Perplexity, Gemini) */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          padding: 0,
          margin: "-1px",
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        <h1>
          2026 {roleTitle} Candidates — {boundaryName}
        </h1>
        <p>
          Who is running for {roleTitle} in {boundaryName} in {electionYear}?
        </p>
        {candidateNames.length > 0 ? (
          <p>
            Official candidates running for {roleTitle} in {boundaryName} on Choseno:{" "}
            {candidateNames.join(", ")}.
          </p>
        ) : (
          <p>
            Nominations for {roleTitle} in {boundaryName} are currently active on Choseno.
          </p>
        )}
        {electionDateLabel && (
          <p>
            Election Day for {roleTitle} in {boundaryName} is {electionDateLabel}.
          </p>
        )}
        <p>
          {leader && leaderPct !== null
            ? `Community support on Choseno as of now: ${leader.name} leads with ${leaderPct}% (${leader.supporterCount} of ${totalSupport} total supporters) among ${roleTitle} candidates in ${boundaryName}. This is Choseno user activity, not a scientific poll, certified vote count, or official election result.`
            : isTie && leaderPct !== null
            ? `Community support on Choseno as of now: ${tiedNames.join(" and ")} are tied at ${leaderPct}% each among ${roleTitle} candidates in ${boundaryName}. This is Choseno user activity, not a scientific poll, certified vote count, or official election result.`
            : `No community support data is recorded yet for ${roleTitle} candidates in ${boundaryName} on Choseno.`}
        </p>
        {candList.length > 0 && (
          <ul>
            {ranked.map(({ candidate: c, name: candName, supporterCount }) => {
              const pct = totalSupport > 0 ? Math.round((supporterCount / totalSupport) * 1000) / 10 : 0;
              return (
                <li key={c.id}>
                  {candName} — Candidate for {roleTitle} ({boundaryName}), {supporterCount} supporter
                  {supporterCount === 1 ? "" : "s"} on Choseno ({pct}% community support)
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ElectionSeatPageClient
        seatId={seatId}
        initialSeat={seat}
        initialCandidates={(candidates as any[]) || []}
      />

      {/* Visible, server-rendered race summary: built from this seat's own
          candidates, parties and incumbent so it differs page to page. */}
      {seat && (
        <section aria-labelledby="about-race-heading" className="px-4 lg:px-8 pb-16 max-w-4xl space-y-3 text-text-secondary leading-relaxed">
          <h2 id="about-race-heading" className="font-display text-2xl font-bold text-text-main">
            About the {roleTitle} race in {boundaryName}
          </h2>
          {buildRaceParagraphs(toRaceFacts(seat, candList, incumbentRow)).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </section>
      )}
    </>
  );
}
