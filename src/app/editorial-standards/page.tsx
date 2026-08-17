import { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/constants/site";

const BASE_URL = SITE_URL;
const LAST_UPDATED = "August 17, 2026";

export const metadata: Metadata = {
  title: "Editorial Standards | Choseno",
  description:
    "How Choseno's Civic News Desk gathers, verifies, and publishes news — sourcing, AI-assisted drafting, human review, and what we do and don't cover.",
  alternates: { canonical: `${BASE_URL}/editorial-standards` },
  robots: { index: true, follow: true },
};

export default function EditorialStandardsPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Editorial Standards",
    url: `${BASE_URL}/editorial-standards`,
    description:
      "How Choseno's Civic News Desk gathers, verifies, and publishes news.",
    publisher: { "@type": "NewsMediaOrganization", name: "Choseno", url: BASE_URL },
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <header className="space-y-3 border-b border-border pb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-text-main">Editorial Standards</h1>
        <p className="text-sm text-text-muted">
          Last updated: {LAST_UPDATED} &nbsp;|&nbsp; Published by the Choseno Civic News Desk &nbsp;|&nbsp;{" "}
          <Link href="/corrections-policy" className="text-primary hover:underline">Corrections Policy</Link>
        </p>
      </header>

      <div className="space-y-10 text-text-muted leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">1. Who publishes this</h2>
          <p>
            Choseno&rsquo;s civic news coverage is published by the Choseno Civic News Desk, operated by Choseno, an
            independent hyperlocal civic platform (see <Link href="/about" className="text-primary hover:underline">About</Link>).
            We are not affiliated with any political party, candidate, or government office, and we do not accept
            payment from politicians or campaigns in exchange for coverage.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">2. How stories are sourced</h2>
          <p>
            Every published article is built from publicly available source material — government filings, official
            statements, municipal records, election filings, and reporting from other outlets — cited under a
            &ldquo;Sources&rdquo; section at the bottom of the article whenever it exists. We do not publish
            unsourced claims as fact. Stories tagged to a specific politician or seat are drawn from the same public
            record used elsewhere on Choseno (candidate filings, boundary/office data) so a claim about who holds or
            is running for a seat is checkable against the platform&rsquo;s own underlying data, not just the prose.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">3. AI-assisted drafting, human-gated publishing</h2>
          <p>
            Choseno is a small, independent team. Story drafts are assembled with AI assistance from the cited public
            sources to keep pace with the volume of civic activity across many jurisdictions — the same reason
            large outlets increasingly use AI-assisted tooling in their newsrooms. Every article is reviewed against
            its cited sources before it moves from draft to published status; nothing goes live automatically off an
            unreviewed model output. We&rsquo;d rather disclose this plainly than have a reader assume a byline means
            something it doesn&rsquo;t.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">4. Neutrality &amp; non-partisanship</h2>
          <p>
            Coverage of candidates and elected officials is written to describe verifiable actions, statements, and
            filings — not to endorse or oppose anyone. Choseno&rsquo;s rating and review features are entirely
            separate, user-generated opinion content (clearly distinguished on every politician wall) and are never
            presented as Choseno&rsquo;s own editorial position.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">5. What we don&rsquo;t do</h2>
          <p>
            We don&rsquo;t run anonymous sourcing for serious factual claims, we don&rsquo;t accept payment for
            coverage, and we don&rsquo;t alter a published article&rsquo;s substance without noting it (see our{" "}
            <Link href="/corrections-policy" className="text-primary hover:underline">Corrections Policy</Link>).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-text-main">6. Questions or concerns</h2>
          <p>
            If you believe a story is inaccurate, unfair, or missing important context — including if you are the
            subject of an article — contact us at{" "}
            <a href="mailto:contact@choseno.com" className="text-primary hover:underline">contact@choseno.com</a>.
            See the <Link href="/corrections-policy" className="text-primary hover:underline">Corrections Policy</Link>{" "}
            for how we handle and log factual corrections.
          </p>
        </section>
      </div>
    </div>
  );
}
