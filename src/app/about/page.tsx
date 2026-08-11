import { Metadata } from "next";
import Link from "next/link";
import { Globe, Heart, ShieldCheck, Users, MessageSquare, ExternalLink } from "lucide-react";
import { SITE_URL, SITE_NAME } from "@/lib/constants/site";

const BASE_URL = SITE_URL;

export const metadata: Metadata = {
  title: "About Choseno — Built by a Citizen, for Citizens | Murugappan Valliyappan",
  description:
    "Choseno was created by Murugappan Valliyappan, an independent developer and citizen frustrated by one-way politics. Learn who built Choseno & our mission.",
  alternates: { canonical: `${BASE_URL}/about` },
  openGraph: {
    title: "About Choseno — Built by a Citizen, for Citizens",
    description:
      "Choseno was created by Murugappan Valliyappan, an everyday citizen frustrated by one-way politics. Learn our mission, editorial standards, and how we work.",
    url: `${BASE_URL}/about`,
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "About Choseno — Built by a Citizen, for Citizens",
    description:
      "An independent civic initiative by Murugappan Valliyappan. A platform for citizens to discuss politics every day, not just on election day.",
  },
};

export default function AboutPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "About Choseno",
    url: `${BASE_URL}/about`,
    description:
      "Choseno is an independent civic platform created by Murugappan Valliyappan to give every citizen a voice in political conversations — not just on election day.",
    author: {
      "@type": "Person",
      name: "Murugappan Valliyappan",
      url: "https://www.linkedin.com/in/muruvalliyappan/",
      sameAs: ["https://www.linkedin.com/in/muruvalliyappan/"],
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: BASE_URL,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <div className="max-w-3xl mx-auto px-4 py-12 space-y-16">

        {/* Hero */}
        <header className="space-y-6">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary bg-primary/10 px-3 py-1.5 rounded-full">
            <Heart size={12} />
            An independent civic initiative
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-text-main leading-tight">
            Built by a citizen,<br />
            <span className="text-primary">for every citizen.</span>
          </h1>
          <p className="text-lg text-text-muted leading-relaxed">
            Choseno started as a personal dream — not a startup pitch. It was born out of a simple frustration that millions of people share: <em>we vote once, and then politicians do whatever they want.</em>
          </p>
        </header>

        {/* Founder section */}
        <section aria-labelledby="founder-heading" className="space-y-6 border-t border-border pt-12">
          <h2 id="founder-heading" className="text-2xl font-bold text-text-main">
            Who built this
          </h2>

          <div className="flex items-start gap-5">
            <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-extrabold text-primary">MV</span>
            </div>
            <div className="space-y-2">
              <p className="text-lg font-bold text-text-main">Murugappan Valliyappan</p>
              <p className="text-sm text-text-muted">Independent Software Developer &amp; Citizen</p>
              <a
                href="https://www.linkedin.com/in/muruvalliyappan/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium"
              >
                <ExternalLink size={14} />
                linkedin.com/in/muruvalliyappan
              </a>
            </div>
          </div>

          <div className="space-y-4 text-text-muted leading-relaxed">
            <p>
              I am a common person — not a politician, not a lobbyist, not a media company. I am someone who watches the news, votes in every election, and still feels like my voice disappears the moment I leave the polling booth.
            </p>
            <p>
              Choseno is my personal contribution to the world. I built it because I genuinely believe people deserve to be part of the political conversation every single day of a politician's term — not just every two or four years on election day.
            </p>
            <p>
              This platform is not funded by any political party, PAC, or corporate interest. It is an independent, self-started initiative. No agenda. No endorsements. Just a tool to help citizens find each other, share their real experiences with the people who represent them, and hold those representatives accountable through the only currency that matters in democracy: <strong className="text-text-main">public opinion</strong>.
            </p>
            <p>
              If this platform genuinely helps one person feel heard, it was worth every hour I put into building it.
            </p>
          </div>
        </section>

        {/* Mission */}
        <section aria-labelledby="mission-heading" className="space-y-6 border-t border-border pt-12">
          <h2 id="mission-heading" className="text-2xl font-bold text-text-main">
            Our mission
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                icon: <MessageSquare size={20} className="text-primary" />,
                title: "Continuous Conversation",
                desc: "Politics isn't a one-day event. Choseno gives citizens a permanent forum to ask questions, share feedback, and hold representatives accountable throughout their entire term.",
              },
              {
                icon: <Users size={20} className="text-primary" />,
                title: "Voice of the Silent Majority",
                desc: "Most people have opinions but nowhere to share them safely. Choseno's anonymous Ghost ID system lets people speak honestly without fear of retribution.",
              },
              {
                icon: <ShieldCheck size={20} className="text-primary" />,
                title: "Zero Party Influence",
                desc: "Choseno has no political affiliation and accepts no political donations. Every candidate is represented equally. Voters decide who gets a good rating — not us.",
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="space-y-3 p-5 rounded-xl bg-surface border border-border">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  {icon}
                </div>
                <h3 className="font-bold text-text-main">{title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Editorial Standards — How We Work */}
        <section aria-labelledby="editorial-heading" className="space-y-6 border-t border-border pt-12">
          <h2 id="editorial-heading" className="text-2xl font-bold text-text-main">
            How We Work — Editorial Standards
          </h2>
          <p className="text-text-muted leading-relaxed">
            Choseno operates as a social platform and civic information directory. Here is exactly how we source and present information:
          </p>
          <div className="space-y-5">
            {[
              {
                title: "Candidate & Elected Official Profiles",
                desc: "Politician and candidate profiles are sourced from publicly available government records, official campaign filings (FEC, state election authorities), and official government websites. We do not editorialize candidate profiles — we present factual public data only.",
              },
              {
                title: "Voter Reviews & Community Posts",
                desc: "All reviews, ratings, and discussion posts are submitted by users of the Choseno platform. These represent individual user opinions and do not reflect the views of Choseno, its founders, or its operators. We do not endorse any opinion expressed by users.",
              },
              {
                title: "News Articles",
                desc: "Civic news published on Choseno is curated from reliable, publicly available sources and clearly attributed. When Choseno publishes editorial content, it will be clearly labeled with an author byline and sourced with verifiable references.",
              },
              {
                title: "Neutrality & No Endorsements",
                desc: "Choseno does not endorse, fund, or oppose any political candidate, party, or policy position. All candidates are presented with equal prominence. Our platform's role is to facilitate citizen conversation — not to influence its outcome.",
              },
              {
                title: "Error Corrections",
                desc: "If you believe any factual information on Choseno is incorrect, please contact us. We will investigate and correct any verifiable factual errors promptly.",
              },
            ].map(({ title, desc }) => (
              <div key={title} className="flex gap-4">
                <div className="w-1 bg-primary/40 rounded-full flex-shrink-0 mt-1" />
                <div className="space-y-1">
                  <p className="font-semibold text-text-main">{title}</p>
                  <p className="text-sm text-text-muted leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Legal Links */}
        <section aria-labelledby="legal-heading" className="space-y-4 border-t border-border pt-12">
          <h2 id="legal-heading" className="text-2xl font-bold text-text-main">Legal</h2>
          <p className="text-text-muted text-sm leading-relaxed">
            Choseno is a user-generated content platform. By using Choseno, you agree to our Terms of Service and acknowledge our Privacy Policy.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/terms"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium"
            >
              <ShieldCheck size={14} />
              Terms of Service
            </Link>
            <Link
              href="/privacy"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium"
            >
              <Globe size={14} />
              Privacy Policy
            </Link>
          </div>
        </section>

        {/* Contact */}
        <section className="border-t border-border pt-10 text-center space-y-3">
          <p className="text-sm text-text-muted">
            Questions, concerns, or corrections?
          </p>
          <a
            href="mailto:contact@choseno.com"
            className="text-sm text-primary hover:underline font-medium"
          >
            contact@choseno.com
          </a>
        </section>
      </div>
    </>
  );
}
