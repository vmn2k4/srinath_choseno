import { Metadata } from "next";
import ModerationPageClient from "@/components/features/ModerationPageClient";

export const metadata: Metadata = {
  title: "Moderation Admin | Choseno",
  description: "Review flagged content, remove or dismiss reports, and tune auto-removal rules.",
};

export default function ModerationPage() {
  return <ModerationPageClient />;
}
