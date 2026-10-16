import { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/constants/site";
import Link from "next/link";

const BASE_URL = SITE_URL;
const LAST_UPDATED = "October 16, 2026";

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
          <p>Choseno (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;the platform&rdquo;) is an independent civic social media platform, available on the web and as a mobile app, that lets citizens anonymously rate, review, and discuss elected officials and political candidates. This policy explains what data we collect, why we collect it, and the steps we take to protect it.</p>
          <p>Choseno is an early-stage startup and is currently in <strong className="text-text-main">beta</strong>. We work hard to protect your information, but we cannot guarantee that every feature works as intended or that your data will never be exposed (see Section 8).</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">2. Information We Collect</h2>
          <div className="space-y-4">
            <div>
              <p className="font-semibold text-text-main">Account Information</p>
              <p>If you create an account (via email or Google Sign-In), we store your email address and name for authentication and account management. We do not sell your personal account information.</p>
            </div>
            <div>
              <p className="font-semibold text-text-main">Ghost IDs &amp; Anonymity</p>
              <p>Public activity on Choseno (posts, ratings, and comments) is tied to a rotating, anonymized &ldquo;Ghost ID&rdquo; rather than your real name. The system is designed so that other users, including politicians on the platform, cannot link a Ghost ID to your real identity. We strive to maintain this, but we cannot guarantee absolute anonymity. For example, information you choose to include in a post, a legal order, or a security incident could reveal who you are.</p>
            </div>
            <div>
              <p className="font-semibold text-text-main">Usage, Analytics &amp; Diagnostic Data</p>
              <p>We collect standard analytics data (page views, session durations, referral sources) through Google Analytics, and technical error information (such as error messages, the page you were on, and browser or device details) to find and fix problems. We use this to improve the platform and do not use it to identify you.</p>
            </div>
            <div>
              <p className="font-semibold text-text-main">Location (Boundary Matching Only)</p>
              <p>To show you elections and candidates relevant to your area, we may ask for your location or address. We use it to match you to your electoral boundaries.</p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">3. User-Generated Content</h2>
          <p>Content posted by users, including ratings, reviews, comments, and wall posts, is user-generated. Choseno does not verify, endorse, or take responsibility for it. Users are solely responsible for the accuracy and legality of what they post.</p>
          <p>By posting on Choseno, you grant Choseno a non-exclusive license to display your content on the platform. Content posted publicly may be visible to search engines and AI indexing systems.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">4. Public Politician &amp; Candidate Data</h2>
          <p>Politician and candidate profile information (name, office sought, party affiliation, campaign website) is sourced from publicly available government records and official election filings. We do not guarantee that it is complete or current. If you are a public official and believe information about you is incorrect, please contact us at <a href="mailto:contact@choseno.com" className="text-primary hover:underline">contact@choseno.com</a>.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">5. How We Use Your Data</h2>
          <ul className="list-disc list-inside space-y-2 mt-2">
            <li>To authenticate and maintain your account</li>
            <li>To match you to your electoral districts and relevant candidates</li>
            <li>To display anonymized community discussions and ratings</li>
            <li>To keep the platform secure, diagnose errors, and improve performance</li>
            <li>To send optional notification emails if you opt in</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">6. Data Sharing</h2>
          <p>We do <strong className="text-text-main">not</strong> sell your personal data, and we do <strong className="text-text-main">not</strong> share it with political parties, advertisers, or data brokers. We may share aggregated, anonymized statistics publicly.</p>
          <p>We rely on service providers to run the platform, including Supabase (database and authentication, with data stored in the United States), Google (Sign-In and Analytics), and our hosting provider. They process data on our behalf. We may also disclose information if required by law, a valid court order, or to protect the rights and safety of others.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">7. Cookies</h2>
          <p>Choseno uses essential cookies for session authentication and non-essential analytics cookies (Google Analytics) on the website. You can disable analytics cookies through your browser settings. Essential cookies are required for the platform to function.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">8. Security &amp; Beta Disclaimer</h2>
          <p>We use commercially reasonable measures to protect your information. However, no website, app, or database is completely secure, and Choseno is a beta product built by a small team. We cannot guarantee that unauthorized access, hacking, data loss, or data disclosure will never occur. To the fullest extent permitted by law, Choseno and its founders are not liable for losses resulting from such events. If we become aware of a breach affecting your personal information, we will notify you as required by applicable law.</p>
          <p>You are responsible for keeping your login credentials secure.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">9. Your Rights</h2>
          <p>You can delete your account and associated personal data at any time in the app (Profile → Delete account) or at <Link href="/delete-account" className="text-primary hover:underline">choseno.com/delete-account</Link>. You may also contact us at <a href="mailto:contact@choseno.com" className="text-primary hover:underline">contact@choseno.com</a>. Anonymized public content (ratings, posts) may remain on the platform, as it cannot be linked back to your identity after deletion.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">10. Children&apos;s Privacy</h2>
          <p>Choseno is not intended for anyone under the age of 13. We do not knowingly collect personal data from children. If you believe a child has created an account, please contact us.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">11. Changes to This Policy</h2>
          <p>We may update this policy from time to time. Significant changes will be communicated via the platform. Continued use of Choseno after an update constitutes acceptance of the revised policy.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">12. Contact</h2>
          <p>For privacy questions, data deletion requests, or correction requests, contact us at <a href="mailto:contact@choseno.com" className="text-primary hover:underline">contact@choseno.com</a>.</p>
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
