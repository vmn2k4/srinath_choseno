import { Metadata } from "next";
import AuthPageClient from "@/components/features/AuthPageClient";

export const metadata: Metadata = {
  title: "Sign In / Sign Up | Choseno",
  description: "Sign in to access your local constituency feed and electoral district updates.",
};

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const roleParam = typeof params.role === "string" ? params.role : undefined;
  const initialRole = roleParam === "citizen" || roleParam === "politician" ? roleParam : undefined;

  return <AuthPageClient initialRole={initialRole} />;
}
