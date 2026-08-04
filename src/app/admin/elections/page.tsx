import { Metadata } from "next";
import { Suspense } from "react";
import ElectionsAdminClient from "@/components/features/ElectionsAdminClient";
import Spinner from "@/components/primitives/Spinner";

export const metadata: Metadata = {
  title: "Elections & Seats Admin | Choseno",
  description: "Create elections, provision seats, manage candidate applications, and define questionnaires.",
};

export default function ElectionsAdminPage() {
  return (
    <Suspense fallback={<Spinner fullPage />}>
      <ElectionsAdminClient />
    </Suspense>
  );
}
