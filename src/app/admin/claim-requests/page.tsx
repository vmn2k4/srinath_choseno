import { Metadata } from "next";
import AdminClaimRequestsClient from "@/components/features/AdminClaimRequestsClient";

export const metadata: Metadata = {
  title: "Profile Claim Requests Admin | Choseno",
  description: "Review, approve, and manage incoming candidate and politician profile claim requests.",
};

export default function ClaimRequestsAdminHyphenPage() {
  return <AdminClaimRequestsClient />;
}
