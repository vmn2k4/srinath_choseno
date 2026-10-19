"use client";

import Link from "next/link";
import { Eye, Lock, MessageCircleQuestion, MapPin, Megaphone, ShieldCheck, ShieldOff, MessagesSquare, Users, ArrowRight, CheckCircle2 } from "lucide-react";
import { useRef } from "react";
import { Button, Card } from "@/components/primitives";
import {
  Reveal,
  HoverLift,
  HeroSection,
  StaggerGroup,
  StaggerItem,
  FloatingElement,
  SectionOrbs,
  ScrollRatingStars,
} from "@/components/features/home/HomeMotion";
import HomeLocateWidget from "@/components/features/home/HomeLocateWidget";
import HomeFeedPreview from "@/components/features/home/HomeFeedPreview";
import { HomeSignupButtons, HomeStickySignup } from "@/components/features/home/HomeSignup";
import HomeViewportScale from "@/components/features/home/HomeViewportScale";
import HomeStats from "@/components/features/home/HomeStats";
import HomeMemberReviews from "@/components/features/home/HomeMemberReviews";
import HomeTestimonial from "@/components/features/home/HomeTestimonial";
import HomeSupportedCountries from "@/components/features/home/HomeSupportedCountries";
import MissionRegisterCTA from "@/components/features/MissionRegisterCTA";
import HomeLatestNews, { type HomeLatestNewsArticle } from "@/components/features/home/HomeLatestNews";
import { useTranslation } from "@/contexts/LanguageContext";

