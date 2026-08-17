import { Metadata } from "next";
import AboutPageClient from "@/components/features/AboutPageClient";
import { SITE_URL, SITE_NAME } from "@/lib/constants/site";

const BASE_URL = SITE_URL;

export const metadata: Metadata = {
  title: "About Choseno — Independent Hyperlocal Civic Platform",
  description:
    "Choseno connects citizens and candidates inside real electoral boundaries — an anonymous, hyperlocal civic network free of party influence.",
  alternates: { canonical: `${BASE_URL}/about` },
  openGraph: {
    title: "About Choseno — Independent Hyperlocal Civic Platform",
    description:
      "Choseno connects citizens and candidates inside real electoral boundaries — an anonymous, hyperlocal civic network free of party influence.",
    url: `${BASE_URL}/about`,
    siteName: SITE_NAME,
    type: "website",
    images: [
      {
        url: `${BASE_URL}/og-about.jpg`,
        width: 1200,
        height: 630,
        alt: "About Choseno — Independent Hyperlocal Civic Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "About Choseno — Independent Hyperlocal Civic Platform",
    description:
      "Choseno connects citizens and candidates inside real electoral boundaries — an anonymous, hyperlocal civic network free of party influence.",
    images: [`${BASE_URL}/og-about.jpg`],
  },
};

export default function AboutPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "About Choseno",
    url: `${BASE_URL}/about`,
    description:
      "Choseno is an independent civic platform created by Murugappan Valliyappan to give every citizen a voice in political conversations — not just on election day.",
    author: {
      "@type": "Person",
      name: "Murugappan Valliyappan",
      url: "https://www.linkedin.com/in/muruvalliyappan/",
      sameAs: ["https://www.linkedin.com/in/muruvalliyappan/"],
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: BASE_URL,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <AboutPageClient />
    </>
  );
}
