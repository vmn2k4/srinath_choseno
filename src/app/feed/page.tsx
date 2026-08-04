import { Metadata } from "next";
import FeedPageClient from "@/components/features/FeedPageClient";

export const metadata: Metadata = {
  title: "Constituency Feed | Choseno",
  description: "View local civic discussions, endorse issues, and connect with your district.",
};

export default function FeedPage() {
  return <FeedPageClient />;
}
