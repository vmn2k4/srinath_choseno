import { Metadata } from "next";
import RegionExplorerAdminClient from "@/components/features/RegionExplorerAdminClient";

export const metadata: Metadata = {
  title: "Region & Funnel Explorer | Choseno Admin",
  description: "Pages viewed, engagement time, landing pages, and CTA clicks by country, province/state, and city.",
};

export default function RegionExplorerAdminPage() {
  return <RegionExplorerAdminClient />;
}
