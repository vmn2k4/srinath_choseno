import { Metadata } from "next";
import { SITE_URL } from "@/lib/constants/site";
import Link from "next/link";

const BASE_URL = SITE_URL;
const LAST_UPDATED = "October 16, 2026";

export const metadata: Metadata = {
  title: "Child Safety Standards | Choseno",
  description:
    "Choseno's standards against child sexual abuse and exploitation (CSAE): what is prohibited, how to report it, and how we respond.",
  alternates: { canonical: `${BASE_URL}/child-safety` },
  robots: { index: true, follow: true },
};

export default function ChildSafetyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-10">
      <header className="space-y-3 border-b border-border pb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-text-main">Child Safety Standards</h1>
        <p className="text-sm text-text-muted">Last updated: {LAST_UPDATED}</p>
      </header>

      <div className="space-y-10 text-text-muted leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">1. Our position</h2>
          <p>
            Choseno has zero tolerance for child sexual abuse and exploitation (CSAE), including child sexual abuse material (CSAM), grooming, sextortion, and any content that sexualizes or endangers minors. Choseno is a civic platform for adults and teenagers aged 16 and older to discuss elected officials and elections. It is not intended for children under 13, and we do not knowingly allow them to use it.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">2. What is prohibited</h2>
          <ul className="list-disc list-inside space-y-2 mt-2">
            <li>Any imagery, video, or text that sexually depicts or sexualizes a minor</li>
            <li>Soliciting, sharing, requesting, or linking to CSAM</li>
            <li>Grooming, sexual messages to minors, or attempts to meet minors for sexual purposes</li>
            <li>Threats or coercion involving intimate images of minors</li>
            <li>Accounts or content that promote or normalize child abuse</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">3. How to report</h2>
          <p>
            Anyone can report a user or piece of content inside the Choseno app and on the website using the report button on posts, comments, and profiles. You can also email us directly at{" "}
            <a href="mailto:contact@choseno.com" className="text-primary hover:underline">contact@choseno.com</a>
            {" "}with the subject &ldquo;Child Safety.&rdquo; If a child is in immediate danger, contact your local emergency services first.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">4. How we respond</h2>
          <ul className="list-disc list-inside space-y-2 mt-2">
            <li>We review child-safety reports as a priority and remove violating content.</li>
            <li>We suspend or permanently remove accounts that violate these standards.</li>
            <li>
              We report confirmed CSAM and other CSAE to the relevant authorities, such as the National Center for Missing &amp; Exploited Children (NCMEC) in the United States, and cooperate with law enforcement as required by law.
            </li>
            <li>Users can block other users and content in the app.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">5. Compliance</h2>
          <p>
            We aim to comply with applicable child-safety laws and Google Play&apos;s Child Safety Standards policy. Choseno is an early-stage product currently in beta, and we are continuing to improve our moderation tools.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">6. Contact</h2>
          <p>
            Our designated contact for child-safety matters is{" "}
            <a href="mailto:contact@choseno.com" className="text-primary hover:underline">contact@choseno.com</a>.
          </p>
        </section>
      </div>

      <div className="pt-6 border-t border-border flex flex-wrap gap-4 text-sm text-text-muted">
        <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>
        <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
        <Link href="/" className="text-primary hover:underline">Home</Link>
      </div>
    </div>
  );
}
