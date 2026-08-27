import { Metadata } from "next";
import { cache } from "react";
import PoliticianWallClient from "@/components/features/PoliticianWallClient";
import { createPublicClient } from "@/lib/supabase/publicServer";
import {
  getWallOwnerProfile,
  getWallPosts,
  getSupporterCount,
  getSEOProfileSummary,
  getSEOProfileSummaryBySlug,
} from "@/lib/services/politicianWall";
import { getNewsArticlesByPolitician, getPublishedNewsArticles } from "@/lib/services/news";
import { getRelatedPoliticians } from "@/lib/services/politicians";
import { getOpenSeatsNearShapeIds } from "@/lib/services/elections";
import { getShapeContainers } from "@/lib/services/boundaries";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ChevronRight, Newspaper, Users, Vote, MapPin } from "lucide-react";
import { SITE_URL } from "@/lib/constants/site";
import { buildPoliticianWallSlug, buildSeatSlug } from "@/lib/utils/slugs";
import { normalizeCountryCode } from "@/lib/utils/newsGeography";
import NewsArticleCard from "@/components/features/NewsArticleCard";
import RelatedPoliticianCard from "@/components/features/RelatedPoliticianCard";

const BASE_URL = SITE_URL;

// Every table this page reads (profiles' politician branch, politician_
// profiles/supporters/ratings, non-removed posts, office_holders,
// news_articles) is publicly readable independent of who's asking -- see
// src/lib/supabase/publicServer.ts. 5 minutes: fresh enough that a just-cast
// support/rating shows up quickly, long enough to spare the DB on repeat
// visits to what's likely the highest-traffic page type in the app.
export const revalidate = 300;

