import { Metadata } from "next";
import OfficeHoldersAdminClient from "@/components/features/OfficeHoldersAdminClient";

export const metadata: Metadata = {
  title: "Office Holders | Choseno Admin",
  description: "Set the current officeholder shown on each boundary's public directory page.",
  robots: { index: false, follow: false },
};

export default function OfficeHoldersAdminPage() {
  return <OfficeHoldersAdminClient />;
}
