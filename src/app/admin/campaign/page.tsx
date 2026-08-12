import { Metadata } from "next";
import CampaignAdminClient from "@/components/features/CampaignAdminClient";

export const metadata: Metadata = {
  title: "Campaign | Choseno Admin",
  description: "Import a CSV or JSON list of politicians and send personalized wall-claim invitations.",
  robots: { index: false, follow: false },
};

export default function CampaignAdminPage() {
  return <CampaignAdminClient />;
}
