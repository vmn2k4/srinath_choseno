import { Metadata } from "next";
import PoliticianWallClient from "@/components/features/PoliticianWallClient";
import { createClient as createServerClient } from "@/lib/supabase/server";
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
import { redirect } from "next/navigation";

const BASE_URL = SITE_URL;

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

export async function generateMetadata({
  params,
}: WallSlugPageProps): Promise<Metadata> {
  const { ghostId, slug } = await params;
  const supabase = await createServerClient();

  const { owner, activeCandidacy, partyName } = isUuid(ghostId)
    ? await getSEOProfileSummary(supabase, ghostId)
    : await getSEOProfileSummaryBySlug(supabase, ghostId);
  const wallSlug = (owner?.politician_profiles as { wall_slug?: string | null } | null)?.wall_slug;
  if (owner?.current_ghost_id && isUuid(ghostId) && wallSlug) redirect(`/wall/${wallSlug}/${slug}`);
  if (wallSlug && slug === wallSlug) redirect(`/wall/${wallSlug}`);

  const { data: postData } = await getWallPostBySlugOrId(supabase, owner?.current_ghost_id || ghostId, slug);


  const post = postData as WallPost | null;
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

  const title = postExcerpt
    ? `"${postExcerpt.slice(0, 55)}${postExcerpt.length > 55 ? "…" : ""}" — ${name}${partyLabel} | Choseno`
    : activeCandidacy
    ? `${name}${partyLabel} — ${electionYear} ${roleTitle} Candidate${locationLabel} | Choseno`
    : `${name}${partyLabel} — ${roleTitle}${locationLabel} | Public Wall | Choseno`;

  const description = postExcerpt
    ? `${postExcerpt.slice(0, 140)} — Read official updates, voter ratings, and constituent discussion for ${name} (${roleTitle}) on Choseno.`
    : activeCandidacy
    ? `Read updates, constituent feedback, and campaign positions for ${name}, candidate for ${roleTitle}${locationLabel}${partyLabel} on Choseno.`
    : `Read official updates, policy statements, and constituent discussion for ${name} (${roleTitle}${locationLabel}) on Choseno.`;

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
  const supabase = await createServerClient();

  const summary = isUuid(ghostId)
    ? await getSEOProfileSummary(supabase, ghostId)
    : await getSEOProfileSummaryBySlug(supabase, ghostId);
  const { owner, activeCandidacy, partyName, rating } = summary;
  const wallSlug = (owner?.politician_profiles as { wall_slug?: string | null } | null)?.wall_slug;
  if (owner?.current_ghost_id && isUuid(ghostId) && wallSlug) redirect(`/wall/${wallSlug}/${slug}`);
  if (wallSlug && slug === wallSlug) redirect(`/wall/${wallSlug}`);

  const { data: postData } = await getWallPostBySlugOrId(supabase, owner?.current_ghost_id || ghostId, slug);


  const post = postData as WallPost | null;

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
            image: owner.politician_profiles?.avatar_url || undefined,
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
      <PoliticianWallClient
        ghostId={owner?.current_ghost_id || ghostId}
        initialWallOwner={owner as any}
        initialPosts={(posts as any) || []}
        initialSupportCount={"count" in supportCountRes ? (supportCountRes as any).count || 0 : 0}
      />
    </>
  );
}
