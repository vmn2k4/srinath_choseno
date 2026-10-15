import { Metadata } from "next";
import { SITE_URL } from "@/lib/constants/site";
import DeleteAccountClient from "./DeleteAccountClient";

export const metadata: Metadata = {
  title: "Delete Your Account | Choseno",
  description:
    "How to delete your Choseno account and what data is removed. Delete in the app (Profile → Delete account) or here.",
  alternates: { canonical: `${SITE_URL}/delete-account` },
  robots: { index: true, follow: true },
};

export default function DeleteAccountPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
      <header className="space-y-3 border-b border-border pb-6">
        <h1 className="text-3xl font-extrabold text-text-main">Delete your Choseno account</h1>
        <p className="text-text-muted">
          You can delete your account at any time, in the Choseno app (Profile → Delete account) or on this page.
        </p>
      </header>

      <section className="space-y-2 text-text-muted leading-relaxed">
        <h2 className="text-lg font-bold text-text-main">What is deleted</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Your account, email address and sign-in methods.</li>
          <li>Your profile, saved location and boundary memberships.</li>
          <li>Posts, comments and votes made under your current anonymous identity.</li>
          <li>Your reports, blocks and other account settings.</li>
        </ul>
        <h2 className="text-lg font-bold text-text-main pt-3">What can remain</h2>
        <p>
          Choseno stores posts under a random anonymous ID, not your account. If you reset your identity in the past,
          content under the old ID can no longer be linked to you, so it cannot be removed and stays online with no
          connection to you. Aggregated, non-identifying statistics may also be kept.
        </p>
        <h2 className="text-lg font-bold text-text-main pt-3">Can&apos;t sign in?</h2>
        <p>
          Email{" "}
          <a href="mailto:contact@choseno.com?subject=Delete%20my%20account" className="text-primary hover:underline">
            contact@choseno.com
          </a>{" "}
          from the address on your account and we will delete it.
        </p>
      </section>

      <DeleteAccountClient />
    </div>
  );
}
