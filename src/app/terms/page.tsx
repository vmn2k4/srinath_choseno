import { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/constants/site";
import Link from "next/link";

const BASE_URL = SITE_URL;
const LAST_UPDATED = "August 10, 2026";

export const metadata: Metadata = {
  title: "Terms of Service | Choseno",
  description:
    "Read Choseno's Terms of Service. Choseno is a user-generated civic social platform. Users are responsible for content they post. Choseno does not endorse or verify user-submitted content.",
  alternates: { canonical: `${BASE_URL}/terms` },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-10">
      <header className="space-y-3 border-b border-border pb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-text-main">Terms of Service</h1>
        <p className="text-sm text-text-muted">
          Effective date: {LAST_UPDATED} &nbsp;|&nbsp; Operated by: Choseno (
          <Link href="/about" className="text-primary hover:underline">About Us</Link>)
        </p>
      </header>

      <div className="space-y-10 text-text-muted leading-relaxed">

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">1. Acceptance of Terms</h2>
          <p>
            By accessing or using Choseno (&ldquo;the platform,&rdquo; &ldquo;the service,&rdquo; &ldquo;we,&rdquo; or &ldquo;us&rdquo;), you agree to be bound by these Terms of Service and our{" "}
            <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>. If you do not agree, do not use the platform.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">2. Description of Service</h2>
          <p>
            Choseno is an independent, user-generated civic social media platform that allows citizens to anonymously review, rate, and discuss elected officials and political candidates in their electoral districts. Choseno is not a news organization, a political party, a PAC, or an election authority. It is a neutral public forum for civic conversation.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">3. User-Generated Content — Platform Liability Shield</h2>
          <p>
            Choseno is a social media platform that hosts user-generated content (UGC). Under Section 230 of the Communications Decency Act and equivalent applicable laws:
          </p>
          <ul className="list-disc list-inside space-y-2 mt-2">
            <li>Choseno is <strong className="text-text-main">not the author or publisher</strong> of user-generated content.</li>
            <li>Choseno is <strong className="text-text-main">not liable</strong> for any user-submitted reviews, ratings, comments, posts, or discussions.</li>
            <li>Users are <strong className="text-text-main">solely responsible</strong> for the content they submit and its accuracy, legality, and appropriateness.</li>
            <li>Choseno does <strong className="text-text-main">not verify or endorse</strong> any user-submitted content.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">4. User Conduct</h2>
          <p>By using Choseno, you agree not to:</p>
          <ul className="list-disc list-inside space-y-2 mt-2">
            <li>Post false, defamatory, or knowingly misleading information about any person</li>
            <li>Harass, threaten, or intimidate any individual, candidate, or elected official</li>
            <li>Post content that is illegal, obscene, or violates any third party's rights</li>
            <li>Attempt to manipulate ratings through fake accounts or coordinated inauthentic behavior</li>
            <li>Use the platform for any commercial advertising or political fundraising</li>
            <li>Impersonate any politician, candidate, or other person</li>
            <li>Scrape, crawl, or extract platform data in bulk without written permission</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">5. Anonymous Ghost ID System</h2>
          <p>
            Choseno uses a rotating &ldquo;Ghost ID&rdquo; system to protect user anonymity. Your public activity is never directly linked to your real identity. However, Choseno may be legally required to disclose account information if compelled by a valid court order or law enforcement request related to illegal activity. Anonymity does not grant permission to engage in illegal conduct.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">6. Public Official &amp; Candidate Information</h2>
          <p>
            Politician and candidate profile data displayed on Choseno is sourced from publicly available official government records and campaign filings. This constitutes fair use of public civic information. Public officials have a reduced expectation of privacy regarding their exercise of public duties.
          </p>
          <p>
            If you are a public official and believe information displayed about you is factually incorrect, contact us at <a href="mailto:contact@choseno.com" className="text-primary hover:underline">contact@choseno.com</a> and we will investigate.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">7. Content Moderation</h2>
          <p>
            Choseno reserves the right — but not the obligation — to remove content that violates these Terms of Service. We are not responsible for failing to remove any particular content. Content removal decisions are made at our sole discretion.
          </p>
          <p>
            To report content that you believe violates these terms, use the in-platform report button or contact us at <a href="mailto:contact@choseno.com" className="text-primary hover:underline">contact@choseno.com</a>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">8. Disclaimer of Warranties</h2>
          <p>
            Choseno is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, either express or implied. We do not warrant that the platform will be uninterrupted, error-free, or free of viruses or other harmful components. We do not warrant the accuracy of any candidate or politician data displayed on the platform.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">9. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by applicable law, Choseno, its founders, operators, and affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the platform or from any content posted by users, including but not limited to defamatory statements, inaccurate ratings, or any other user-generated content.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">10. Intellectual Property</h2>
          <p>
            The Choseno name, logo, and platform design are owned by Choseno. User-generated content remains the intellectual property of its authors, subject to the non-exclusive license granted in our Privacy Policy. You may not reproduce, copy, or distribute Choseno&apos;s platform design or proprietary features without written permission.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">11. Governing Law</h2>
          <p>
            These Terms of Service are governed by the laws of the applicable jurisdiction in which Choseno operates. Any disputes shall be resolved through good-faith negotiation before pursuing legal remedies.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">12. Changes to These Terms</h2>
          <p>
            We may revise these Terms from time to time. We will notify users of significant changes through the platform. Continued use of Choseno following any revision constitutes acceptance of the updated Terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">13. Contact</h2>
          <p>
            Questions about these terms? Contact us at:{" "}
            <a href="mailto:contact@choseno.com" className="text-primary hover:underline">contact@choseno.com</a>
          </p>
        </section>
      </div>

      <div className="pt-6 border-t border-border flex flex-wrap gap-4 text-sm text-text-muted">
        <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
        <Link href="/about" className="text-primary hover:underline">About Choseno</Link>
        <Link href="/" className="text-primary hover:underline">Home</Link>
      </div>
    </div>
  );
}
