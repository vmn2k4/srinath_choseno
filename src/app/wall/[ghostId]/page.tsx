import { Metadata } from "next";
import PoliticianWallClient from "@/components/features/PoliticianWallClient";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getWallOwnerProfile, getWallPosts, getSupporterCount } from "@/lib/services/politicianWall";

const BASE_URL = "https://choseno.com";

interface WallPageProps {
  params: Promise<{ ghostId: string }>;
}

type WallOwner = {
  id: string;
  full_name?: string;
  politician_profiles?: { bio?: string; avatar_url?: string } | null;
};

export async function generateMetadata({
  params,
}: WallPageProps): Promise<Metadata> {
  const { ghostId } = await params;
  const supabase = await createServerClient();
  const { data } = await getWallOwnerProfile(supabase, ghostId);
  const owner = data as unknown as WallOwner | null;

  const name = owner?.full_name || "Politician";
  const bio = owner?.politician_profiles?.bio || "";
  const canonicalUrl = `${BASE_URL}/wall/${ghostId}`;
  const ogImageUrl = `${BASE_URL}/wall/${ghostId}/opengraph-image`;

  const title = `${name}'s Public Wall | Choseno`;
  const description = bio
    ? bio.slice(0, 160)
    : `Official public wall, policy positions, and constituent updates for ${name} on Choseno.`;

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

  const { data: ownerData } = await getWallOwnerProfile(supabase, ghostId);
  const owner = ownerData as unknown as WallOwner | null;

  const [{ data: posts }, supportCountRes] = await Promise.all([
    getWallPosts(supabase, ghostId),
    owner?.id ? getSupporterCount(supabase, owner.id) : Promise.resolve({ count: 0 }),
  ]);

  const jsonLd = owner
    ? {
        "@context": "https://schema.org",
        "@type": "Person",
        name: owner.full_name || "Politician",
        description: owner.politician_profiles?.bio || undefined,
        image: owner.politician_profiles?.avatar_url || undefined,
        url: `${BASE_URL}/wall/${ghostId}`,
      }
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
        ghostId={ghostId}
        initialWallOwner={owner as any}
        initialPosts={(posts as any) || []}
        initialSupportCount={"count" in supportCountRes ? supportCountRes.count || 0 : 0}
      />
    </>
  );
}
