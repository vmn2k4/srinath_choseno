import { Metadata } from "next";
import AdminNewsPageClient from "@/components/features/AdminNewsPageClient";

export const metadata: Metadata = {
  title: "News Management | Choseno Admin",
  description: "Create, upload, and manage news articles for the Choseno platform.",
};

export default function AdminNewsPage() {
  return <AdminNewsPageClient />;
}
