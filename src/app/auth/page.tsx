import { Metadata } from "next";
import AuthPageClient from "@/components/features/AuthPageClient";

export const metadata: Metadata = {
  title: "Sign In / Sign Up | Choseno",
  description: "Sign in to access your local constituency feed and electoral district updates.",
  robots: { index: false, follow: false },
};

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const roleParam = typeof params.role === "string" ? params.role : undefined;
  const initialRole = roleParam === "citizen" || roleParam === "politician" ? roleParam : undefined;
  const nextParam = typeof params.next === "string" ? params.next : undefined;
  const nextPath = nextParam?.startsWith("/") && !nextParam.startsWith("//") ? nextParam : undefined;
  // Lets a link force the Log In tab even when role is set (e.g. the
  // officeholder claim email's "merge with my existing account" link) —
  // independent of initialRole, which otherwise always defaults to Sign Up.
  const initialIntent = params.intent === "login" ? "login" : undefined;

  return <AuthPageClient initialRole={initialRole} nextPath={nextPath} initialIntent={initialIntent} />;
}
