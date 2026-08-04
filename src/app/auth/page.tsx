import { Metadata } from "next";
import AuthPageClient from "@/components/features/AuthPageClient";

export const metadata: Metadata = {
  title: "Sign In / Sign Up | Choseno",
  description: "Sign in to access your local constituency feed and electoral district updates.",
};

export default function AuthPage() {
  return <AuthPageClient />;
}
