"use client";

import Link from "next/link";
import {
  MapPin,
  Megaphone,
  Users,
  ShieldCheck,
  Flame,
  Video,
  ThumbsUp,
  Globe2,
  Landmark,
  MessageSquare,
  Layers,
  Scale,
  CheckCircle2,
  Search,
  Vote,
  ArrowRight,
  Star,
} from "lucide-react";
import { ContainerScroll } from "@/components/primitives";
import {
  Reveal,
  HoverLift,
  HeroSection,
  CyclingBoundaryPill,
  RoleSplitCta,
  StaggerGroup,
  StaggerItem,
  TiltCard,
  MagneticCta,
  FloatingElement,
  SectionOrbs,
  ScrollRatingStars,
} from "@/components/features/home/HomeMotion";
import HomeLocateWidget from "@/components/features/home/HomeLocateWidget";
import HomeDemoVideo from "@/components/features/home/HomeDemoVideo";
import HomeSupportedCountries from "@/components/features/home/HomeSupportedCountries";
import HomeLatestNews, { type HomeLatestNewsArticle } from "@/components/features/home/HomeLatestNews";
import { useTranslation } from "@/contexts/LanguageContext";
import { SITE_URL } from "@/lib/constants/site";
import { useRef } from "react";

const BASE_URL = SITE_URL;

const BOUNDARY_LEVELS = ["Polling District", "Federal Area", "Country", "International"];

const BRIDGE_STEPS = [
  {
    icon: Search,
    title: "Find",
    text: "Search for who represents you — no lengthy forms.",
  },
  {
    icon: MessageSquare,
    title: "Read",
    text: "Listen to what people around you really think.",
  },
  {
    icon: Vote,
    title: "Vote",
    text: "Make your choice with confidence, not guesses.",
  },
];

const STEPS = [
  {
    icon: MapPin,
    title: "Find your voting area",
    text: "Share your location once. We instantly match it to your real voting area — no forms to fill out, your privacy stays completely safe.",
  },
  {
    icon: Layers,
    title: "Join neighborhood conversations",
    text: "Read real discussions from people in your voting area. Easily switch between your street, city, province, country, or global conversations.",
  },
  {
    icon: Megaphone,
    title: "Speak up on what matters",
    text: "Share your opinion anonymously. Show your elected officials which local issues you care about most. They see real people speaking up, not bots or outsiders.",
  },
];

const MOCK_SEATS = [
  { role: "MLA", name: "Surrey South", election: "2028 Provincial", candidates: "3 candidates" },
  { role: "MP", name: "Vancouver-Fraserview", election: "2028 Federal", candidates: "2 candidates" },
  { role: "City Councillor", name: "District 4", election: "Municipal", candidates: "5 candidates" },
];

const TRUST_CHIPS = [
  { icon: Flame, label: "Speak freely, stay hidden" },
  { icon: MapPin, label: "Real voting areas verified" },
  { icon: Scale, label: "No favorite parties" },
  { icon: ThumbsUp, label: "Real people, real votes" },
];

const AUDIENCES = [
  {
    icon: Users,
    label: "For Voters",
    accent: "text-accent",
    pitch: "Be heard on issues that affect your neighborhood — not just the big national news.",
    points: [
      "See all discussions from your area in one place",
      "Post and comment with a private anonymous name",
      "Change your anonymous name anytime for a fresh start",
      "Real votes only — one person, one vote. No fake accounts allowed",
    ],
    ctaHref: "/auth?role=citizen",
    ctaLabel: "Join your area",
    secondaryHref: "/find-my-district",
    secondaryLabel: "not sure your voting area? find it now",
  },
  {
    icon: Landmark,
    label: "For People Who Want to Run",
    accent: "text-primary",
    pitch: "Run for office without needing a party. The voters decide who they like, not party bosses.",
    points: [
      "Your own public page where voters can learn about you",
      "Answer voter questions directly — no avoiding tough questions",
      "Record short videos explaining your ideas, right on the site",
      "See exactly what voters are asking and decide how to answer",
    ],
    ctaHref: "/auth?role=politician",
    ctaLabel: "Run for office",
    secondaryHref: "/elections",
    secondaryLabel: "or see open races near you",
  },
];

