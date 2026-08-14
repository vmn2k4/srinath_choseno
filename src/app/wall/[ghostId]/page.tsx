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
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { SITE_URL } from "@/lib/constants/site";
import { buildPoliticianWallSlug } from "@/lib/utils/slugs";

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
  const wallSlug = (owner?.politician_profiles as { wall_slug?: string | null } | null)?.wall_slug;
  if (!owner) return { title: "Politician Wall | Choseno" };
  if (wallSlug && ghostId !== wallSlug) redirect(`/wall/${wallSlug}`);

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

  const partyLabel = partyName ? ` (${partyName})` : "";
  const locationLabel = boundaryName ? ` in ${boundaryName}` : "";

  const keywords = [
    name,
    roleTitle,
    boundaryName,
    partyName,
    `${name} approval rating`,
    `${name} news`,
    `${name} policy stances`,
    `${name} voter reviews`,
    "civic accountability",
    "2026 election candidate",
  ].filter(Boolean) as string[];

  const title = activeCandidacy
    ? `${name}${partyLabel} — ${electionYear} ${roleTitle} Candidate${locationLabel} | Ratings & Verified News`
    : `${name}${partyLabel} — ${roleTitle}${locationLabel} | Approval Ratings & News Updates`;

  const ratingPrefix =
    rating && rating.count > 0
      ? `${rating.count} voter${rating.count === 1 ? "" : "s"} rated ${name} ${rating.avg}★. `
      : "";

  const description = activeCandidacy
    ? `${ratingPrefix}Track ${name}'s 2026 campaign stances, verified news updates, constituent approval ratings, and community reviews in ${boundaryName || "local district"}. Free on Choseno.`
    : `${ratingPrefix}See ${name}'s verified civic news, constituent approval ratings, policy decisions, and constituent discussion — anonymous & independent on Choseno.`;
  const canonicalWallSlug = wallSlug || buildPoliticianWallSlug(name, roleTitle);
  const canonicalUrl = `${BASE_URL}/wall/${canonicalWallSlug}`;
  const ogImageUrl = `${BASE_URL}/wall/${canonicalWallSlug}/opengraph-image`;

  return {
    title,
    description,
    keywords,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: `${title} | Choseno`,
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
      title: `${title} | Choseno`,
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

  const wallSlug = (owner?.politician_profiles as { wall_slug?: string | null } | null)?.wall_slug;
  if (wallSlug && ghostId !== wallSlug) redirect(`/wall/${wallSlug}`);

  const [{ data: posts }, supportCountRes] = await Promise.all([
    getWallPosts(supabase, owner.current_ghost_id),
    owner?.id ? getSupporterCount(supabase, owner.id) : Promise.resolve({ count: 0 }),
  ]);

  const name = owner?.full_name || "Politician";
  const bio = owner?.politician_profiles?.bio || "";
  const roleTitle =
    activeCandidacy?.election_seats?.role_title ||
    (owner?.politician_profiles as any)?.political_target_role ||
    "Representative";
  const canonicalWallSlug = wallSlug || buildPoliticianWallSlug(name, roleTitle);
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
      <div aria-hidden="true" style={{ position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}>
        <h1>{name} — {roleTitle}</h1>
        {bio && <p>{bio}</p>}
        {rating && rating.count > 0 && (
          <p>{rating.count} voter{rating.count === 1 ? "" : "s"} have rated {name} an average of {rating.avg} out of 5 stars on Choseno.</p>
        )}
        {seoPostsSnapshot.length > 0 && (
          <section>
            <h2>Recent civic updates and news coverage for {name} on Choseno</h2>
            {seoPostsSnapshot.map((post) => {
              const na = Array.isArray(post.news_articles) ? post.news_articles[0] : post.news_articles;
              const newsSlug = na?.slug;
              return post.content ? (
                <article key={post.id}>
                  <p>{post.content}</p>
                  {newsSlug && (
                    <p><a href={`/news/${newsSlug}`}>Read full news coverage for {name}</a></p>
                  )}
                  {post.created_at && (
                    <time dateTime={post.created_at}>
                      {new Date(post.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                    </time>
                  )}
                </article>
              ) : null;
            })}
          </section>
        )}
      </div>

      <PoliticianWallClient
        ghostId={owner.current_ghost_id}
        initialWallOwner={owner as any}
        initialPosts={(posts as any) || []}
        initialSupportCount={"count" in supportCountRes ? supportCountRes.count || 0 : 0}
      />
    </>
  );
}
