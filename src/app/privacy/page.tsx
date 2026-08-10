import { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/constants/site";
import Link from "next/link";

const BASE_URL = SITE_URL;
const LAST_UPDATED = "August 10, 2026";

export const metadata: Metadata = {
  title: "Privacy Policy | Choseno",
  description:
    "Choseno's privacy policy explains what data we collect, how we use it, and how your anonymity is protected on our civic social platform.",
  alternates: { canonical: `${BASE_URL}/privacy` },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-10">
      <header className="space-y-3 border-b border-border pb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-text-main">Privacy Policy</h1>
        <p className="text-sm text-text-muted">
          Effective date: {LAST_UPDATED} &nbsp;|&nbsp; Operated by: Choseno (
          <Link href="/about" className="text-primary hover:underline">About Us</Link>)
        </p>
      </header>

      <div className="space-y-10 text-text-muted leading-relaxed">

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">1. Overview</h2>
          <p>
            Choseno (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;the platform&rdquo;) is an independent civic social media platform that lets citizens anonymously rate, review, and discuss elected officials and political candidates. We take your privacy seriously. This policy explains what data we collect, why we collect it, and how it is protected.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">2. Information We Collect</h2>
          <div className="space-y-4">
            <div>
              <p className="font-semibold text-text-main">Account Information</p>
              <p>If you create an account (via email or Google Sign-In), we store your email address and name solely for authentication purposes. We do not sell, trade, or share your personal account information with any third parties.</p>
            </div>
            <div>
              <p className="font-semibold text-text-main">Ghost IDs &amp; Anonymity</p>
              <p>
                All public activity on Choseno — posts, ratings, and comments — is tied to a rotating, anonymized &ldquo;Ghost ID,&rdquo; not your real name or account identity. Your Ghost ID rotates periodically. No other user, including politicians on the platform, can link your Ghost ID to your real identity.
              </p>
            </div>
            <div>
              <p className="font-semibold text-text-main">Usage &amp; Analytics Data</p>
              <p>
                We collect standard web analytics data (page views, session durations, referral sources) through Google Analytics to improve platform performance. This data is aggregated and anonymized. It is not linked to your personal identity.
              </p>
            </div>
            <div>
              <p className="font-semibold text-text-main">Location (Boundary Matching Only)</p>
              <p>
                To show you elections and candidates relevant to your area, we may ask for your location or address. This is used only to match you to your electoral boundaries. We do not store your precise location permanently.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">3. User-Generated Content</h2>
          <p>
            Choseno is a social media platform. Content posted by users — including ratings, reviews, comments, and wall posts — is user-generated. Choseno does not verify, endorse, or take responsibility for user-generated content. Users are solely responsible for the accuracy and legality of content they post.
          </p>
          <p>
            By posting on Choseno, you grant Choseno a non-exclusive license to display your content on the platform. Content posted publicly may be visible to search engines and AI indexing systems.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">4. Public Politician & Candidate Data</h2>
          <p>
            Politician and candidate profile information (name, office sought, party affiliation, campaign website) is sourced from publicly available government records and official election filings. This is public information and is displayed under fair use of public civic data. If you are a public official and believe information about you is factually incorrect, please contact us at <a href="mailto:contact@choseno.com" className="text-primary hover:underline">contact@choseno.com</a>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">5. How We Use Your Data</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>To authenticate and maintain your account</li>
            <li>To match you to your electoral districts and relevant candidates</li>
            <li>To display anonymized community discussions and ratings</li>
            <li>To improve platform performance through aggregated analytics</li>
            <li>To send optional notification emails if you opt in (no marketing spam)</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">6. Data Sharing</h2>
          <p>We do <strong className="text-text-main">not</strong> sell your personal data. We do <strong className="text-text-main">not</strong> share your personal data with political parties, advertisers, or data brokers. We may share aggregated, anonymized platform statistics publicly to demonstrate platform health and engagement.</p>
          <p>We use Supabase for our backend database and authentication. Supabase is a SOC 2 Type II certified platform with data stored in the United States.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">7. Cookies</h2>
          <p>Choseno uses essential cookies for session authentication and non-essential analytics cookies (Google Analytics). You can disable analytics cookies through your browser settings. Essential session cookies are required for the platform to function.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">8. Your Rights</h2>
          <p>You may request to delete your account and associated personal data at any time by contacting us at <a href="mailto:contact@choseno.com" className="text-primary hover:underline">contact@choseno.com</a>. Note that anonymized public content (ratings, posts) may remain on the platform as they cannot be linked back to your identity after deletion.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">9. Children&apos;s Privacy</h2>
          <p>Choseno is not intended for use by anyone under the age of 13. We do not knowingly collect personal data from children. If you believe a child has created an account, please contact us immediately.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">10. Changes to This Policy</h2>
          <p>We may update this privacy policy from time to time. Significant changes will be communicated via the platform. Continued use of Choseno after a policy update constitutes acceptance of the revised policy.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">11. Contact</h2>
          <p>
            For privacy-related questions, data deletion requests, or factual correction requests, contact us at:{" "}
            <a href="mailto:contact@choseno.com" className="text-primary hover:underline">contact@choseno.com</a>
          </p>
        </section>
      </div>

      <div className="pt-6 border-t border-border flex flex-wrap gap-4 text-sm text-text-muted">
        <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>
        <Link href="/about" className="text-primary hover:underline">About Choseno</Link>
        <Link href="/" className="text-primary hover:underline">Home</Link>
      </div>
    </div>
  );
}
