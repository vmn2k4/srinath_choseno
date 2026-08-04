import { Metadata } from "next";
import CandidateApplicationClient from "@/components/features/CandidateApplicationClient";

interface ApplyPageProps {
  params: Promise<{ candidateId: string }>;
}

export const metadata: Metadata = {
  title: "Candidate Application & Questionnaire | Choseno",
  description: "Complete your candidate questionnaire, video statements, and platform position answers.",
};

export default async function ApplyPage({ params }: ApplyPageProps) {
  const { candidateId } = await params;
  return <CandidateApplicationClient candidateId={candidateId} />;
}
