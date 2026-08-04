import { Metadata } from "next";
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
} from "lucide-react";
import { ContainerScroll } from "@/components/primitives";
import {
  Reveal,
  HoverLift,
  HeroSection,
  CyclingBoundaryPill,
  PrimaryCtaLink,
} from "@/components/features/home/HomeMotion";

const BASE_URL = "https://choseno.com";

export const metadata: Metadata = {
  title: "Choseno — Your voice, heard where you live",
  description:
    "Choseno connects citizens and politicians inside real electoral boundaries. Local issues, anonymous voices, honest support signals — democracy at the resolution of your street.",
  alternates: { canonical: BASE_URL },
  openGraph: {
    title: "Choseno — Scoped Civic Platform",
    description:
      "Choseno connects citizens and politicians inside real electoral boundaries.",
    url: BASE_URL,
    siteName: "Choseno",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Choseno — Scoped Civic Platform",
    description:
      "Choseno connects citizens and politicians inside real electoral boundaries.",
  },
};

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

const ROLES = [
  {
    icon: Users,
    label: "Citizens",
    accent: "text-accent",
    points: [
      "Access local civic feeds locked to your electoral boundary",
      "Engage in constituent discussions with local representatives",
      "Upvote and endorse issues using rotatable Ghost IDs",
      "Burn your Ghost ID anytime to un-link all future posts",
    ],
  },
  {
    icon: Landmark,
    label: "Representatives",
    accent: "text-primary",
    points: [
      "Publish video position statements directly on key topics",
      'Gather verified "I Support" endorsements from constituents',
      "Target messages directly to the districts you represent",
      "Maintain an official candidate wall for public constituent review",
    ],
  },
  {
    icon: ShieldCheck,
    label: "Admins",
    accent: "text-text-muted",
    points: [
      "Import electoral geometries as GeoJSON or Shapefiles",
      "Manage multi-jurisdictional boundary hierarchy maps",
      "Maintain district accuracy as electoral boundaries shift",
      "Verify PostGIS spatial matching for constituent location privacy",
    ],
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

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Choseno",
  url: BASE_URL,
  description:
    "An anonymous civic social platform connecting citizens and politicians inside real electoral boundaries.",
};

export default function HomePage() {
  return (
    <div className="w-full overflow-x-clip">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
          Choseno connects citizens and politicians inside real electoral
          boundaries. Local issues, anonymous voices, honest support signals —
          democracy at the resolution of your street.
        </p>

        <div className="mt-9 flex items-center justify-center gap-3 text-base text-text-muted">
          <span className="font-medium text-text-main/80">Conversations scoped to</span>
          <CyclingBoundaryPill levels={BOUNDARY_LEVELS} />
        </div>

        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <PrimaryCtaLink className="group inline-flex items-center gap-3 px-9 py-4.5 rounded-2xl bg-primary text-text-on-primary font-bold text-xl hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all duration-300 cursor-pointer shadow-elevated-md" />
        </div>
      </HeroSection>

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

      {/* ============ ROLE CARDS ============ */}
      <section className="relative py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-16">
            <h2 className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight">
              Designed for every stakeholder
            </h2>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-7">
            {ROLES.map((role, i) => (
              <Reveal key={role.label} delay={i * 120}>
                <HoverLift lift={8} className="glass-card elevation-2 p-8 h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-surface/80 border border-border-light/40 flex items-center justify-center">
                        <role.icon size={24} className={role.accent} aria-hidden="true" />
                      </div>
                      <h3 className="text-2xl font-bold tracking-tight">{role.label}</h3>
                    </div>

                    <ul className="mt-6 space-y-3">
                      {role.points.map((pt) => (
                        <li key={pt} className="flex items-start gap-2.5 text-sm text-text-muted leading-relaxed">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" aria-hidden="true" />
                          {pt}
                        </li>
                      ))}
                    </ul>
                  </div>
                </HoverLift>
              </Reveal>
            ))}
          </div>
        </div>
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
              <PrimaryCtaLink className="inline-flex items-center gap-3 px-9 py-4.5 rounded-2xl bg-primary text-text-on-primary font-bold text-xl hover:bg-primary-hover transition-all duration-300 cursor-pointer shadow-elevated-md" />
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
