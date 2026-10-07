import { Metadata } from "next";
import AdminPageClient from "@/components/features/AdminPageClient";

export const metadata: Metadata = {
  title: "Geospatial Boundaries Admin | Choseno",
  description: "Manage country codes, boundary types, shapefile uploads, and electoral redistricting.",
};

export default function AdminPage() {
  return <AdminPageClient />;
}
