"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Globe, Heart, ShieldCheck, Users, MessageSquare, ExternalLink } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/LanguageContext";
import { SITE_URL, SITE_NAME } from "@/lib/constants/site";

const BASE_URL = SITE_URL;

export default function AboutPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();

  // Redirect to feed if user is signed in — About page is only for signed-out visitors
  useEffect(() => {
    if (user) {
      router.push("/feed");
    }
  }, [user, router]);

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
            {t("about.badge")}
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-text-main leading-tight">
            {t("about.heroTitleMain")}<br />
            <span className="text-primary">{t("about.heroTitleSub")}</span>
          </h1>
          <p className="text-lg text-text-muted leading-relaxed">
            {t("about.heroLead")}
          </p>
        </header>

        {/* Founder section */}
        <section aria-labelledby="founder-heading" className="space-y-6 border-t border-border pt-12">
          <h2 id="founder-heading" className="text-2xl font-bold text-text-main">
            {t("about.whoBuilt")}
          </h2>

          <div className="flex items-start gap-5">
            <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-extrabold text-primary">MV</span>
            </div>
            <div className="space-y-2">
              <p className="text-lg font-bold text-text-main">Murugappan Valliyappan</p>
              <p className="text-sm text-text-muted">{t("about.role")}</p>
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
            <p>{t("about.bio1")}</p>
            <p>{t("about.bio2")}</p>
            <p>{t("about.bio3")}</p>
          </div>
        </section>

        {/* Mission */}
        <section aria-labelledby="mission-heading" className="space-y-6 border-t border-border pt-12">
          <h2 id="mission-heading" className="text-2xl font-bold text-text-main">
            {t("about.missionTitle")}
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                icon: <MessageSquare size={20} className="text-primary" />,
                title: t("about.m1Title"),
                desc: t("about.m1Text"),
              },
              {
                icon: <Users size={20} className="text-primary" />,
                title: t("about.m2Title"),
                desc: t("about.m2Text"),
              },
              {
                icon: <ShieldCheck size={20} className="text-primary" />,
                title: t("about.m3Title"),
                desc: t("about.m3Text"),
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
            {t("about.editorialTitle")}
          </h2>
          <div className="space-y-5">
            {[
              {
                title: t("about.standard1Title"),
                desc: t("about.standard1Text"),
              },
              {
                title: t("about.standard2Title"),
                desc: t("about.standard2Text"),
              },
              {
                title: t("about.standard3Title"),
                desc: t("about.standard3Text"),
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
          <h2 id="legal-heading" className="text-2xl font-bold text-text-main">{t("footer.legal")}</h2>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/terms"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium"
            >
              <ShieldCheck size={14} />
              {t("footer.terms")}
            </Link>
            <Link
              href="/privacy"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium"
            >
              <Globe size={14} />
              {t("footer.privacy")}
            </Link>
          </div>
        </section>

        {/* Contact */}
        <section className="border-t border-border pt-10 text-center space-y-3">
          <p className="text-sm text-text-muted">
            {t("about.contactQuestions")}
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