const FEATURES = [
  {
    icon: Flame,
    title: "Anonymous names you can change",
    text: "Use a private name when you post. Switch to a new anonymous name anytime you want a fresh start.",
  },
  {
    icon: Video,
    title: "Real video answers",
    text: "Politicians record video answers to voter questions. You get their real voice, not just written words.",
  },
  {
    icon: ThumbsUp,
    title: "Real votes only",
    text: "One person gets one vote. No fake accounts, no outsiders. Just real people from your area.",
  },
  {
    icon: Globe2,
    title: "Talk at every level",
    text: "Discuss your street, your city, your province, your country — or think globally. Pick what matters to you.",
  },
  {
    icon: MessageSquare,
    title: "Neighbors talking together",
    text: "Conversations stay local. You're talking with real people from your area who care about the same issues.",
  },
  {
    icon: MapPin,
    title: "Verified voting areas",
    text: "We make sure you see discussions only from your actual voting area. No confusion about who represents you.",
  },
];

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

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Choseno",
  url: BASE_URL,
  description:
    "An anonymous civic social platform connecting citizens and independent candidates inside real electoral boundaries.",
};

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
    { icon: Flame, label: t("home.trustChips.anonymous") },
    { icon: MapPin, label: t("home.trustChips.verified") },
    { icon: Scale, label: t("home.trustChips.nonpartisan") },
    { icon: ThumbsUp, label: t("home.trustChips.realPeople") },
  ];

  const bridgeSteps = [
    { icon: Search, title: t("home.bridge.step1Title"), text: t("home.bridge.step1Text") },
    { icon: MessageSquare, title: t("home.bridge.step2Title"), text: t("home.bridge.step2Text") },
    { icon: Vote, title: t("home.bridge.step3Title"), text: t("home.bridge.step3Text") },
  ];

  const steps = [
    { icon: MapPin, title: t("home.howItWorks.step1Title"), text: t("home.howItWorks.step1Text") },
    { icon: Layers, title: t("home.howItWorks.step2Title"), text: t("home.howItWorks.step2Text") },
    { icon: Megaphone, title: t("home.howItWorks.step3Title"), text: t("home.howItWorks.step3Text") },
  ];

  const audiences = [
    {
      icon: Users,
      label: t("home.audiences.voterLabel"),
      accent: "text-accent",
      pitch: t("home.audiences.voterPitch"),
      points: [
        t("home.audiences.voterPoint1"),
        t("home.audiences.voterPoint2"),
        t("home.audiences.voterPoint3"),
        t("home.audiences.voterPoint4"),
      ],
      ctaHref: "/auth?role=citizen",
      ctaLabel: t("home.audiences.voterCta"),
      secondaryHref: "/find-my-district",
      secondaryLabel: t("home.audiences.voterSecondary"),
    },
    {
      icon: Landmark,
      label: t("home.audiences.candidateLabel"),
      accent: "text-primary",
      pitch: t("home.audiences.candidatePitch"),
      points: [
        t("home.audiences.candidatePoint1"),
        t("home.audiences.candidatePoint2"),
        t("home.audiences.candidatePoint3"),
        t("home.audiences.candidatePoint4"),
      ],
      ctaHref: "/auth?role=politician",
      ctaLabel: t("home.audiences.candidateCta"),
      secondaryHref: "/elections",
      secondaryLabel: t("home.audiences.candidateSecondary"),
    },
  ];

  const features = [
    { icon: Flame, title: t("home.features.f1Title"), text: t("home.features.f1Text") },
    { icon: Video, title: t("home.features.f2Title"), text: t("home.features.f2Text") },
    { icon: ThumbsUp, title: t("home.features.f3Title"), text: t("home.features.f3Text") },
    { icon: Globe2, title: t("home.features.f4Title"), text: t("home.features.f4Text") },
    { icon: MessageSquare, title: t("home.features.f5Title"), text: t("home.features.f5Text") },
    { icon: MapPin, title: t("home.features.f6Title"), text: t("home.features.f6Text") },
  ];

  const faqsData = t("home.faqs", "") as unknown;
  const faqList: { q: string; a: string }[] = Array.isArray(faqsData) ? faqsData : [];

  return (
    <div className="w-full overflow-x-clip">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd).replace(/</g, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}
      />

      {/* ============ HERO — real content, server-rendered; HeroSection only supplies the motion shell ============ */}
      <HeroSection>
        <div className="grid lg:grid-cols-[1.15fr_1fr] gap-8 sm:gap-10 lg:gap-10 items-center">
          {/* Left — pitch + CTAs. On mobile, hide the right-side widget to make room for content.
              Each piece cascades in on its own delay (mode="mount" -- plays immediately, not on
              scroll-into-view) instead of the whole block fading in as one flat unit. */}
          <div className="text-center lg:text-left min-w-0">
            <Reveal mode="mount">
              <span className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full border border-accent/40 bg-surface-elevated/90 elevation-3 text-xs font-bold tracking-wide text-accent">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent" />
                </span>
                {t("home.badge")}
              </span>
            </Reveal>

            <Reveal mode="mount" delay={90}>
              <h1 className="font-display text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.02] mt-4 sm:mt-8 tracking-tight drop-shadow-2xl">
                {t("home.titleMain")}
                <br />
                <span className="text-primary">{t("home.titleSub")}</span>
              </h1>
            </Reveal>

            <Reveal mode="mount" delay={200}>
              <p className="text-base sm:text-lg md:text-xl text-text-main/90 font-medium max-w-2xs sm:max-w-2xl mx-auto lg:mx-0 mt-4 sm:mt-7 leading-relaxed">
                {t("home.subtitle")}
              </p>
            </Reveal>

            <Reveal mode="mount" delay={300}>
              {/* On mobile, hide the label to save space; just show the boundary pill.
                  On sm+, show the full "Conversations scoped to [Boundary]" */}
              <div className="mt-8 sm:mt-9 hidden sm:flex items-center justify-center lg:justify-start gap-3 text-base text-text-muted">
                <span className="font-medium text-text-main/80">{t("home.scopedTo")}</span>
                <CyclingBoundaryPill levels={BOUNDARY_LEVELS} />
              </div>

              {/* Mobile: condensed version — just show the pill, no label */}
              <div className="mt-4 sm:hidden flex justify-center">
                <CyclingBoundaryPill levels={BOUNDARY_LEVELS} />
              </div>
            </Reveal>

            <Reveal mode="mount" delay={400}>
              <div className="mt-4 sm:mt-12">
                <RoleSplitCta align="start" />
              </div>
            </Reveal>
          </div>

          {/* Right — compact "find your district" widget. Floats idly, tilts
              toward the cursor on top of that, and cascades in last, once
              the pitch has already landed. */}
          <Reveal mode="mount" delay={250} className="mt-8 lg:mt-0 flex justify-center lg:justify-end min-w-0">
            <FloatingElement distance={9} duration={5}>
              <TiltCard>
                <HomeLocateWidget />
              </TiltCard>
            </FloatingElement>
          </Reveal>
        </div>
      </HeroSection>

      {/* ============ TRUST BAR ============ */}
      <section className="relative px-4 sm:px-6 py-6" aria-label="Trust and privacy at a glance">
        <StaggerGroup className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {trustChips.map((chip) => (
            <StaggerItem key={chip.label}>
              <span className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-border-light/50 bg-surface-elevated/70 text-xs sm:text-sm font-semibold text-text-secondary">
                <chip.icon size={13} className="text-primary shrink-0" aria-hidden="true" />
                <span className="truncate">{chip.label}</span>
              </span>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </section>

      {/* ============ DEMO VIDEO SECTION ============ */}
      <HomeDemoVideo />

      {/* ============ SUPPORTED COUNTRIES SECTION ============ */}
      <HomeSupportedCountries />

      {/* ============ CONCEPT BRIDGE — Google Reviews analogy ============ */}
      <section className="relative py-16 sm:py-24 px-4 sm:px-6 overflow-hidden">
        <SectionOrbs
          orbs={[
            { variant: "orb-d", range: [80, -140], driftX: [0, -30, 20, 0], duration: 20 },
            { variant: "orb-e", range: [-100, 120], driftX: [0, 25, -20, 0], duration: 24 },
          ]}
        />
        <div className="relative max-w-4xl mx-auto text-center">
          <Reveal>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight">
              {t("home.bridge.title")}
            </h2>
            <p className="mt-3 sm:mt-4 text-base sm:text-lg text-text-muted max-w-xl mx-auto">
              {t("home.bridge.subtitle")}
            </p>
          </Reveal>

          <Reveal
            delay={120}
            className="mt-12 sm:mt-16 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-3"
          >
            {bridgeSteps.map((step, i) => (
              <div key={step.title} className="contents">
                <div className="flex flex-col items-center gap-2 sm:gap-3 w-full sm:w-44">
                  <FloatingElement distance={5} duration={3.4 + i * 0.4} delay={i * 0.25}>
                    <div className="w-12 sm:w-14 h-12 sm:h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <step.icon size={18} className="text-primary" aria-hidden="true" />
                    </div>
                  </FloatingElement>
                  <h3 className="text-base sm:text-lg font-bold text-text-main">{step.title}</h3>
                  <p className="text-xs sm:text-sm text-text-muted leading-relaxed">{step.text}</p>
                </div>
                {i < bridgeSteps.length - 1 && (
                  <ArrowRight
                    size={20}
                    className="text-primary/40 rotate-90 sm:rotate-0 shrink-0"
                    aria-hidden="true"
                  />
                )}
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section className="relative py-16 sm:py-28 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-12 sm:mb-16">
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight">
              {t("home.howItWorks.title")}
            </h2>
          </Reveal>

          <StaggerGroup className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-7">
            {steps.map((step, i) => (
              <StaggerItem key={step.title}>
                <HoverLift shine className="glass-card elevation-2 p-5 sm:p-6 lg:p-8 h-full group hover:border-primary/40 transition-all duration-300">
                  <span className="font-display text-5xl sm:text-6xl lg:text-7xl font-black text-primary/20 group-hover:text-primary/35 transition-colors duration-500 select-none leading-none">
                    0{i + 1}
                  </span>
                  <h3 className="mt-4 sm:mt-5 text-lg sm:text-xl lg:text-2xl font-bold tracking-tight flex items-center gap-2">
                    <step.icon size={18} className="text-primary shrink-0" aria-hidden="true" />
                    <span>{step.title}</span>
                  </h3>
                  <p className="mt-2 sm:mt-3 text-text-muted text-sm sm:text-base leading-relaxed">{step.text}</p>
                </HoverLift>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* ============ WHY JOIN — split by audience ============ */}
      <section className="relative py-16 sm:py-28 px-4 sm:px-6 overflow-hidden">
        <SectionOrbs
          orbs={[
            { variant: "orb-a", range: [-120, 100], driftX: [0, 30, -25, 0], duration: 19 },
            { variant: "orb-b", range: [140, -100], driftX: [0, -25, 30, 0], duration: 23 },
          ]}
        />
        <div className="relative max-w-6xl mx-auto">
          <Reveal className="text-center mb-12 sm:mb-16">
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight">
              {t("home.audiences.title")}
            </h2>
          </Reveal>

          <StaggerGroup className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:gap-7">
            {audiences.map((audience, i) => (
              <StaggerItem key={audience.label}>
                <HoverLift lift={8} shine className="glass-card elevation-2 p-5 sm:p-6 lg:p-8 h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 sm:gap-3">
                      <FloatingElement distance={4} duration={3.8 + i * 0.5} delay={i * 0.3}>
                        <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-2xl bg-surface/80 border border-border-light/40 flex items-center justify-center shrink-0">
                          <audience.icon size={20} className={audience.accent} aria-hidden="true" />
                        </div>
                      </FloatingElement>
                      <h3 className="text-lg sm:text-xl lg:text-2xl font-bold tracking-tight">{audience.label}</h3>
                    </div>

                    <p className="mt-3 sm:mt-4 text-text-muted text-xs sm:text-sm leading-relaxed">{audience.pitch}</p>

                    <ul className="mt-4 sm:mt-6 space-y-2 sm:space-y-3">
                      {audience.points.map((pt) => (
                        <li key={pt} className="flex items-start gap-2 sm:gap-2.5 text-xs sm:text-sm text-text-muted leading-relaxed">
                          <CheckCircle2 size={14} className="text-primary mt-0.5 shrink-0" aria-hidden="true" />
                          {pt}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-6 sm:mt-8 flex flex-col gap-2">
                    <MagneticCta
                      href={audience.ctaHref}
                      className="group w-full inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl bg-primary text-text-on-primary font-bold text-sm sm:text-base hover:bg-primary-hover transition-all duration-300"
                    >
                      {audience.ctaLabel}
                    </MagneticCta>
                    {audience.secondaryHref && (
                      <Link
                        href={audience.secondaryHref}
                        className="text-center text-xs text-text-muted hover:text-text-main underline decoration-primary/40 underline-offset-4 transition-colors"
                      >
                        {audience.secondaryLabel}
                      </Link>
                    )}
                  </div>
                </HoverLift>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* ============ RATE A POLITICIAN — scroll-driven star animation ============ */}
      <section className="relative py-16 sm:py-28 px-4 sm:px-6 overflow-hidden" ref={ratingSectionRef}>
        <SectionOrbs
          orbs={[
            { variant: "orb-c", range: [-100, 140], driftX: [0, 30, -25, 0], duration: 20 },
            { variant: "orb-a", range: [120, -80], driftX: [0, -25, 20, 0], duration: 22 },
          ]}
        />
        <div className="relative max-w-4xl mx-auto">
          <Reveal className="text-center mb-16 sm:mb-20">
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight">
              {t("home.rateTitle", "Rate politicians based on results, not rhetoric.")}
            </h2>
            <p className="mt-3 sm:mt-4 text-base sm:text-lg text-text-muted max-w-2xl mx-auto">
              {t("home.rateSubtitle", "See what your neighbors really think. Scroll down to see stars light up as you explore how it works.")}
            </p>
          </Reveal>

          <div className="relative glass-card elevation-2 p-8 sm:p-12 lg:p-16 flex items-center justify-center min-h-[420px]">
            <ScrollRatingStars
              sectionRef={ratingSectionRef}
              politicianName="Jenny Kwan"
              title="Member of Parliament"
              party="Vancouver East"
              description="Focused on advocating for working families and strengthening community support programs in Vancouver East. Known for active engagement on housing affordability and economic justice."
            />
          </div>

          <div className="mt-12 sm:mt-16">
            <Reveal className="text-center">
              <p className="text-sm sm:text-base text-text-muted max-w-2xl mx-auto mb-6">
                {t("home.rateFeature", "Real people from your area rate elected officials on performance. No anonymous trolls, no fake votes — just neighbors sharing their real experience.")}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/auth?role=citizen"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-text-on-primary font-bold text-sm sm:text-base hover:bg-primary-hover transition-all duration-300"
                >
                  {t("home.rateCtaPrimary", "Rate your representatives")}
                  <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/wall/jenny-kwan-mp"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-primary/50 bg-surface-elevated/70 text-text-main font-bold text-sm sm:text-base hover:bg-primary/10 hover:border-primary transition-all duration-300"
                >
                  {t("home.rateCtaSecondary", "See real ratings")}
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============ FEATURE GRID ============ */}
      <section className="relative py-16 sm:py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-12 sm:mb-16">
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight">
              {t("home.features.title")}
            </h2>
          </Reveal>

          <StaggerGroup className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
            {features.map((feat) => (
              <StaggerItem key={feat.title}>
                <HoverLift lift={5} shine className="glass-card p-4 sm:p-5 lg:p-6 h-full space-y-2 sm:space-y-3 hover:border-primary/40 transition-colors duration-300">
                  <feat.icon size={20} className="text-primary" aria-hidden="true" />
                  <h3 className="text-base sm:text-lg font-bold text-text-main">{feat.title}</h3>
                  <p className="text-xs sm:text-sm text-text-muted leading-relaxed">{feat.text}</p>
                </HoverLift>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* ============ LATEST NEWS ============ */}
      <HomeLatestNews articles={latestNews} />

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
      <section className="relative py-16 sm:py-28 px-4 sm:px-6 text-center overflow-hidden">
        <SectionOrbs
          orbs={[
            { variant: "orb-d", range: [100, -80], driftX: [0, -30, 25, 0], duration: 21 },
            { variant: "orb-e", range: [-90, 110], driftX: [0, 25, -30, 0], duration: 25 },
          ]}
        />
        <div className="relative max-w-4xl mx-auto">
          <Reveal>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-extrabold tracking-tight">
              {t("home.closing.titleMain")}{" "}
              <span className="text-primary">{t("home.closing.titleSub")}</span>
            </h2>
            <p className="mt-4 sm:mt-6 text-base sm:text-lg lg:text-xl text-text-muted max-w-2xl mx-auto">
              {t("home.closing.subtitle")}
            </p>

            <div className="mt-8 sm:mt-10">
              <RoleSplitCta size="md" />
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
