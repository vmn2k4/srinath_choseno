import { Metadata } from "next";
import { cache } from "react";
import PoliticianWallClient from "@/components/features/PoliticianWallClient";
import { createPublicClient } from "@/lib/supabase/publicServer";
import {
  getWallOwnerProfile,
  getWallPosts,
  getWallPostBySlugOrId,
  getSupporterCount,
  getSEOProfileSummary,
  getSEOProfileSummaryBySlug,
} from "@/lib/services/politicianWall";
import { SITE_URL } from "@/lib/constants/site";
import { buildPoliticianWallSlug } from "@/lib/utils/slugs";
import { notFound, redirect } from "next/navigation";

const BASE_URL = SITE_URL;

// Same reasoning as the wall page above (see src/app/wall/[ghostId]/page.tsx).
export const revalidate = 300;

interface WallSlugPageProps {
  params: Promise<{ ghostId: string; slug: string }>;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

type WallPost = {
  id: string;
  content?: string;
  image_url?: string;
  created_at?: string;
};

// generateMetadata and the page component below both need the same profile
// summary and wall post. Deduped via React cache() so it's the same pair of
// DB round trips instead of a duplicate per function.
const getProfileSummary = cache(async (ghostId: string) => {
  const supabase = await createPublicClient();
  return isUuid(ghostId)
    ? getSEOProfileSummary(supabase, ghostId)
    : getSEOProfileSummaryBySlug(supabase, ghostId);
});

const getWallPost = cache(async (ghostId: string, slug: string) => {
  const supabase = await createPublicClient();
  const { owner } = await getProfileSummary(ghostId);
  const { data } = await getWallPostBySlugOrId(supabase, owner?.current_ghost_id || ghostId, slug);
  return data as WallPost | null;
});

export async function generateMetadata({
  params,
}: WallSlugPageProps): Promise<Metadata> {
  const { ghostId, slug } = await params;

  const { owner, activeCandidacy, partyName } = await getProfileSummary(ghostId);
  const wallSlug = (owner?.politician_profiles as { wall_slug?: string | null } | null)?.wall_slug;
  if (owner?.current_ghost_id && isUuid(ghostId) && wallSlug) redirect(`/wall/${wallSlug}/${slug}`);
  if (wallSlug && slug === wallSlug) redirect(`/wall/${wallSlug}`);

  const post = await getWallPost(ghostId, slug);
  if (!owner || !post) return { title: "Page Not Found | Choseno" };
  const name = owner?.full_name || "Politician";
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

  const canonicalWallSlug = wallSlug || buildPoliticianWallSlug(name, roleTitle);
  const canonicalUrl = `${BASE_URL}/wall/${canonicalWallSlug}/${slug}`;

  const postExcerpt = post?.content
    ? post.content.replace(/\s+/g, " ").trim()
    : null;

  // Keep titles concise and under 60 characters for SERP
  const title = postExcerpt
    ? `"${postExcerpt.slice(0, 38)}${postExcerpt.length > 38 ? "…" : ""}" — ${name}${partyLabel}`
    : activeCandidacy
    ? `${name}${partyLabel} — ${roleTitle} Candidate${locationLabel}`
    : `${name}${partyLabel} — ${roleTitle}${locationLabel} | Choseno`;

  // Keep descriptions under 155 characters
  const description = postExcerpt
    ? `${postExcerpt.slice(0, 110)} — Read updates, voter ratings, and civic news for ${name} on Choseno.`
    : activeCandidacy
    ? `Read updates, constituent feedback, and campaign positions for ${name} (${roleTitle}${locationLabel}) on Choseno.`
    : `Read official updates, policy statements, and constituent reviews for ${name} (${roleTitle}) on Choseno.`;

  const ogImageUrl = post?.image_url || `${BASE_URL}/wall/${canonicalWallSlug}/${slug}/opengraph-image`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "Choseno",
      type: "article",
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

export default async function WallSlugPage({ params }: WallSlugPageProps) {
  const { ghostId, slug } = await params;
  const supabase = await createPublicClient();

  const { owner, activeCandidacy, partyName, rating } = await getProfileSummary(ghostId);
  const wallSlug = (owner?.politician_profiles as { wall_slug?: string | null } | null)?.wall_slug;
  if (owner?.current_ghost_id && isUuid(ghostId) && wallSlug) redirect(`/wall/${wallSlug}/${slug}`);
  if (wallSlug && slug === wallSlug) redirect(`/wall/${wallSlug}`);

  const post = await getWallPost(ghostId, slug);
  if (!owner || !post) notFound();

  const [{ data: posts }, supportCountRes] = await Promise.all([
    getWallPosts(supabase, owner?.current_ghost_id || ghostId),
    owner?.id ? getSupporterCount(supabase, owner.id) : Promise.resolve({ count: 0 }),
  ]);

  const name = owner?.full_name || "Politician";
  const roleTitle =
    activeCandidacy?.election_seats?.role_title ||
    (owner?.politician_profiles as any)?.political_target_role ||
    "Representative";
  const canonicalWallSlug = wallSlug || buildPoliticianWallSlug(name, roleTitle);
  const canonicalUrl = `${BASE_URL}/wall/${canonicalWallSlug}/${slug}`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SocialMediaPosting",
      headline: post?.content ? post.content.slice(0, 110) : `${name}'s Public Thread`,
      articleBody: post?.content || undefined,
      datePublished: post?.created_at || undefined,
      url: canonicalUrl,
        author: owner
        ? {
            "@type": "Person",
            name: name,
            jobTitle: roleTitle,
            url: `${BASE_URL}/wall/${canonicalWallSlug}`,
            image: owner.politician_profiles?.photo_url || owner.politician_profiles?.avatar_url || undefined,
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
          }
        : undefined,
      publisher: {
        "@type": "Organization",
        name: "Choseno",
        url: BASE_URL,
      },
      ...(post?.image_url && {
        image: post.image_url,
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
          item: `${BASE_URL}/wall/${canonicalWallSlug}`,
        },
        {
          "@type": "ListItem",
          position: 4,
          name: post?.content ? post.content.slice(0, 30) : slug,
          item: canonicalUrl,
        },
      ],
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      {/* PoliticianWallClient no longer carries its own horizontal padding
          (see its own comment) -- this is now the one place that supplies
          it for this route, matching what the main wall page does with its
          own wrapper. */}
      <div className="w-full max-w-none px-4 lg:px-8">
        <PoliticianWallClient
          ghostId={owner?.current_ghost_id || ghostId}
          initialWallOwner={owner as any}
          initialPosts={(posts as any) || []}
          initialSupportCount={"count" in supportCountRes ? (supportCountRes as any).count || 0 : 0}
        />
      </div>
    </>
  );
}
