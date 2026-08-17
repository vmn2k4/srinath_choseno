import { Metadata } from "next";
import SearchConsoleAdminClient from "@/components/features/SearchConsoleAdminClient";

export const metadata: Metadata = {
  title: "Google Search Console | Choseno Admin",
  description: "SEO performance, search queries, and impressions from Google Search Console.",
};

export default function SearchConsoleAdminPage() {
  return <SearchConsoleAdminClient />;
}
