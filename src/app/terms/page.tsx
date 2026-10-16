import { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/constants/site";
import Link from "next/link";

const BASE_URL = SITE_URL;
const LAST_UPDATED = "October 16, 2026";

export const metadata: Metadata = {
  title: "Terms of Service | Choseno",
  description:
    "Read Choseno's Terms of Service. Learn user content rules, Section 230 platform liability protections, and platform guidelines for civic discussion.",
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
          <p>By accessing or using Choseno (&ldquo;the platform,&rdquo; &ldquo;the service,&rdquo; &ldquo;we,&rdquo; or &ldquo;us&rdquo;), you agree to be bound by these Terms of Service and our <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>. You must be at least 13 years old to use Choseno. If you do not agree, do not use the platform.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">2. Beta Service</h2>
          <p>Choseno is an early-stage startup product currently in <strong className="text-text-main">beta</strong>. Features may be incomplete, change, or stop working without notice, and data may be lost or reset. We strive to deliver every feature described on the website and app, but we do not guarantee that any feature, content, or data will be available, accurate, complete, or work as intended.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">3. Description of Service</h2>
          <p>Choseno is an independent, user-generated civic platform that allows citizens to anonymously review, rate, and discuss elected officials and political candidates in their electoral districts. Choseno is not a political party, a PAC, or an election authority. It is a neutral public forum for civic conversation.</p>
          <p>Choseno may also display informational content such as election details, candidate information, and news summaries, some of which is created with the help of AI tools and may contain errors or omissions. This content is provided for general information only. Please verify important details, such as election dates, polling places, and candidate information, with official government sources.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">4. User-Generated Content</h2>
          <p>Choseno hosts user-generated content (UGC). Under Section 230 of the Communications Decency Act and equivalent applicable laws:</p>
          <ul className="list-disc list-inside space-y-2 mt-2">
            <li>Choseno is <strong className="text-text-main">not the author or publisher</strong> of user-generated content.</li>
            <li>Choseno is <strong className="text-text-main">not liable</strong> for user-submitted reviews, ratings, comments, posts, or discussions.</li>
            <li>Users are <strong className="text-text-main">solely responsible</strong> for the content they submit and its accuracy, legality, and appropriateness.</li>
            <li>Choseno does <strong className="text-text-main">not verify or endorse</strong> any user-submitted content.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">5. User Conduct</h2>
          <p>By using Choseno, you agree not to:</p>
          <ul className="list-disc list-inside space-y-2 mt-2">
            <li>Post false, defamatory, or knowingly misleading information about any person</li>
            <li>Harass, threaten, or intimidate any individual, candidate, or elected official</li>
            <li>Post content that is illegal, obscene, or violates any third party&apos;s rights</li>
            <li>Attempt to manipulate ratings through fake accounts or coordinated inauthentic behavior</li>
            <li>Use the platform for commercial advertising or political fundraising</li>
            <li>Impersonate any politician, candidate, or other person</li>
            <li>Scrape, crawl, or extract platform data in bulk without written permission</li>
            <li>Attempt to hack, disrupt, or gain unauthorized access to the platform or other users&apos; accounts</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">6. Anonymous Ghost ID System</h2>
          <p>Choseno uses a rotating &ldquo;Ghost ID&rdquo; system designed to protect user anonymity. Your public activity is not intentionally linked to your real identity, but we cannot guarantee absolute anonymity. Choseno may be required to disclose account information if compelled by a valid court order or law enforcement request. Anonymity does not grant permission to engage in illegal conduct.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">7. Public Official &amp; Candidate Information</h2>
          <p>Politician and candidate profile data on Choseno is sourced from publicly available government records and campaign filings. We do not guarantee its accuracy or completeness. If you are a public official and believe information about you is incorrect, contact us at <a href="mailto:contact@choseno.com" className="text-primary hover:underline">contact@choseno.com</a> and we will look into it.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">8. Content Moderation</h2>
          <p>Choseno reserves the right, but not the obligation, to remove content that violates these Terms. We are not responsible for failing to remove any particular content. Moderation decisions are made at our sole discretion.</p>
          <p>To report content that you believe violates these Terms, use the in-platform report button or contact us at <a href="mailto:contact@choseno.com" className="text-primary hover:underline">contact@choseno.com</a>.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">9. Disclaimer of Warranties</h2>
          <p>Choseno is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties of any kind, express or implied, including accuracy, reliability, availability, merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the platform will be uninterrupted, error-free, or free of harmful components, or that any data displayed on it is accurate.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">10. Security &amp; Data Disclaimer</h2>
          <p>We use commercially reasonable measures to protect the platform and your information, but no system is completely secure. We cannot guarantee that unauthorized access, hacking, data loss, or data disclosure will never occur. To the fullest extent permitted by law, Choseno is not liable for any loss or harm resulting from them. You use the platform at your own risk and are responsible for keeping your login credentials secure.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">11. Limitation of Liability</h2>
          <p>To the fullest extent permitted by law, Choseno and its founders, operators, employees, and affiliates are not liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss of data, profits, or goodwill, arising from your use of the platform or from content posted by users, including defamatory statements, inaccurate ratings, security incidents, or service interruptions.</p>
          <p>Our total liability for any claim relating to the platform is limited to the greater of $100 or the amount you paid us in the preceding 12 months. Some jurisdictions do not allow certain limitations, so some of the above may not apply to you.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">12. Indemnification</h2>
          <p>You agree to indemnify and hold harmless Choseno and its founders, operators, and affiliates from any claims, damages, or expenses (including reasonable legal fees) arising from content you post or your violation of these Terms.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">13. Suspension &amp; Termination</h2>
          <p>We may suspend or terminate your access at any time, with or without notice, including for violating these Terms. You may stop using Choseno and delete your account at any time as described in our <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">14. Intellectual Property</h2>
          <p>The Choseno name, logo, and platform design are owned by Choseno. User-generated content remains the property of its authors, subject to the non-exclusive license granted in our Privacy Policy. You may not reproduce, copy, or distribute Choseno&apos;s platform design or proprietary features without written permission.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">15. Governing Law</h2>
          <p>These Terms are governed by the laws of the applicable jurisdiction in which Choseno operates. Disputes shall first be addressed through good-faith negotiation before pursuing legal remedies.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">16. Changes to These Terms</h2>
          <p>We may revise these Terms from time to time. We will notify users of significant changes through the platform. Continued use of Choseno after a revision constitutes acceptance of the updated Terms.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">17. Contact</h2>
          <p>Questions about these Terms? Contact us at <a href="mailto:contact@choseno.com" className="text-primary hover:underline">contact@choseno.com</a>.</p>
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