const FAQS = [
  {
    q: "Is Choseno really anonymous?",
    a: "Yes. Your posts appear under a fake name, not your real one. You can get a new fake name anytime you want, and your old posts get disconnected from your profile.",
  },
  {
    q: "Can politicians or staff see who I really am?",
    a: "No. Nobody sees your real name. Your posts and profile are completely separate — even staff can't connect them. That's by design.",
  },
  {
    q: "What happens when I get a new anonymous name?",
    a: "Your old posts stay online but get a fresh start. When you switch to a new name, you're making a clean break from your past posts.",
  },
  {
    q: "How do you know where I live without asking for my address?",
    a: "We just need your location once. We match it to your voting area automatically — no forms, no typing an address.",
  },
  {
    q: "Is Choseno run by a political party?",
    a: "No. We show all candidates equally. A candidate's party doesn't matter to us — voters decide who they like.",
  },
  {
    q: "Can I run for office without party support?",
    a: "Yes. Any local resident can run. You just share a little about yourself, voters ask you questions, and you get your own campaign page.",
  },
  {
    q: "What if my area isn't on the map yet?",
    a: "You can search for your area by name or use your location. If it's not there yet, we're still adding new areas. Check back soon.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

interface HomePageProps {
  latestNews?: HomeLatestNewsArticle[];
}

export default function HomePage({ latestNews = [] }: HomePageProps) {
  const { t } = useTranslation();
  const ratingSectionRef = useRef<HTMLDivElement>(null);

  const trustChips = [
    { icon: ShieldOff, label: t("home.social.trustPrivate") },
    { icon: Users, label: t("home.social.trustLocal") },
    { icon: MessagesSquare, label: t("home.social.trustNoReply") },
  ];

  const steps = [
    { icon: MapPin, title: t("home.social.how.s1Title"), text: t("home.social.how.s1Text") },
    { icon: ShieldCheck, title: t("home.social.how.s2Title"), text: t("home.social.how.s2Text") },
    { icon: Megaphone, title: t("home.social.how.s3Title"), text: t("home.social.how.s3Text") },
  ];

  const publicItems = [t("home.social.privacy.public1"), t("home.social.privacy.public2"), t("home.social.privacy.public3")];
  const privateItems = [t("home.social.privacy.private1"), t("home.social.privacy.private2"), t("home.social.privacy.private3")];

  const faqsData = t("home.faqs", "") as unknown;
  const faqList: { q: string; a: string }[] = Array.isArray(faqsData) ? faqsData : [];

  return (
    <HomeViewportScale>
    <div className="w-full overflow-x-clip">
      {/* The page now carries its own persistent sign-up surfaces (hero buttons +
          sticky bar), so the popup's floating card is suppressed here. The timed
          modal stays as the second chance for visitors who scroll without acting. */}
      <MissionRegisterCTA variant="home" nextPath="/" hideSidebar />
      <HomeStickySignup />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}
      />

      {/* ============ HERO — one promise, one action, the product shown not described ============ */}
      <HeroSection>
        <div className="grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-14 items-center">
          <div className="text-center lg:text-left min-w-0">
            <Reveal>
              {/* The hook reads as a thought the visitor has had: an icon + quote card, so it's a
                  deliberate element of the hero rather than loose text above the headline. */}
              <div className="inline-flex items-start gap-3 max-w-xl text-left rounded-2xl border border-accent/40 bg-surface-elevated/80 elevation-1 px-4 py-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <MessageCircleQuestion size={18} aria-hidden="true" />
                </span>
                <p className="text-sm sm:text-base font-semibold text-text-main/90 leading-snug">{t("home.social.hook")}</p>
              </div>
              <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold leading-[1.02] mt-4 sm:mt-6 tracking-tight text-balance">
                {t("home.social.titleMain")}
                <br />
                <span className="text-primary">{t("home.social.titleSub")}</span>
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-text-main/90 font-medium max-w-xl mx-auto lg:mx-0 mt-4 sm:mt-6 leading-relaxed">
                {t("home.social.subtitle")}
              </p>
              <HomeSignupButtons placement="hero" cta="Hero" className="mt-6 sm:mt-8 w-full max-w-sm mx-auto lg:mx-0" />
              <p className="mt-3 text-xs sm:text-sm font-medium text-text-muted max-w-sm mx-auto lg:mx-0">
                {t("home.social.microcopy")}
              </p>
              <ul className="mt-6 flex flex-wrap items-center justify-center lg:justify-start gap-2 sm:gap-3">
                {trustChips.map((chip) => (
                  <li
                    key={chip.label}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border-light/50 bg-surface-elevated/70 text-xs sm:text-sm font-semibold text-text-secondary"
                  >
                    <chip.icon size={13} className="text-primary shrink-0" aria-hidden="true" />
                    {chip.label}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
          <Reveal delay={120} className="min-w-0">
            <FloatingElement distance={7} duration={6}>
              <HomeFeedPreview />
            </FloatingElement>
          </Reveal>
        </div>
      </HeroSection>

      {/* ============ STATS — social proof straight under the hero ============ */}
      <HomeStats />

      {/* ============ LOOKUP — the search-intent entry (who's running, rate my rep), finder-first ============ */}
      <section className="relative py-14 sm:py-24 px-4 sm:px-6" aria-labelledby="home-lookup-title">
        <div className="max-w-6xl min-[1700px]:max-w-[90rem] mx-auto grid lg:grid-cols-[1fr_1.05fr] gap-8 lg:gap-14 items-center">
          <Reveal className="text-center lg:text-left min-w-0 lg:order-1 order-2">
            <p className="text-sm font-bold uppercase tracking-wide text-primary">{t("home.social.lookup.badge")}</p>
            <h2
              id="home-lookup-title"
              className="mt-3 font-display text-3xl sm:text-4xl md:text-5xl font-extrabold leading-[1.05] tracking-tight text-balance"
            >
              {t("home.social.lookup.title")}
            </h2>
            <p className="mt-4 sm:mt-5 text-base sm:text-lg text-text-main/85 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              {t("home.social.lookup.subtitle")}
            </p>
            <ul className="mt-5 space-y-2.5 max-w-xl mx-auto lg:mx-0 text-left">
              {[t("home.social.lookup.p1"), t("home.social.lookup.p2")].map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm sm:text-base text-text-secondary">
                  <CheckCircle2 size={16} className="text-primary mt-1 shrink-0" aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3">
              <Button as={Link} href="/elections" variant="outline" size="lg" className="justify-center">
                {t("home.social.lookup.browse")}
                <ArrowRight size={16} aria-hidden="true" />
              </Button>
            </div>
          </Reveal>
          {/* The finder is the action here, so it leads on mobile and is full-width, not a floating side card. */}
          <Reveal delay={120} className="min-w-0 flex justify-center lg:justify-end lg:order-2 order-1">
            <HomeLocateWidget />
          </Reveal>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section className="relative py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-6xl min-[1700px]:max-w-[90rem] mx-auto">
          <Reveal className="text-center mb-10 sm:mb-14">
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-balance">
              {t("home.social.how.title")}
            </h2>
            <p className="mt-3 sm:mt-4 text-base sm:text-lg text-text-muted max-w-xl mx-auto">
              {t("home.social.how.subtitle")}
            </p>
          </Reveal>

          <StaggerGroup className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-7">
            {steps.map((step, i) => (
              <StaggerItem key={step.title}>
                <HoverLift shine className="glass-card elevation-2 p-5 sm:p-6 lg:p-8 h-full group hover:border-primary/40 transition-all duration-300">
                  <span className="font-display text-5xl sm:text-6xl font-black text-primary/20 group-hover:text-primary/35 transition-colors duration-500 select-none leading-none">
                    0{i + 1}
                  </span>
                  <h3 className="mt-4 text-lg sm:text-xl lg:text-2xl font-bold tracking-tight flex items-center gap-2">
                    <step.icon size={18} className="text-primary shrink-0" aria-hidden="true" />
                    <span>{step.title}</span>
                  </h3>
                  <p className="mt-2 sm:mt-3 text-text-muted text-sm sm:text-base leading-relaxed">{step.text}</p>
                </HoverLift>
              </StaggerItem>
            ))}
          </StaggerGroup>

          <Reveal delay={120} className="mt-10 sm:mt-12 flex justify-center">
            <HomeSignupButtons placement="how_it_works" cta={t("home.social.how.cta")} className="w-full max-w-sm" />
          </Reveal>
        </div>
      </section>

      {/* ============ ANONYMITY — what is and isn't visible ============ */}
      <section className="relative py-16 sm:py-24 px-4 sm:px-6 overflow-hidden">
        <SectionOrbs
          orbs={[
            { variant: "orb-a", range: [-120, 100], driftX: [0, 30, -25, 0], duration: 19 },
            { variant: "orb-b", range: [140, -100], driftX: [0, -25, 30, 0], duration: 23 },
          ]}
        />
        <div className="relative max-w-5xl mx-auto">
          <Reveal className="text-center mb-10 sm:mb-14">
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-balance">
              {t("home.social.privacy.title")}
            </h2>
            <p className="mt-3 sm:mt-4 text-base sm:text-lg text-text-muted max-w-2xl mx-auto">
              {t("home.social.privacy.subtitle")}
            </p>
          </Reveal>

          <StaggerGroup className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {[
              { icon: Eye, title: t("home.social.privacy.publicTitle"), items: publicItems },
              { icon: Lock, title: t("home.social.privacy.privateTitle"), items: privateItems },
            ].map((col) => (
              <StaggerItem key={col.title}>
                <Card variant="hero" padding="md" className="h-full">
                  <h3 className="flex items-center gap-2.5 text-lg sm:text-xl font-bold text-text-main">
                    <col.icon size={20} className="text-primary shrink-0" aria-hidden="true" />
                    {col.title}
                  </h3>
                  <ul className="mt-4 space-y-3">
                    {col.items.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm sm:text-base text-text-secondary leading-relaxed">
                        <CheckCircle2 size={16} className="text-primary mt-1 shrink-0" aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </Card>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* ============ RATE POLITICIANS — keeps the "Google Reviews for politicians" search intent ============ */}
      <section className="relative py-16 sm:py-24 px-4 sm:px-6 overflow-hidden" ref={ratingSectionRef}>
        <SectionOrbs
          orbs={[
            { variant: "orb-c", range: [-100, 140], driftX: [0, 30, -25, 0], duration: 20 },
            { variant: "orb-a", range: [120, -80], driftX: [0, -25, 20, 0], duration: 22 },
          ]}
        />
        <div className="relative max-w-4xl mx-auto">
          <Reveal className="text-center mb-10 sm:mb-14">
            <p className="text-sm font-bold uppercase tracking-wide text-primary">{t("home.social.rate.eyebrow")}</p>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-balance">
              {t("home.social.rate.title")}
            </h2>
            <p className="mt-3 sm:mt-4 text-base sm:text-lg text-text-muted max-w-2xl mx-auto">
              {t("home.social.rate.subtitle")}
            </p>
          </Reveal>
          <div className="relative glass-card elevation-2 p-6 sm:p-12 flex items-center justify-center min-h-[420px]">
            <ScrollRatingStars
              sectionRef={ratingSectionRef}
              politicianName="Jenny Kwan"
              title="Member of Parliament"
              party="Vancouver East"
              description="Focused on advocating for working families and strengthening community support programs in Vancouver East. Known for active engagement on housing affordability and economic justice."
            />
          </div>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/wall/jenny-kwan-mp"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-primary/50 bg-surface-elevated/70 text-text-main font-bold text-sm sm:text-base hover:bg-primary/10 hover:border-primary transition-all duration-300"
            >
              {t("home.rateCtaSecondary", "See real ratings")}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* ============ SOCIAL PROOF + COVERAGE ============ */}
      <HomeTestimonial />
      <HomeMemberReviews />
      <HomeLatestNews articles={latestNews} />
      <HomeSupportedCountries />

      {/* ============ FAQ ============ */}
      <section className="relative py-16 sm:py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <Reveal className="text-center mb-10 sm:mb-14">
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight">
              {t("home.faqsTitle")}
            </h2>
          </Reveal>

          <div className="space-y-2 sm:space-y-3">
            {faqList.map((faq, i) => (
              <Reveal key={faq.q} delay={i * 60}>
                <details className="glass-card p-4 sm:p-6 group">
                  <summary className="flex items-center justify-between gap-3 sm:gap-4 cursor-pointer list-none font-bold text-text-main text-sm sm:text-base lg:text-lg">
                    <span>{faq.q}</span>
                    <ShieldCheck
                      size={16}
                      className="text-primary shrink-0 transition-transform duration-300 group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </summary>
                  <p className="mt-3 text-xs sm:text-sm lg:text-base text-text-muted leading-relaxed">{faq.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CLOSING CTA ============ */}
      <section id="home-closing-cta" className="relative py-16 sm:py-28 px-4 sm:px-6 text-center overflow-hidden">
        <SectionOrbs
          orbs={[
            { variant: "orb-d", range: [100, -80], driftX: [0, -30, 25, 0], duration: 21 },
            { variant: "orb-e", range: [-90, 110], driftX: [0, 25, -30, 0], duration: 25 },
          ]}
        />
        <div className="relative max-w-4xl mx-auto">
          <Reveal>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-extrabold tracking-tight text-balance">
              {t("home.social.closing.titleMain")}{" "}
              <span className="text-primary">{t("home.social.closing.titleSub")}</span>
            </h2>
            <p className="mt-4 sm:mt-6 text-base sm:text-lg lg:text-xl text-text-muted max-w-2xl mx-auto">
              {t("home.social.closing.subtitle")}
            </p>
            <HomeSignupButtons placement="closing" cta="Closing" className="mt-8 sm:mt-10 w-full max-w-sm mx-auto" />
            <p className="mt-6 text-sm text-text-muted">
              {t("home.social.closing.candidate")}{" "}
              <Link
                href="/auth?role=politician"
                className="font-semibold text-text-main underline decoration-primary/40 underline-offset-4 hover:decoration-primary transition-colors"
              >
                {t("home.social.closing.candidateLink")}
              </Link>
            </p>
          </Reveal>
        </div>
      </section>
    </div>
    </HomeViewportScale>
  );
}
