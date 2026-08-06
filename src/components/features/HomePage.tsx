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

const STEPS = [
  {
    icon: MapPin,
    title: "Verify your district",
    text: "Share your location once. PostGIS automatically matches your coordinates with official electoral boundaries — no address forms, zero identity leakage.",
  },
  {
    icon: Layers,
    title: "Explore local feeds",
    text: "Access civic conversations scoped strictly to where you live. Seamlessly switch between polling district, municipal, federal, and international levels.",
  },
  {
    icon: Megaphone,
    title: "Signal constituent support",
    text: "Participate anonymously and endorse key local issues. Representatives receive verified constituent signals rather than out-of-district noise.",
  },
];

const MOCK_SEATS = [
  { role: "MLA", name: "Surrey South", election: "2028 Provincial", candidates: "3 candidates" },
  { role: "MP", name: "Vancouver-Fraserview", election: "2028 Federal", candidates: "2 candidates" },
  { role: "City Councillor", name: "District 4", election: "Municipal", candidates: "5 candidates" },
];

const TRUST_CHIPS = [
  { icon: Flame, label: "Anonymous by design" },
  { icon: MapPin, label: "PostGIS-verified boundaries" },
  { icon: Scale, label: "No party ranking" },
  { icon: ThumbsUp, label: "One verified endorsement per resident" },
];

const AUDIENCES = [
  {
    icon: Users,
    label: "For Citizens",
    accent: "text-accent",
    pitch: "Get heard in the race that actually decides your street, not the one dominating the news cycle.",
    points: [
      "A civic feed locked to your real electoral boundary — polling district up to federal",
      "Post and comment under a rotating, anonymous Ghost ID",
      "Burn your Ghost ID any time for a completely fresh identity",
      "One verified endorsement per resident — signals that can't be bot-farmed",
    ],
    ctaHref: "/auth?role=citizen",
    ctaLabel: "Join your district",
    secondaryHref: "/find-my-district",
    secondaryLabel: "not sure which district you're in? find out",
  },
  {
    icon: Landmark,
    label: "For Future Politicians",
    accent: "text-primary",
    pitch: "Run without a party machine behind you — Choseno never ranks candidates by party, only by what constituents ask them directly.",
    points: [
      "A public campaign wall generated automatically once you nominate",
      "Your replies always surface above the rest of the thread — no dodging a hard question",
      "Record video position statements directly in-browser",
      "A side-by-side questionnaire so voters compare substance, not spin",
    ],
    ctaHref: "/auth?role=politician",
    ctaLabel: "Run for office",
    secondaryHref: "/elections",
    secondaryLabel: "or browse open seats near you",
  },
];

const FEATURES = [
  {
    icon: Flame,
    title: "Rotatable Ghost IDs",
    text: "Participate freely. Posts use a privacy-preserving ghost UUID — burn it anytime for a completely fresh identity.",
  },
  {
    icon: Video,
    title: "Direct video statements",
    text: "Representatives post video messages in-browser, ensuring position statements remain authentic and unedited.",
  },
  {
    icon: ThumbsUp,
    title: "Constituent endorsements",
    text: "One verified constituent, one endorsement. Prevents bot farms, brigading, and out-of-district manipulation.",
  },
  {
    icon: Globe2,
    title: "4-Tier boundary scoping",
    text: "From your immediate polling district to federal and international levels, debate happens where it belongs.",
  },
  {
    icon: MessageSquare,
    title: "Hyper-local threads",
    text: "Discussion threads remain scoped to your actual district, connecting you with verified local neighbours.",
  },
  {
    icon: MapPin,
    title: "PostGIS boundary matching",
    text: "Feeds use official spatial geometry matched to your coordinates with exact point-in-polygon precision.",
  },
];

const FAQS = [
  {
    q: "Is Choseno really anonymous?",
    a: "Yes. Every post and comment is tied to a rotating Ghost ID, not your real profile — and you can burn it at any time for a completely fresh identity, permanently unlinking everything you've posted before.",
  },
  {
    q: "Can my representative — or an admin — see who I really am?",
    a: "No. Posts are public under your Ghost ID and civic score, never your name. Choseno deliberately never stores a link between your profile and your posts, specifically so that link can't exist to be looked up later.",
  },
  {
    q: "What actually happens when I burn my Ghost ID?",
    a: "Your civic score earned under that identity is banked into your permanent total first. After that, every post and comment tied to the old Ghost ID becomes permanently unlinkable from your account, and you start posting under a brand-new one.",
  },
  {
    q: "How do you verify where I live without an address form?",
    a: "You share your location once, and PostGIS matches your coordinates against real electoral boundary shapes — resolving every jurisdiction you belong to at once, from polling district up to federal, with no address ever typed in.",
  },
  {
    q: "Is Choseno affiliated with a political party?",
    a: "No. A politician's party is optional profile information, but Choseno never uses it to rank, filter, or promote candidates — every candidate in a race is shown on equal footing.",
  },
  {
    q: "I want to run for local office — do I need party backing first?",
    a: "No. Any verified resident can nominate themselves for an open seat in their district once nominations open, complete a short application and questionnaire, and get a public campaign wall — no party required.",
  },
  {
    q: "My area isn't showing any boundaries yet — what do I do?",
    a: "During location setup you can search for your district by name or enter coordinates directly. If nothing matches, that region's boundary data hasn't been added yet — coverage expands as new regions are mapped.",
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
          A framework for future democracy
        </span>

        <h1 className="font-display text-6xl sm:text-7xl md:text-8xl font-extrabold leading-[1.02] mt-8 tracking-tight drop-shadow-2xl">
          Your voice, heard
          <br />
          <span className="text-primary">where you live.</span>
        </h1>

        <p className="text-xl md:text-2xl text-text-main/90 font-medium max-w-3xl mx-auto mt-7 leading-relaxed">
          Choseno connects citizens and independent candidates inside real electoral
          boundaries. Local issues, anonymous voices, honest support signals —
          democracy at the resolution of your street.
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
      <section className="relative px-6 pb-6" aria-label="Trust and privacy at a glance">
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

      {/* ============ HOW IT WORKS ============ */}
      <section className="relative py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-16">
            <h2 className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight">
              From coordinates to community
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
              Ready to take back <span className="text-primary">local civic life?</span>
            </h2>
            <p className="mt-6 text-xl text-text-muted max-w-2xl mx-auto">
              Join your constituency feed today and experience democracy at the
              resolution of your neighborhood.
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
