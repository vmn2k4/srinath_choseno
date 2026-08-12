import { Metadata } from "next";
import FindMyDistrictClient from "@/components/features/FindMyDistrictClient";
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

export default function FindMyDistrictPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schemaData),
        }}
      />
      <FindMyDistrictClient />
    </>
  );
}
