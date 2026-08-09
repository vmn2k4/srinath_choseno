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
} from "lucide-react";
import { ContainerScroll } from "@/components/primitives";
import {
  Reveal,
  HoverLift,
  HeroSection,
  CyclingBoundaryPill,
  RoleSplitCta,
} from "@/components/features/home/HomeMotion";
import { SITE_URL } from "@/lib/constants/site";

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

export default function HomePage() {
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
        <span className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full border border-accent/40 bg-surface-elevated/90 elevation-3 text-xs font-bold tracking-wide text-accent">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent" />
          </span>
          The real voice of voters
        </span>

        <h1 className="font-display text-6xl sm:text-7xl md:text-8xl font-extrabold leading-[1.02] mt-8 tracking-tight drop-shadow-2xl">
          Rate Your Politicians&apos; Performance.
          <br />
          <span className="text-primary">Like Yelp, but for Democracy.</span>
        </h1>

        <p className="text-xl md:text-2xl text-text-main/90 font-medium max-w-3xl mx-auto mt-7 leading-relaxed">
          A secure, anonymous space to hold local leaders accountable. Share your
          experience, read what your neighbors think, and walk into the booth
          informed — no toxicity, just accountability.
        </p>

        <div className="mt-9 flex items-center justify-center gap-3 text-base text-text-muted">
          <span className="font-medium text-text-main/80">Conversations scoped to</span>
          <CyclingBoundaryPill levels={BOUNDARY_LEVELS} />
        </div>

        <div className="mt-12">
          <RoleSplitCta />
        </div>
      </HeroSection>

      {/* ============ TRUST BAR ============ */}
      <section className="relative px-6 py-6" aria-label="Trust and privacy at a glance">
        <Reveal className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-3">
          {TRUST_CHIPS.map((chip) => (
            <span
              key={chip.label}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border-light/50 bg-surface-elevated/70 text-sm font-semibold text-text-secondary"
            >
              <chip.icon size={15} className="text-primary shrink-0" aria-hidden="true" />
              {chip.label}
            </span>
          ))}
        </Reveal>
      </section>

      {/* ============ CONCEPT BRIDGE — Yelp analogy ============ */}
      <section className="relative py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <Reveal>
            <h2 className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight">
              Democracy, simplified.
            </h2>
            <p className="mt-4 text-lg text-text-muted max-w-xl mx-auto">
              Same as picking a restaurant — except this time you&apos;re choosing who
              represents you.
            </p>
          </Reveal>

          <Reveal
            delay={120}
            className="mt-16 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-3"
          >
            {BRIDGE_STEPS.map((step, i) => (
              <div key={step.title} className="contents">
                <div className="flex flex-col items-center gap-3 w-full sm:w-44">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <step.icon size={22} className="text-primary" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-bold text-text-main">{step.title}</h3>
                  <p className="text-sm text-text-muted leading-relaxed">{step.text}</p>
                </div>
                {i < BRIDGE_STEPS.length - 1 && (
                  <ArrowRight
                    size={22}
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
      <section className="relative py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-16">
            <h2 className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight">
              Three simple steps to get started
            </h2>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-7">
            {STEPS.map((step, i) => (
              <Reveal key={step.title} delay={i * 120}>
                <HoverLift className="glass-card elevation-2 p-8 h-full group hover:border-primary/40 transition-all duration-300 relative overflow-hidden">
                  <span className="font-display text-7xl font-black text-primary/20 group-hover:text-primary/35 transition-colors duration-500 select-none leading-none">
                    0{i + 1}
                  </span>
                  <h3 className="mt-5 text-2xl font-bold tracking-tight flex items-center gap-2.5">
                    <step.icon size={20} className="text-primary" aria-hidden="true" />
                    {step.title}
                  </h3>
                  <p className="mt-3 text-text-muted text-base leading-relaxed">{step.text}</p>
                </HoverLift>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ WHY JOIN — split by audience ============ */}
      <section className="relative py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-16">
            <h2 className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight">
              Whether you&apos;re voting or running
            </h2>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-7">
            {AUDIENCES.map((audience, i) => (
              <Reveal key={audience.label} delay={i * 120}>
                <HoverLift lift={8} className="glass-card elevation-2 p-8 h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-surface/80 border border-border-light/40 flex items-center justify-center">
                        <audience.icon size={24} className={audience.accent} aria-hidden="true" />
                      </div>
                      <h3 className="text-2xl font-bold tracking-tight">{audience.label}</h3>
                    </div>

                    <p className="mt-4 text-text-muted text-sm leading-relaxed">{audience.pitch}</p>

                    <ul className="mt-6 space-y-3">
                      {audience.points.map((pt) => (
                        <li key={pt} className="flex items-start gap-2.5 text-sm text-text-muted leading-relaxed">
                          <CheckCircle2 size={16} className="text-primary mt-0.5 shrink-0" aria-hidden="true" />
                          {pt}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-8 flex flex-col gap-2">
                    <a
                      href={audience.ctaHref}
                      className="group inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-text-on-primary font-bold text-sm hover:bg-primary-hover transition-all duration-300"
                    >
                      {audience.ctaLabel}
                    </a>
                    {audience.secondaryHref && (
                      <a
                        href={audience.secondaryHref}
                        className="text-center text-xs text-text-muted hover:text-text-main underline decoration-primary/40 underline-offset-4 transition-colors"
                      >
                        {audience.secondaryLabel}
                      </a>
                    )}
                  </div>
                </HoverLift>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PRODUCT PREVIEW ============ */}
      <section className="relative px-6">
        <ContainerScroll
          titleComponent={
            <h2 className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight">
              Every district,
              <br />
              <span className="text-primary">one feed away.</span>
            </h2>
          }
        >
          <div className="h-full w-full flex flex-col" aria-hidden="true">
            <div className="flex items-center gap-2 px-4 md:px-6 py-3 border-b border-border-light/40 bg-surface-elevated/60 shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-danger/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-primary/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-accent/70" />
              <span className="ml-3 text-[11px] text-text-muted font-mono truncate">
                choseno.com/elections
              </span>
            </div>
            <div className="flex-1 overflow-hidden p-4 md:p-8 space-y-3">
              {MOCK_SEATS.map((seat) => (
                <div
                  key={seat.name}
                  className="flex items-center justify-between gap-4 px-5 md:px-6 py-4.5 border-b border-border-light/50 last:border-b-0 hover:bg-surface-hover/40 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-accent tracking-wide mb-1">
                      {seat.election} · Nominations open
                    </p>
                    <p className="font-extrabold text-lg text-text-main flex items-center gap-2 flex-wrap">
                      {seat.role}
                      <span className="text-sm font-medium text-text-muted flex items-center gap-1.5 bg-surface/60 px-2.5 py-0.5 rounded-lg border border-border-light">
                        <MapPin size={13} className="text-accent" /> {seat.name}
                      </span>
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-xl shrink-0">
                    {seat.candidates}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </ContainerScroll>
      </section>

      {/* ============ FEATURE GRID ============ */}
      <section className="relative py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-16">
            <h2 className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight">
              Built for trust and privacy
            </h2>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feat, i) => (
              <Reveal key={feat.title} delay={i * 80}>
                <div className="glass-card p-6 h-full space-y-3">
                  <feat.icon size={22} className="text-primary" aria-hidden="true" />
                  <h3 className="text-lg font-bold text-text-main">{feat.title}</h3>
                  <p className="text-sm text-text-muted leading-relaxed">{feat.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="relative py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <Reveal className="text-center mb-14">
            <h2 className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight">
              Questions, answered
            </h2>
          </Reveal>

          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <Reveal key={faq.q} delay={i * 60}>
                <details className="glass-card p-6 group">
                  <summary className="flex items-center justify-between gap-4 cursor-pointer list-none font-bold text-text-main text-base sm:text-lg">
                    {faq.q}
                    <ShieldCheck
                      size={18}
                      className="text-primary shrink-0 transition-transform duration-300 group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </summary>
                  <p className="mt-3 text-sm sm:text-base text-text-muted leading-relaxed">{faq.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CLOSING CTA ============ */}
      <section className="relative py-28 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <Reveal>
            <h2 className="font-display text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight">
              Join your district. <span className="text-primary">Vote informed.</span>
            </h2>
            <p className="mt-6 text-xl text-text-muted max-w-2xl mx-auto">
              See what your neighbors are already saying, then walk into the booth
              knowing exactly who you&apos;re choosing.
            </p>

            <div className="mt-10">
              <RoleSplitCta size="md" />
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
