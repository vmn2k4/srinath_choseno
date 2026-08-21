import { Metadata } from "next";
import HomePageClient from "@/components/features/HomePageClient";
import { createPublicClient } from "@/lib/supabase/publicServer";
import { getPublishedNewsArticles } from "@/lib/services/news";
import { SITE_URL, SITE_NAME } from "@/lib/constants/site";

const BASE_URL = SITE_URL;

// getPublishedNewsArticles below is pure public data (status = 'published'
// AND published_at <= now(), same as every other public-read page) -- no
// auth.uid() branch, so createPublicClient (cookie-free) is safe here. This
// used to import the cookie-reading server client for this same query,
// which -- per publicServer.ts's own warning -- forces the entire route to
// render dynamically on every request with zero caching, on what's the
// single highest-traffic page on the site. Sign-in state itself is read
// client-side by HomePageClient via AuthContext, not from this SSR pass.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Choseno — Rate Your Politician & See 2026 Candidate Reviews",
  description:
    "Rate your politicians' performance — like Google Reviews, but for democracy. We research restaurants before eating, why not politicians before voting? Find your district and rate your representatives today.",
  alternates: { canonical: BASE_URL },
  openGraph: {
    title: "Rate Your Politicians' Performance. Like Google Reviews, but for Democracy.",
    description:
      "We research restaurants before eating, why not politicians before voting? Locate yourself, find who holds office in your area, and start rating them today.",
    url: BASE_URL,
    siteName: SITE_NAME,
    type: "website",
    images: [
      {
        url: `${BASE_URL}/og-home.jpg`,
        width: 1200,
        height: 630,
        alt: "Choseno — Rate Your Politicians' Performance. Like Google Reviews, but for Democracy.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rate Your Politicians' Performance. Like Google Reviews, but for Democracy.",
    description:
      "We research restaurants before eating, why not politicians before voting? Locate yourself, find who holds office in your area, and start rating them today.",
    images: [`${BASE_URL}/og-home.jpg`],
  },
};

export default async function Page() {
  const supabase = await createPublicClient();
  const { data: articles } = await getPublishedNewsArticles(supabase, { limit: 6 });
  const latestNews = (articles || []).map((a) => ({
    slug: a.slug,
    headline: a.headline,
    summary: a.summary,
    category: a.category,
    publishedAt: a.published_at,
  }));

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE_NAME,
      url: BASE_URL,
      logo: `${BASE_URL}/icon.svg`,
      description:
        "Choseno connects citizens and candidates inside real electoral boundaries — an anonymous, hyperlocal civic network free of party influence.",
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: BASE_URL,
      potentialAction: {
        "@type": "SearchAction",
        target: `${BASE_URL}/elections?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is Choseno?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Choseno is an anonymous civic platform—like Google Reviews, but for democracy. It lets citizens rate local politicians, compare 2026 midterm election candidates, and leave constituent reviews in real electoral districts.",
          },
        },
        {
          "@type": "Question",
          name: "Is Choseno free and anonymous?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes, Choseno is 100% free to use. Voters participate under rotating anonymous Ghost IDs to share honest constituent feedback without exposing their personal identities.",
          },
        },
        {
          "@type": "Question",
          name: "How do I find 2026 midterm candidates on my ballot?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Use Choseno's interactive 'Find My District' tool or Elections Directory to view all 2026 U.S. House and Senate candidates running in your state and district.",
          },
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
      <HomePageClient latestNews={latestNews} />
    </>
  );
}
