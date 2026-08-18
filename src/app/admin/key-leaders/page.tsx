import { Metadata } from "next";
import KeyLeadersAdminClient from "@/components/features/KeyLeadersAdminClient";

export const metadata: Metadata = {
  title: "Key Political Leaders | Choseno Admin",
  description: "Manage the always-top-of-search priority roster of key political leaders.",
  robots: { index: false, follow: false },
};

export default function KeyLeadersAdminPage() {
  return <KeyLeadersAdminClient />;
}
