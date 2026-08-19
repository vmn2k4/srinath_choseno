import { Metadata } from "next";
import AdminNewsDistributionClient from "@/components/features/AdminNewsDistributionClient";

export const metadata: Metadata = {
  title: "News Distribution & Batches | Choseno Admin",
  description: "Track, filter, sort, and distribute published news articles across social media channels with batch management.",
};

export default function AdminNewsDistributionPage() {
  return <AdminNewsDistributionClient />;
}
