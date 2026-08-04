import { Metadata } from "next";
import ElectionAdminApplicationsClient from "@/components/features/ElectionAdminApplicationsClient";

export const metadata: Metadata = {
  title: "Seat Administrators | Choseno Admin",
  description: "Review pending applications for local election seat administrator roles.",
};

export default function ElectionAdminApplicationsPage() {
  return <ElectionAdminApplicationsClient />;
}
