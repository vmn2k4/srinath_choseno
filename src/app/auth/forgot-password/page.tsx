import { Metadata } from "next";
import ForgotPasswordClient from "@/components/features/ForgotPasswordClient";

export const metadata: Metadata = {
  title: "Reset Password | Choseno",
  description: "Reset the password for your Choseno account.",
  robots: { index: false, follow: false },
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const nextParam = typeof params.next === "string" ? params.next : undefined;
  const nextPath = nextParam?.startsWith("/") && !nextParam.startsWith("//") ? nextParam : undefined;

  return <ForgotPasswordClient nextPath={nextPath} />;
}
