import { Metadata } from "next";
import NewsImportAdminClient from "@/components/features/NewsImportAdminClient";

export const metadata: Metadata = {
  title: "Bulk News Import | Choseno Admin",
  description: "Generate backdated news coverage for many office holders at once, tagged to their walls.",
};

export default function AdminNewsImportPage() {
  return <NewsImportAdminClient />;
}
