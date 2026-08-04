import { Metadata } from "next";
import BoundaryVisualizerClient from "@/components/features/BoundaryVisualizerClient";

export const metadata: Metadata = {
  title: "Boundary Inspector | Choseno Admin",
  description: "Inspect geospatial polygons, boundary container coverage, and shape codes.",
};

export default function VisualizeAdminPage() {
  return <BoundaryVisualizerClient />;
}
