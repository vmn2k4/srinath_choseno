import { Metadata } from "next";
import OpenAppPrompt from "@/components/features/OpenAppPrompt";

export const metadata: Metadata = {
  title: "Confirm your email | Choseno",
  robots: { index: false, follow: false },
};

// Landing page for the confirmation / password-reset email of people who use
// the Choseno mobile app. It deliberately does NOT confirm anything on load —
// email scanners prefetch links and would use up the single-use token. The
// token is only spent when the person taps one of the two buttons.
export default async function OpenAppPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const tokenHash = typeof params.token_hash === "string" ? params.token_hash : "";
  // Only sign-up confirmation and password reset use this page; reject
  // anything else rather than building an app link for an arbitrary type.
  const type = params.type === "signup" || params.type === "recovery" ? params.type : "";
  const valid = /^[A-Za-z0-9_-]{10,256}$/.test(tokenHash) && type !== "";
  return <OpenAppPrompt tokenHash={valid ? tokenHash : ""} type={type} />;
}
