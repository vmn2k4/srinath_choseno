import { Metadata } from "next";
import HomePageClient from "@/components/features/HomePageClient";

const BASE_URL = "https://choseno.com";

export const metadata: Metadata = {
  title: "Choseno — Anonymous Civic Network for Local Politics",
  description:
    "Choseno connects citizens and independent candidates inside real, verified electoral boundaries — an anonymous, hyperlocal civic network free of party influence. Join your district's feed, or find open seats to run for local office.",
  alternates: { canonical: BASE_URL },
  openGraph: {
    title: "Choseno — Your voice, heard where you live",
    description:
      "An anonymous, hyperlocal civic network connecting citizens and independent candidates inside real electoral boundaries.",
    url: BASE_URL,
    siteName: "Choseno",
    type: "website",
    images: [
      {
        url: `${BASE_URL}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "Choseno — Your voice, heard where you live",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Choseno — Scoped Civic Platform",
    description:
      "Choseno connects citizens and independent candidates inside real electoral boundaries.",
    images: [`${BASE_URL}/opengraph-image`],
  },
};

export default function Page() {
  return <HomePageClient />;
}
