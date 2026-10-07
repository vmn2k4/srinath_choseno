import { Metadata } from "next";
import SignupSourcesAdminClient from "@/components/features/SignupSourcesAdminClient";

export const metadata: Metadata = {
  title: "Signup Sources | Choseno Admin",
  description: "What brings visitors to sign up: trigger, landing page, referrer, navigation trail.",
};

export default function SignupSourcesAdminPage() {
  return <SignupSourcesAdminClient />;
}
