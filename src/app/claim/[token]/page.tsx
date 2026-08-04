import { Metadata } from "next";
import ClaimCandidacyClient from "@/components/features/ClaimCandidacyClient";

interface ClaimPageProps {
  params: Promise<{ token: string }>;
}

export const metadata: Metadata = {
  title: "Claim Candidacy | Choseno",
  description: "Redeem your candidate claim invitation on Choseno.",
};

export default async function ClaimPage({ params }: ClaimPageProps) {
  const { token } = await params;
  return <ClaimCandidacyClient token={token} />;
}
