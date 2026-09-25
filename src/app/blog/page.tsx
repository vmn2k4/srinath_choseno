import { Metadata } from "next";
import { getAllBlogPosts } from "@/lib/services/blogs";
import { SITE_URL } from "@/lib/constants/site";
import BlogHubClient from "@/components/features/BlogHubClient";

const BASE_URL = SITE_URL;

export const metadata: Metadata = {
  title: "Civic & Election Guides: Understanding Your Leaders, Voting & Local Government | Choseno",
  description:
    "Comprehensive, non-partisan guides to finding your representative, local elections, government powers, candidate vetting, and holding elected officials accountable in the US and Canada.",
  keywords: [
    "who is my representative",
    "how to vote",
    "local election guide",
    "city council powers",
    "school board trustee duties",
    "rate my politician",
    "voter registration deadlines",
    "candidate video interviews",
    "civic education",
    "US politics guide",
  ],
  alternates: {
    canonical: `${BASE_URL}/blog`,
    types: {
      "application/rss+xml": `${BASE_URL}/blog/rss.xml`,
    },
  },
  openGraph: {
    title: "Civic & Election Guides: Understanding Your Leaders, Voting & Local Government | Choseno",
    description:
      "Comprehensive, non-partisan guides to finding your representative, local elections, government powers, candidate vetting, and holding elected officials accountable in the US and Canada.",
    url: `${BASE_URL}/blog`,
    siteName: "Choseno",
    type: "website",
    images: [
      {
        url: `${BASE_URL}/og-news.jpg`,
        width: 1200,
        height: 630,
        alt: "Choseno Civic & Election Knowledge Base",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Civic & Election Guides: Understanding Your Leaders, Voting & Local Government | Choseno",
    description:
      "Comprehensive, non-partisan guides to finding your representative, local elections, government powers, candidate vetting, and holding elected officials accountable in the US and Canada.",
    images: [`${BASE_URL}/og-news.jpg`],
  },
};

export default async function BlogIndexPage() {
  const posts = await getAllBlogPosts();

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Choseno Civic & Election Knowledge Base",
    description:
      "Comprehensive, non-partisan guides to finding your representative, local elections, government powers, candidate vetting, and holding elected officials accountable in the US and Canada.",
    url: `${BASE_URL}/blog`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: posts.map((post, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        name: post.title,
        url: `${BASE_URL}/blog/${post.slug}`,
      })),
    },
  };

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 pt-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(collectionSchema).replace(/</g, "\\u003c"),
        }}
      />
      <BlogHubClient initialPosts={posts} />
    </div>
  );
}
