import { Metadata } from "next";
import AnalyticsAdminClient from "@/components/features/AnalyticsAdminClient";

export const metadata: Metadata = {
  title: "Platform Analytics | Choseno Admin",
  description: "View user growth, civic engagement stickiness, and activity metrics.",
};

export default function AnalyticsAdminPage() {
  return <AnalyticsAdminClient />;
}
