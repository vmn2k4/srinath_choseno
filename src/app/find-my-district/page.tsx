import { Metadata } from "next";
import FindMyDistrictClient from "@/components/features/FindMyDistrictClient";
import { createClient } from "@/lib/supabase/server";
import { getUserBoundaryMemberships } from "@/lib/services/profile";
import { SITE_URL } from "@/lib/constants/site";

const BASE_URL = SITE_URL;

const pageTitle = "Find Your Electoral District, Representatives & 2026 Candidates | Choseno";
const pageDescription = "Enter your address to find your electoral boundaries, federal/provincial/municipal representatives, and all 2026 election candidates. Free, non-partisan. Supports Canada, USA, India.";
const keywords = "electoral district, find my district, representatives, elected officials, congressional district, state senate, city council, 2026 candidates, voter information, election";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: pageTitle,
  description: pageDescription,
  keywords: keywords,
  robots: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
  alternates: {
    canonical: `${BASE_URL}/find-my-district`,
  },
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: `${BASE_URL}/find-my-district`,
    siteName: "Choseno",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
    creator: "@choseno",
  },
};

// Schema.org structured data
const schemaData = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Find Your Electoral District",
  description: pageDescription,
  url: `${BASE_URL}/find-my-district`,
  image: `${BASE_URL}/og-image.png`,
  inLanguage: "en-US",
  isPartOf: {
    "@type": "Website",
    name: "Choseno",
    url: BASE_URL,
  },
  publisher: {
    "@type": "Organization",
    name: "Choseno",
    url: BASE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${BASE_URL}/logo.png`,
    },
  },
  mainEntity: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${BASE_URL}/find-my-district?location={search_term}`,
    },
    "query-input": "required name=search_term",
  },
};

export default async function FindMyDistrictPage() {
  // Same "already know your constituency" state Elections & Races reads on
  // the server (src/app/elections/page.tsx) — reused here so this screen
  // doesn't re-ask a question the app already has the answer to. See the
  // mobile audit's "location asked for twice" finding.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // FindMyDistrictClient's MatchedBoundary (unlike ElectionsPageClient's)
  // requires non-optional country/boundary_type — it does string ops
  // (.toLowerCase()) on them — so rows missing either are dropped here
  // rather than passed through with empty-string fallbacks.
  let initialBoundaries: { id: number; name: string; country: string; boundary_type: string }[] = [];

  if (user) {
    const { data: memberships } = await getUserBoundaryMemberships(supabase, user.id);
    const memRows = (memberships || []) as Array<{
      map_shape_id: number;
      map_shapes?: { id: number; name: string; country?: string; boundary_type?: string } | null;
    }>;
    initialBoundaries = memRows
      .map((m) => m.map_shapes)
      .filter((s): s is { id: number; name: string; country: string; boundary_type: string } =>
        Boolean(s && s.country && s.boundary_type)
      )
      .map((s) => ({ id: s.id, name: s.name, country: s.country, boundary_type: s.boundary_type }));
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schemaData),
        }}
      />
      <FindMyDistrictClient initialBoundaries={initialBoundaries} />
    </>
  );
}
