import { Metadata } from "next";
import PoliticianWallClient from "@/components/features/PoliticianWallClient";
import { createClient as createServerClient } from "@/lib/supabase/server";
import {
  getWallOwnerProfile,
  getWallPosts,
  getWallPostBySlugOrId,
  getSupporterCount,
} from "@/lib/services/politicianWall";
import { SITE_URL } from "@/lib/constants/site";

const BASE_URL = SITE_URL;

interface WallSlugPageProps {
  params: Promise<{ ghostId: string; slug: string }>;
}

type WallOwner = {
  id: string;
  full_name?: string;
  politician_profiles?: {
    bio?: string;
    avatar_url?: string;
    contact_email?: string | null;
    contact_phone?: string | null;
    photo_url?: string | null;
    source_url?: string | null;
    holding_since?: string | null;
  } | null;
};

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

  const [{ data: ownerData }, { data: postData }] = await Promise.all([
    getWallOwnerProfile(supabase, ghostId),
    getWallPostBySlugOrId(supabase, ghostId, slug),
  ]);

  const owner = ownerData as unknown as WallOwner | null;
  const post = postData as WallPost | null;

  const name = owner?.full_name || "Politician";
  const canonicalUrl = `${BASE_URL}/wall/${ghostId}/${slug}`;

  const postExcerpt = post?.content
    ? post.content.replace(/\s+/g, " ").trim()
    : null;

  const title = postExcerpt
    ? `"${postExcerpt.slice(0, 60)}${postExcerpt.length > 60 ? "…" : ""}" — ${name}'s Wall | Choseno`
    : `${name}'s Public Wall Thread | Choseno`;

  const description = postExcerpt
    ? postExcerpt.slice(0, 160)
    : owner?.politician_profiles?.bio
    ? owner.politician_profiles.bio.slice(0, 160)
    : `Read official updates, policy statements, and constituent discussion for ${name} on Choseno.`;

  const ogImageUrl = post?.image_url || `${BASE_URL}/wall/${ghostId}/${slug}/opengraph-image`;

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

  const [{ data: ownerData }, { data: postData }] = await Promise.all([
    getWallOwnerProfile(supabase, ghostId),
    getWallPostBySlugOrId(supabase, ghostId, slug),
  ]);
  const owner = ownerData as unknown as WallOwner | null;
  const post = postData as WallPost | null;

  const [{ data: posts }, supportCountRes] = await Promise.all([
    getWallPosts(supabase, ghostId),
    owner?.id ? getSupporterCount(supabase, owner.id) : Promise.resolve({ count: 0 }),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SocialMediaPosting",
    headline: post?.content ? post.content.slice(0, 110) : `${owner?.full_name || "Politician"}'s Public Thread`,
    articleBody: post?.content || undefined,
    datePublished: post?.created_at || undefined,
    url: `${BASE_URL}/wall/${ghostId}/${slug}`,
    author: owner
      ? {
          "@type": "Person",
          name: owner.full_name || "Politician",
          url: `${BASE_URL}/wall/${ghostId}`,
          image: owner.politician_profiles?.avatar_url || undefined,
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
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <PoliticianWallClient
        ghostId={ghostId}
        initialWallOwner={owner as any}
        initialPosts={(posts as any) || []}
        initialSupportCount={"count" in supportCountRes ? supportCountRes.count || 0 : 0}
      />
    </>
  );
}