interface WallPageProps {
  params: Promise<{ ghostId: string }>;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

// generateMetadata and the page component below both need the same profile
// summary for ghostId. Deduped via React cache() so it's one DB round trip
// per request instead of two.
const getProfileSummary = cache(async (ghostId: string) => {
  const supabase = await createPublicClient();
  return isUuid(ghostId)
    ? getSEOProfileSummary(supabase, ghostId)
    : getSEOProfileSummaryBySlug(supabase, ghostId);
});

export async function generateMetadata({
  params,
}: WallPageProps): Promise<Metadata> {
  const { ghostId } = await params;
  const { owner, activeCandidacy, partyName, rating } = await getProfileSummary(ghostId);
  if (!owner) return { title: "Politician Wall | Choseno" };

  const name = owner?.full_name || "Politician";
  const bio = owner?.politician_profiles?.bio || "";
  const roleTitle =
    activeCandidacy?.election_seats?.role_title ||
    (owner?.politician_profiles as any)?.political_target_role ||
    "Representative";
  const boundaryName =
    activeCandidacy?.election_seats?.map_shapes?.name ||
    (owner?.politician_profiles as any)?.target_boundary_name ||
    "";
  const electionYear = activeCandidacy?.election_seats?.elections?.election_date?.slice(0, 4) || "2026";

  // roleTitle stays unprefixed -- it feeds buildPoliticianWallSlug below, and
  // prefixing it there would change a former officeholder's canonical wall
  // URL the moment their term ends, breaking existing links/bookmarks.
  // displayRoleTitle is the title/description-only variant: getWallOwnerProfile
  // (via enrichProfileWithContactFallback) already computes is_former_office_holder,
  // but this metadata function wasn't reading it, so the page's <title>/OG/
  // Twitter card kept calling a former officeholder "Mayor" (present tense)
  // even though the in-page badge (PoliticianWallClient.tsx) correctly shows
  // "Former Mayor" -- this is what a shared-link preview or SERP snippet
  // shows, so it drifting from the actual page content is a real bug, not
  // cosmetic. Skipped when there's an activeCandidacy: someone actively
  // running again this cycle should read as "Mayor Candidate", not the
  // self-contradictory "Former Mayor Candidate".
  const isFormerHolder = !activeCandidacy && Boolean((owner?.politician_profiles as any)?.is_former_office_holder);
  const displayRoleTitle = isFormerHolder ? `Former ${roleTitle}` : roleTitle;

  const wallSlug = (owner?.politician_profiles as { wall_slug?: string | null } | null)?.wall_slug;
  const canonicalWallSlug = wallSlug || buildPoliticianWallSlug(name, roleTitle);
  if (canonicalWallSlug && ghostId !== canonicalWallSlug) redirect(`/wall/${canonicalWallSlug}`);

  const partyLabel = partyName ? ` (${partyName})` : "";
  const locationLabel = boundaryName ? ` (${boundaryName})` : "";

  // Keep titles tight and under 60 characters for SERP display
  const title = activeCandidacy
    ? `${name}${partyLabel} — ${roleTitle} Candidate${locationLabel}`
    : `${name}${partyLabel} — ${displayRoleTitle}${locationLabel} | Choseno`;

  const ratingPrefix =
    rating && rating.count > 0
      ? `${rating.count} voter${rating.count === 1 ? "" : "s"} rated ${name} ${rating.avg}★. `
      : "";

  // Keep descriptions between 135-155 characters to avoid SERP truncation
  const description = activeCandidacy
    ? `${ratingPrefix}View campaign stances, news, constituent ratings, and reviews for ${name} (${roleTitle}${locationLabel}).`
    : `${ratingPrefix}Read verified news, constituent approval ratings, and community reviews for ${name} on Choseno.`;

  const canonicalUrl = `${BASE_URL}/wall/${canonicalWallSlug}`;
  const ogImageUrl = `${BASE_URL}/wall/${canonicalWallSlug}/opengraph-image`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "Choseno",
      // "profile" is a less common OG type -- X's card parser may not
      // recognize it cleanly and fall back to its own richer content-
      // extraction rendering (the bullet-point "article summary" card seen
      // in testing) instead of the plain summary_large_image card the
      // twitter.card below asks for. "website" is the type X's parser
      // handles most predictably. Unverified against live X behavior --
      // this is a targeted experiment, not a confirmed fix.
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

export default async function WallPage({ params }: WallPageProps) {
  const { ghostId } = await params;
  const supabase = await createPublicClient();

  const { owner, activeCandidacy, partyName, rating } = await getProfileSummary(ghostId);
  if (!owner?.current_ghost_id) notFound();

  const name = owner?.full_name || "Politician";
  const bio = owner?.politician_profiles?.bio || "";
  const roleTitle =
    activeCandidacy?.election_seats?.role_title ||
    (owner?.politician_profiles as any)?.political_target_role ||
    "Representative";
  // Same fallback chain generateMetadata above uses for its title/OG copy --
  // kept in sync here so the Person JSON-LD below can name the district a
  // wall owner actually represents, which it previously omitted entirely.
  const boundaryName =
    activeCandidacy?.election_seats?.map_shapes?.name ||
    (owner?.politician_profiles as any)?.target_boundary_name ||
    "";
  const wallSlug = (owner?.politician_profiles as { wall_slug?: string | null } | null)?.wall_slug;
  const canonicalWallSlug = wallSlug || buildPoliticianWallSlug(name, roleTitle);

  if (canonicalWallSlug && ghostId !== canonicalWallSlug) redirect(`/wall/${canonicalWallSlug}`);

  const ownerPartyId = (owner?.politician_profiles as { political_party_id?: number | null } | null)?.political_party_id;
  // politician_profiles.target_boundary_id is a free-text field that's
  // essentially never actually populated (5 of 31,687 rows, checked
  // directly) -- resolved_boundary_id (set by enrichProfileWithContact
  // Fallback in politicianWall.ts from the owner's own linked office_holders
  // row, which reliably has a real map_shape_id) is the real source for
  // every boundary-scoped lookup below.
  const ownerBoundaryId = (owner?.politician_profiles as { resolved_boundary_id?: number | null } | null)?.resolved_boundary_id ?? null;

  // "Same country" alone was the old fallback for both Related People and
  // (implicitly) any area-scoped lookup -- it produced results with no
  // actual geographic relevance (a Michigan Representative's wall showing
  // an Austin mayor and Chicago councillors, sharing nothing but a party
  // and a country). Almost every district/riding has exactly one current
  // officeholder, so matching on the exact boundary alone is nearly always
  // empty too. What a visitor actually wants is "other leaders from this
  // area" -- the Governor, Senators, other Representatives, State
  // Senators, city mayors -- which means walking UP to the containing
  // state/province (shape_containers) and then back DOWN to every other
  // shape inside it. Sequential, not folded into the main Promise.all
  // below, since areaShapeIds has to exist before the queries that use it
  // can even be constructed.
  let areaShapeIds: number[] = ownerBoundaryId ? [ownerBoundaryId] : [];
  if (ownerBoundaryId) {
    const { data: containers } = await getShapeContainers(supabase, ownerBoundaryId);
    const containerIds = (containers || []).map((c: any) => c.container_shape_id).filter(Boolean);
    if (containerIds.length > 0) {
      areaShapeIds.push(...containerIds);
      const { data: siblingShapes } = await supabase
        .from("shape_containers")
        .select("map_shape_id")
        .in("container_shape_id", containerIds);
      areaShapeIds.push(...((siblingShapes || []).map((s: any) => s.map_shape_id).filter(Boolean)));
    }
  }

  const [
    { data: posts },
    supportCountRes,
    { data: newsArchivePreview, count: newsArchiveCount },
    { data: relatedPoliticians },
    { data: areaSeats },
  ] = await Promise.all([
    getWallPosts(supabase, owner.current_ghost_id),
    owner?.id ? getSupporterCount(supabase, owner.id) : Promise.resolve({ count: 0 }),
    // Full indexed news archive for this politician now lives at
    // /wall/[slug]/news (see that route) -- this is just a 3-card teaser so
    // the wall itself links out to it, instead of the wall only ever
    // linking to the couple of articles mirrored as posts.
    owner?.id
      ? getNewsArticlesByPolitician(supabase, owner.id, { limit: 3, withCount: true })
      : Promise.resolve({ data: [], count: 0 }),
    // "Related People" rail -- gives a visitor who lands on a brand-new,
    // otherwise-empty wall (no posts, no reviews, no tagged news yet)
    // somewhere else on the platform to go instead of a dead end. Exact
    // boundary first (rare -- most seats are single-holder), then the
    // wider area (see areaShapeIds above and getRelatedPoliticians's doc
    // comment), then party, then country.
    owner?.id
      ? getRelatedPoliticians(supabase, {
          excludeProfileId: owner.id,
          politicalPartyId: ownerPartyId,
          country: owner.country,
          boundaryId: ownerBoundaryId,
          areaShapeIds,
        })
      : Promise.resolve({ data: [] }),
    // Races happening in this politician's own area -- not just their exact
    // seat (an upcoming re-election, when one's open) but the same
    // state/province-wide area used for Related People above, so a
    // Governor's or Senate race shows up here too, not only a race for the
    // visitor's own specific district.
    areaShapeIds.length > 0 ? getOpenSeatsNearShapeIds(supabase, areaShapeIds) : Promise.resolve({ data: [] }),
  ]);

  // No news article has been tagged to this specific politician yet --
  // fall back to general recent coverage for their country so the wall
  // still has *something* linking out to /news instead of the section
  // disappearing entirely. Sequential (not folded into the Promise.all
  // above) since it's only worth the extra round trip when the direct
  // lookup came back empty.
  let generalNewsFallback: typeof newsArchivePreview = null;
  if ((!newsArchivePreview || newsArchivePreview.length === 0) && owner.country) {
    // profiles.country is a free-text name ("Canada"); news_articles.country
    // is the ISO-2 code ("CA") -- normalizeCountryCode bridges the two, same
    // as every other cross-table country filter in newsGeography.ts's own
    // header comment. Without it this silently matches zero rows for every
    // Canadian/US politician instead of falling back to anything.
    const { data } = await getPublishedNewsArticles(supabase, { country: normalizeCountryCode(owner.country), limit: 3 });
    generalNewsFallback = data;
  }
  const newsToShow = newsArchivePreview && newsArchivePreview.length > 0 ? newsArchivePreview : generalNewsFallback;
  const newsIsDirectlyTagged = Boolean(newsArchivePreview && newsArchivePreview.length > 0);

  const canonicalUrl = `${BASE_URL}/wall/${canonicalWallSlug}`;

  type PostRecord = {
    id: string;
    content?: string | null;
    created_at?: string | null;
    news_articles?: { slug?: string | null; event_date?: string | null; published_at?: string | null } | Array<{ slug?: string | null; event_date?: string | null; published_at?: string | null }> | null;
  };
  const seoPostsSnapshot = ((posts as PostRecord[]) || []).slice(0, 10);

  // Extract news articles linked to this politician for subjectOf structured data
  const subjectOfArticles = seoPostsSnapshot
    .filter((p) => p.news_articles)
    .map((p) => {
      const na = Array.isArray(p.news_articles) ? p.news_articles[0] : p.news_articles;
      const articleSlug = na?.slug;
      const articleUrl = articleSlug ? `${BASE_URL}/news/${articleSlug}` : undefined;
      return {
        "@type": "NewsArticle",
        headline: p.content ? p.content.slice(0, 110) : undefined,
        description: p.content || undefined,
        datePublished: na?.published_at || na?.event_date || p.created_at || undefined,
        url: articleUrl,
      };
    })
    .filter((item) => item.headline);

  const jsonLd = owner
    ? [
        {
          "@context": "https://schema.org",
          "@type": "Person",
          name: name,
          jobTitle: roleTitle,
          description: bio || undefined,
          image: owner.politician_profiles?.photo_url || owner.politician_profiles?.avatar_url || undefined,
          url: canonicalUrl,
          ...(owner.politician_profiles?.contact_phone && {
            telephone: owner.politician_profiles.contact_phone,
          }),
          ...(owner.politician_profiles?.contact_email && {
            email: owner.politician_profiles.contact_email,
          }),
          ...(owner.politician_profiles?.source_url && {
            sameAs: [owner.politician_profiles.source_url],
          }),
          // Previously missing entirely -- jobTitle alone ("Councillor")
          // doesn't say WHICH district, which is exactly the fact an AI
          // answer engine needs to resolve "who is my councillor in X".
          ...(boundaryName && {
            worksFor: {
              "@type": "GovernmentOrganization",
              name: `${roleTitle} — ${boundaryName}`,
            },
          }),
          ...(partyName && {
            memberOf: {
              "@type": "PoliticalParty",
              name: partyName,
            },
          }),
          ...(rating && rating.count > 0 && {
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: rating.avg.toString(),
              reviewCount: rating.count.toString(),
              bestRating: "5",
              worstRating: "1",
            },
          }),
          ...(subjectOfArticles.length > 0 && {
            subjectOf: subjectOfArticles,
          }),
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Home",
              item: BASE_URL,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "Elections & Races",
              item: `${BASE_URL}/elections`,
            },
            {
              "@type": "ListItem",
              position: 3,
              name: `${name} Wall`,
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
      <div className="w-full max-w-none px-4 lg:px-8 pt-4 pb-4 flex items-center justify-between gap-3 flex-wrap">
        {/* Visible counterpart to the BreadcrumbList schema above -- gives a
            visitor who landed here straight from a search result or a shared
            link somewhere to go besides the wall itself, instead of the trail
            existing only for crawlers. */}
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5 text-xs font-medium text-text-muted flex-wrap">
            <li>
              <Link href="/" className="hover:text-primary transition-colors">
                Home
              </Link>
            </li>
            <ChevronRight size={12} className="shrink-0 opacity-60" />
            <li>
              <Link href="/elections" className="hover:text-primary transition-colors">
                Elections & Races
              </Link>
            </li>
            <ChevronRight size={12} className="shrink-0 opacity-60" />
            <li className="text-text-secondary font-semibold truncate max-w-[220px]" aria-current="page">
              {name}
            </li>
          </ol>
        </nav>
        {/* This is {name}'s district -- a natural moment to point a visitor
            at finding their OWN, rather than only ever being able to look up
            someone else's. Server-rendered (not in PoliticianWallClient) so
            it's visible immediately, no client hydration wait. */}
        <Link
          href="/find-my-district"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-primary hover:bg-primary-hover transition-colors shrink-0 px-3 py-1.5 rounded-lg"
        >
          <MapPin size={12} /> Find your district & leaders <ArrowRight size={12} />
        </Link>
      </div>

      {/* Discovery rail passed as a prop, not a sibling -- PoliticianWallClient
          places this beside the post feed specifically (below the profile
          header/rating bar/composer, which stay full-width), not beside
          the whole component. Order: Related People, then Races Happening,
          then Related News below both -- news moved here from its own
          full-width section since it's the same "here's somewhere else to
          go" discovery content as the other two, not primary wall content. */}
      <div className="w-full max-w-none px-4 lg:px-8 pb-16">
        <PoliticianWallClient
          ghostId={owner.current_ghost_id}
          initialWallOwner={owner as any}
          initialPosts={(posts as any) || []}
          initialSupportCount={"count" in supportCountRes ? supportCountRes.count || 0 : 0}
          sidebar={
            <div className="space-y-8">
              {/* Related People -- the other half of "this wall is empty,
                  now what": someone landing on a wall with no
                  reviews/posts/news yet gets somewhere else to go instead
                  of a dead end. Exact boundary first (rare), then the same
                  area (state/province and everything in it), then party,
                  then country (see getRelatedPoliticians). */}
              {relatedPoliticians && relatedPoliticians.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-text-main flex items-center gap-2">
                    <Users size={16} className="text-primary" /> Related People
                  </h2>
                  <div className="grid grid-cols-1 gap-3">
                    {relatedPoliticians.map((politician) => (
                      <RelatedPoliticianCard key={politician.id} politician={politician} />
                    ))}
                  </div>
                </div>
              )}

              {/* Races Happening in This Area -- an upcoming or active
                  election anywhere in {name}'s broader area (their own seat
                  plus their state/province and everything in it -- see
                  areaShapeIds), surfaced right on their wall instead of
                  requiring a visitor to already know to check /elections
                  separately. Capped at 5 -- a whole state can easily have a
                  dozen+ open congressional races at once, and a long
                  identical-looking list ("U.S. Representative" repeated
                  with no way to tell them apart) is worse than a short one.
                  Each row's primary line now names the actual district/area
                  (not just the shared role title) so the 5 that do show are
                  distinguishable at a glance. Empty for most walls most of
                  the time (elections aren't constantly running) -- that's
                  expected, not a bug. */}
              {areaSeats && areaSeats.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-text-main flex items-center gap-2">
                    <Vote size={16} className="text-primary" /> Races Happening in {boundaryName || "This Area"}
                  </h2>
                  <div className="grid grid-cols-1 gap-3">
                    {areaSeats.slice(0, 5).map((seat: any) => {
                      const election = Array.isArray(seat.elections) ? seat.elections[0] : seat.elections;
                      const shape = Array.isArray(seat.map_shapes) ? seat.map_shapes[0] : seat.map_shapes;
                      const seatSlug = buildSeatSlug({ id: seat.id, role_title: seat.role_title, map_shapes: shape });
                      const electionDate = election?.election_date
                        ? new Date(election.election_date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
                        : null;
                      return (
                        <Link
                          key={seat.id}
                          href={`/elections/seat/${seatSlug}`}
                          className="flex items-center justify-between gap-3 p-4 rounded-xl border border-border bg-surface hover:border-primary/40 transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-text-main truncate">
                              {seat.role_title}
                              {shape?.name ? ` — ${shape.name}` : ""}
                            </p>
                            <p className="text-xs text-text-muted truncate">
                              {election?.name || "Election"}
                              {electionDate ? ` · ${electionDate}` : ""}
                            </p>
                          </div>
                          <ArrowRight size={14} className="shrink-0 text-text-muted" />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Related News -- links out to the full indexed archive at
                  /wall/[slug]/news when articles are actually tagged to
                  this politician; falls back to general recent coverage
                  for their country (newsIsDirectlyTagged=false) so a
                  brand-new wall with no tagged articles yet still has a
                  news section instead of none. */}
              {newsToShow && newsToShow.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-bold text-text-main flex items-center gap-2">
                      <Newspaper size={16} className="text-primary" />
                      {newsIsDirectlyTagged ? "Related News" : "Recent Political News"}
                    </h2>
                    <Link
                      href={newsIsDirectlyTagged ? `/wall/${canonicalWallSlug}/news` : "/news"}
                      className="text-xs font-bold text-primary hover:text-primary-hover inline-flex items-center gap-1 shrink-0"
                    >
                      {newsIsDirectlyTagged ? `View all ${newsArchiveCount ?? newsToShow.length}` : "Browse all"}{" "}
                      <ArrowRight size={12} />
                    </Link>
                  </div>
                  {!newsIsDirectlyTagged && (
                    <p className="text-xs text-text-muted -mt-2">
                      No stories are tagged to {name} yet &mdash; here&rsquo;s what&rsquo;s happening in {owner.country} right now.
                    </p>
                  )}
                  <div className="grid grid-cols-1 gap-3">
                    {newsToShow.map((article: any) => (
                      <NewsArticleCard key={article.id} article={article} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          }
        />
      </div>
    </>
  );
}
