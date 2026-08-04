import { Metadata } from "next";
import PoliticianElectionsClient from "@/components/features/PoliticianElectionsClient";

export const metadata: Metadata = {
  title: "My Elections & Candidacies | Choseno",
  description: "Manage your candidacies, view open seats, and apply for election roles.",
};

export default function PoliticianElectionsPage() {
  return <PoliticianElectionsClient />;
}
