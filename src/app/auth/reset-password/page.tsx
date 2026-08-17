import { Metadata } from "next";
import ResetPasswordClient from "@/components/features/ResetPasswordClient";

export const metadata: Metadata = {
  title: "Set New Password | Choseno",
  description: "Choose a new password for your Choseno account.",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const nextParam = typeof params.next === "string" ? params.next : undefined;
  const nextPath = nextParam?.startsWith("/") && !nextParam.startsWith("//") ? nextParam : undefined;

  return <ResetPasswordClient nextPath={nextPath} />;
}
