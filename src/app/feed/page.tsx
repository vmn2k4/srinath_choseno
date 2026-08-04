import { Metadata } from "next";
import FeedPageClient from "@/components/features/FeedPageClient";

export const metadata: Metadata = {
  title: "Constituency Feed | Choseno",
  description: "View local civic discussions, endorse issues, and connect with your district.",
  robots: { index: false, follow: false },
};

export default function FeedPage() {
  return <FeedPageClient />;
}
