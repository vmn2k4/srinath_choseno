import { Metadata } from "next";
import { cache } from "react";
import PoliticianWallClient from "@/components/features/PoliticianWallClient";
import { createClient as createServerClient } from "@/lib/supabase/server";
import {
  getWallOwnerProfile,
  getWallPosts,
  getSupporterCount,
  getSEOProfileSummary,
  getSEOProfileSummaryBySlug,
} from "@/lib/services/politicianWall";
import { getNewsArticlesByPolitician } from "@/lib/services/news";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Newspaper } from "lucide-react";
import { SITE_URL } from "@/lib/constants/site";
import { buildPoliticianWallSlug } from "@/lib/utils/slugs";
import NewsArticleCard from "@/components/features/NewsArticleCard";

const BASE_URL = SITE_URL;

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
  const supabase = await createServerClient();
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
      type: "profile",
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
  const supabase = await createServerClient();

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

  const [{ data: posts }, supportCountRes, { data: newsArchivePreview, count: newsArchiveCount }] = await Promise.all([
    getWallPosts(supabase, owner.current_ghost_id),
    owner?.id ? getSupporterCount(supabase, owner.id) : Promise.resolve({ count: 0 }),
    // Full indexed news archive for this politician now lives at
    // /wall/[slug]/news (see that route) -- this is just a 3-card teaser so
    // the wall itself links out to it, instead of the wall only ever
    // linking to the couple of articles mirrored as posts.
    owner?.id
      ? getNewsArticlesByPolitician(supabase, owner.id, { limit: 3, withCount: true })
      : Promise.resolve({ data: [], count: 0 }),
  ]);

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
      <PoliticianWallClient
        ghostId={owner.current_ghost_id}
        initialWallOwner={owner as any}
        initialPosts={(posts as any) || []}
        initialSupportCount={"count" in supportCountRes ? supportCountRes.count || 0 : 0}
      />

      {/* News coverage teaser -- links out to the full indexed archive at
          /wall/[slug]/news rather than dead-ending on the wall itself. */}
      {newsArchivePreview && newsArchivePreview.length > 0 && (
        <div className="w-full max-w-none px-4 lg:px-8 pb-16 -mt-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-text-main flex items-center gap-2">
              <Newspaper size={16} className="text-primary" /> News Coverage of {name}
            </h2>
            <Link
              href={`/wall/${canonicalWallSlug}/news`}
              className="text-xs font-bold text-primary hover:text-primary-hover inline-flex items-center gap-1 shrink-0"
            >
              View all {newsArchiveCount ?? newsArchivePreview.length} stories <ArrowRight size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {newsArchivePreview.map((article: any) => (
              <NewsArticleCard key={article.id} article={article} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
