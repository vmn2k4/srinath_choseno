import { Metadata } from "next";
import GoogleAnalyticsAdminClient from "@/components/features/GoogleAnalyticsAdminClient";

export const metadata: Metadata = {
  title: "Google Analytics | Choseno Admin",
  description: "Live visitor traffic, geography, and engagement from GA4.",
};

export default function GoogleAnalyticsAdminPage() {
  return <GoogleAnalyticsAdminClient />;
}
