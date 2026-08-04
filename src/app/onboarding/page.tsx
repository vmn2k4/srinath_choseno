import { Metadata } from "next";
import OnboardingFlowClient from "@/components/features/OnboardingFlowClient";

export const metadata: Metadata = {
  title: "Onboarding | Choseno",
  description: "Set up your civic identity and electoral boundary memberships on Choseno.",
  robots: { index: false, follow: false },
};

export default function OnboardingPage() {
  return <OnboardingFlowClient />;
}
