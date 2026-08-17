import { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/constants/site";

const BASE_URL = SITE_URL;
const LAST_UPDATED = "August 17, 2026";

export const metadata: Metadata = {
  title: "Corrections Policy | Choseno",
  description:
    "How Choseno handles, logs, and discloses factual corrections to published civic news articles.",
  alternates: { canonical: `${BASE_URL}/corrections-policy` },
  robots: { index: true, follow: true },
};

export default function CorrectionsPolicyPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Corrections Policy",
    url: `${BASE_URL}/corrections-policy`,
    description: "How Choseno handles, logs, and discloses factual corrections to published civic news articles.",
    publisher: { "@type": "NewsMediaOrganization", name: "Choseno", url: BASE_URL },
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <header className="space-y-3 border-b border-border pb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-text-main">Corrections Policy</h1>
        <p className="text-sm text-text-muted">
          Last updated: {LAST_UPDATED} &nbsp;|&nbsp;{" "}
          <Link href="/editorial-standards" className="text-primary hover:underline">Editorial Standards</Link>
        </p>
      </header>

      <div className="space-y-10 text-text-muted leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">1. Reporting an error</h2>
          <p>
            If you find a factual error in a Choseno news article — including if you are the subject of the story —
            email <a href="mailto:contact@choseno.com" className="text-primary hover:underline">contact@choseno.com</a>{" "}
            with the article&rsquo;s URL and a description of what&rsquo;s wrong. Where possible, include a source
            that supports the correct information; it speeds up verification.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">2. How we review a correction request</h2>
          <p>
            We re-check the disputed claim against the article&rsquo;s original cited sources and, where relevant,
            against the platform&rsquo;s own underlying civic data (candidate filings, office/seat records). If the
            claim doesn&rsquo;t hold up, we correct it. We aim to respond to correction requests within a few business
            days.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">3. How a correction is disclosed</h2>
          <p>
            Minor corrections (typos, formatting) are fixed silently. Substantive corrections — anything that changes
            a fact, a name, a figure, or the meaning of a claim — update the article&rsquo;s content and its
            &ldquo;last updated&rdquo; timestamp, which is visible on the article and carried in its structured data
            (<code>dateModified</code>) so search engines and AI systems reading the page see the corrected version,
            not a stale cached claim.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">4. Removal requests</h2>
          <p>
            We correct factual errors; we don&rsquo;t remove accurate coverage of a public official&rsquo;s public
            actions or filings on request. If you believe an entire article should not exist — for example, it
            concerns a private individual rather than a public official, or was published in error — say so in your
            email and we&rsquo;ll review it on those grounds specifically.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">5. Contact</h2>
          <p>
            <a href="mailto:contact@choseno.com" className="text-primary hover:underline">contact@choseno.com</a> —
            see also our <Link href="/editorial-standards" className="text-primary hover:underline">Editorial Standards</Link>{" "}
            for how stories are sourced and reviewed before publication.
          </p>
        </section>
      </div>
    </div>
  );
}
