import { Metadata } from "next";
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

const BASE_URL = SITE_URL;

interface WallPageProps {
  params: Promise<{ ghostId: string }>;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function generateMetadata({
  params,
}: WallPageProps): Promise<Metadata> {
  const { ghostId } = await params;
  const supabase = await createServerClient();
  const { owner, activeCandidacy, partyName, rating } = isUuid(ghostId)
    ? await getSEOProfileSummary(supabase, ghostId)
    : await getSEOProfileSummaryBySlug(supabase, ghostId);
  const wallSlug = (owner?.politician_profiles as { wall_slug?: string | null } | null)?.wall_slug;
  if (!owner) return { title: "Politician Wall | Choseno" };
  if (isUuid(ghostId) && wallSlug) redirect(`/wall/${wallSlug}`);

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

  const canonicalUrl = `${BASE_URL}/wall/${wallSlug || ghostId}`;
  const ogImageUrl = `${BASE_URL}/wall/${wallSlug || ghostId}/opengraph-image`;

  const title = activeCandidacy
    ? `${name}${partyLabel} — ${electionYear} ${roleTitle} Candidate${locationLabel} & Voter Ratings | Choseno`
    : `${name}${partyLabel} — ${roleTitle}${locationLabel} | Voter Ratings & Feedback | Choseno`;

  const ratingPrefix =
    rating && rating.count > 0
      ? `${rating.count} voter${rating.count === 1 ? "" : "s"} rated ${name} ${rating.avg}★. `
      : "";

  const description = activeCandidacy
    ? `${ratingPrefix}What do ${boundaryName || "local"} voters really think of ${name}? Read anonymous constituent reviews, ${electionYear} ${roleTitle} stances${partyLabel ? ` (${partyName})` : ""}, ratings & submit your feedback on Choseno.`
    : `${ratingPrefix}What do constituents really think of ${name}? See approval ratings, constituent feedback, policy stances and join the discussion — anonymous and free on Choseno.`;

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

  const summary = isUuid(ghostId)
    ? await getSEOProfileSummary(supabase, ghostId)
    : await getSEOProfileSummaryBySlug(supabase, ghostId);
  const { owner, activeCandidacy, partyName, rating } = summary;
  if (!owner?.current_ghost_id) notFound();

  const wallSlug = (owner?.politician_profiles as { wall_slug?: string | null } | null)?.wall_slug;
  if (isUuid(ghostId) && wallSlug) redirect(`/wall/${wallSlug}`);

  const { data: posts } = await getWallPosts(supabase, owner.current_ghost_id);

  const supportCountRes = owner?.id ? await getSupporterCount(supabase, owner.id) : { count: 0 };

  const name = owner?.full_name || "Politician";
  const bio = owner?.politician_profiles?.bio || "";
  const roleTitle =
    activeCandidacy?.election_seats?.role_title ||
    (owner?.politician_profiles as any)?.political_target_role ||
    "Representative";
  const canonicalUrl = `${BASE_URL}/wall/${wallSlug || ghostId}`;

  const jsonLd = owner
    ? [
        {
          "@context": "https://schema.org",
          "@type": "Person",
          name: name,
          jobTitle: roleTitle,
          description: bio || undefined,
          image: owner.politician_profiles?.avatar_url || undefined,
          url: canonicalUrl,
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

  type PostRecord = { id: string; content?: string | null; created_at?: string | null };
  const seoPostsSnapshot = ((posts as PostRecord[]) || []).slice(0, 5);

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
            <h2>Recent posts by {name} on Choseno</h2>
            {seoPostsSnapshot.map((post) => (
              post.content ? (
                <article key={post.id}>
                  <p>{post.content}</p>
                  {post.created_at && (
                    <time dateTime={post.created_at}>
                      {new Date(post.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                    </time>
                  )}
                </article>
              ) : null
            ))}
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
