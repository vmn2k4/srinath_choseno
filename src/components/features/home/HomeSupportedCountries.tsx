"use client";

import Link from "next/link";
import { Globe2, ArrowRight, Sparkles, MapPin, CheckCircle2, Clock } from "lucide-react";
import { Reveal, HoverLift, StaggerGroup, StaggerItem, SectionOrbs } from "@/components/features/home/HomeMotion";
import { useTranslation } from "@/contexts/LanguageContext";

export default function HomeSupportedCountries() {
  const { t } = useTranslation();

  const countries = [
    {
      flag: "🇺🇸",
      name: t("home.countries.usName", "United States"),
      code: "US",
      status: t("home.countries.liveStatus", "Live Coverage"),
      isLive: true,
      description: t(
        "home.countries.usDesc",
        "Full coverage across all 50 states, 435 Congressional districts, and U.S. Senate races."
      ),
      highlights: [
        t("home.countries.usH1", "50 States & Territories"),
        t("home.countries.usH2", "435 U.S. House Districts"),
        t("home.countries.usH3", "Senate & Local Elections"),
      ],
      href: "/find-my-district",
      cta: t("home.countries.exploreDistrict", "Find your district"),
    },
    {
      flag: "🇨🇦",
      name: t("home.countries.caName", "Canada"),
      code: "CA",
      status: t("home.countries.liveStatus", "Live Coverage"),
      isLive: true,
      description: t(
        "home.countries.caDesc",
        "Hyperlocal civic coverage across all 10 provinces & 3 territories, federal ridings, and municipalities."
      ),
      highlights: [
        t("home.countries.caH1", "338+ Federal Ridings"),
        t("home.countries.caH2", "Provincial Legislative Seats"),
        t("home.countries.caH3", "School Trustees & Councils"),
      ],
      href: "/find-my-district",
      cta: t("home.countries.exploreDistrict", "Find your district"),
    },
    {
      flag: "🇮🇳",
      name: t("home.countries.inName", "India"),
      code: "IN",
      status: t("home.countries.liveStatus", "Live Coverage"),
      isLive: true,
      description: t(
        "home.countries.inDesc",
        "Comprehensive democracy platform spanning parliamentary constituencies and state legislative assemblies."
      ),
      highlights: [
        t("home.countries.inH1", "543 Lok Sabha Constituencies"),
        t("home.countries.inH2", "State Vidhan Sabhas"),
        t("home.countries.inH3", "Constituent Reviews & Ratings"),
      ],
      href: "/elections",
      cta: t("home.countries.viewCandidates", "View candidates"),
    },
    {
      flag: "🌍",
      name: t("home.countries.moreName", "More Countries Soon"),
      code: "GLOBAL",
      status: t("home.countries.comingSoonStatus", "Expanding Fast"),
      isLive: false,
      description: t(
        "home.countries.moreDesc",
        "Active rollout underway for the United Kingdom, Australia, the European Union, and beyond."
      ),
      highlights: [
        t("home.countries.moreH1", "United Kingdom (Westminster)"),
        t("home.countries.moreH2", "Australia (Commonwealth)"),
        t("home.countries.moreH3", "European Union & More"),
      ],
      href: "/find-my-district",
      cta: t("home.countries.requestArea", "Request your region"),
    },
  ];

  return (
    <section className="relative py-16 sm:py-24 px-4 sm:px-6 overflow-hidden" aria-label="Supported Countries">
      <SectionOrbs
        orbs={[
          { variant: "orb-c", range: [-90, 110], driftX: [0, 25, -30, 0], duration: 21 },
          { variant: "orb-d", range: [100, -80], driftX: [0, -25, 20, 0], duration: 25 },
        ]}
      />

      <div className="relative max-w-6xl mx-auto">
        {/* Section Header */}
        <Reveal className="text-center mb-12 sm:mb-16">
          <div className="flex justify-center mb-3 sm:mb-4">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-surface-elevated text-xs sm:text-sm font-bold text-primary elevation-1">
              <Globe2 className="w-4 h-4 text-primary" aria-hidden="true" />
              <span>{t("home.countries.badge", "Now Live in 3 Countries — More Coming Soon")}</span>
            </span>
          </div>

          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-text-main">
            {t("home.countries.title", "Democratic Accountability Across Borders")}
          </h2>

          <p className="mt-3 sm:mt-4 text-base sm:text-lg md:text-xl text-text-muted max-w-2xl mx-auto leading-relaxed">
            {t(
              "home.countries.subtitle",
              "We currently support the United States, Canada, and India — with active expansion across new democracies worldwide."
            )}
          </p>
        </Reveal>

        {/* Countries Grid */}
        <StaggerGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
          {countries.map((item) => (
            <StaggerItem key={item.code}>
              <HoverLift
                lift={6}
                shine
                className="glass-card elevation-2 p-5 sm:p-6 h-full flex flex-col justify-between group hover:border-primary/40 transition-all duration-300"
              >
                <div>
                  {/* Top Bar: Flag & Status Badge */}
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className="text-3xl sm:text-4xl select-none" role="img" aria-label={item.name}>
                      {item.flag}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                        item.isLive
                          ? "bg-primary/10 border-primary/30 text-primary"
                          : "bg-surface-elevated border-border-light text-text-muted"
                      }`}
                    >
                      {item.isLive ? (
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                        </span>
                      ) : (
                        <Clock size={11} className="shrink-0 text-text-muted" />
                      )}
                      <span>{item.status}</span>
                    </span>
                  </div>

                  {/* Country Name */}
                  <h3 className="text-lg sm:text-xl font-bold text-text-main group-hover:text-primary transition-colors">
                    {item.name}
                  </h3>

                  {/* Description */}
                  <p className="mt-2 text-xs sm:text-sm text-text-muted leading-relaxed">
                    {item.description}
                  </p>

                  {/* Key Highlights */}
                  <ul className="mt-4 space-y-1.5 sm:space-y-2 border-t border-border-light/40 pt-3">
                    {item.highlights.map((h) => (
                      <li key={h} className="flex items-center gap-2 text-xs text-text-muted">
                        <CheckCircle2 size={12} className="text-primary shrink-0" aria-hidden="true" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Card CTA Link */}
                <div className="mt-6 pt-3">
                  <Link
                    href={item.href}
                    className="inline-flex items-center justify-between w-full px-3.5 py-2 rounded-xl bg-surface-elevated/80 hover:bg-primary hover:text-text-on-primary text-text-main text-xs sm:text-sm font-semibold border border-border-light transition-all duration-200 group/link"
                  >
                    <span>{item.cta}</span>
                    <ArrowRight size={14} className="transition-transform group-hover/link:translate-x-1" />
                  </Link>
                </div>
              </HoverLift>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}
