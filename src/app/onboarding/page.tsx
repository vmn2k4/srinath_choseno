import { Metadata } from "next";
import OnboardingFlowClient from "@/components/features/OnboardingFlowClient";

export const metadata: Metadata = {
  title: "Onboarding | Choseno",
  description: "Set up your civic identity and electoral boundary memberships on Choseno.",
  robots: { index: false, follow: false },
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const roleParam = typeof params.role === "string" ? params.role : undefined;
  const initialRole = roleParam === "citizen" || roleParam === "politician" ? roleParam : undefined;

  return <OnboardingFlowClient initialRole={initialRole} />;
}
