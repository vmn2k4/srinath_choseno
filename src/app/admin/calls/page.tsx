import { Metadata } from "next";
import CallCampaignDashboardClient from "@/components/features/CallCampaignDashboardClient";

export const metadata: Metadata = {
  title: "Calls | Choseno Admin",
  description: "Outbound candidate-outreach call log: status, transcript, outcome, and follow-up email tracking.",
  robots: { index: false, follow: false },
};

export default function CallsAdminPage() {
  return <CallCampaignDashboardClient />;
}
