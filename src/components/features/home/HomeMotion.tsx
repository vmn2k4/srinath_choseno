"use client";

// Small, generic animation wrappers for the Home page. Split out from what
// used to be one monolithic "use client" HomePageClient so the real content
// (headings, paragraphs, list items) can live in the server-rendered
// page.tsx and be passed in as `children` -- children passed from a Server
// Component into a Client Component are still rendered server-side and
// included in the initial HTML; only these wrapper components' own motion
// logic runs client-side. This is what makes Home's actual copy visible to
// a crawler that doesn't execute JS, instead of only existing after
// hydration.

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { MapPin, ArrowRight } from "lucide-react";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.7, ease: EASE, delay: delay / 1000 }}
    >
      {children}
    </motion.div>
  );
}

// Generic hover-lift for cards -- replaces the old per-section inline
// `motion.div whileHover={{ y: -8 }}` duplication.
export function HoverLift({
  children,
  className = "",
  lift = 8,
}: {
  children: ReactNode;
  className?: string;
  lift?: number;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      whileHover={reduceMotion ? undefined : { y: -lift, scale: lift > 4 ? 1.01 : 1 }}
      transition={{ duration: 0.3, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function ParallaxOrb({
  className,
  sectionRef,
  range = [-140, 140],
  driftX = [0, 40, -20, 0],
  duration = 18,
}: {
  className: string;
  sectionRef: RefObject<HTMLDivElement | null>;
  range?: number[];
  driftX?: number[];
  duration?: number;
}) {
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], range);

  if (reduceMotion) return <div aria-hidden="true" className={className} />;
  return (
    <motion.div
      aria-hidden="true"
      className={className}
      style={{ y }}
      animate={{ x: driftX, scale: [1, 1.08, 0.95, 1] }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

// The full hero <section> — owns its own scroll-tracking ref internally
// (refs can only live on client-rendered elements, so this can't be split
// into "server section + client ref" — the whole interactive shell is one
// client component) and renders whatever real heading/paragraph content
// the server page hands it as `children`, inside the scroll-linked
// fade/scale/translate frame plus the three decorative parallax orbs.
export function HeroSection({ children }: { children: ReactNode }) {
  const heroRef = useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, 110]);
  const opacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.92]);

  return (
    <section
      ref={heroRef}
      className="relative min-h-[92vh] flex items-center justify-center px-6 py-16 lg:py-6 overflow-hidden"
    >
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
        <ParallaxOrb className="orb orb-a" sectionRef={heroRef} range={[0, -180]} driftX={[0, 40, -20, 0]} duration={18} />
        <ParallaxOrb className="orb orb-b" sectionRef={heroRef} range={[0, 220]} driftX={[0, -35, 25, 0]} duration={22} />
        <ParallaxOrb className="orb orb-c" sectionRef={heroRef} range={[0, -120]} driftX={[0, 30, -30, 0]} duration={16} />
      </div>

      <motion.div
        style={reduceMotion ? undefined : { y, opacity, scale }}
        className="relative z-10 max-w-7xl mx-auto w-full"
      >
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          {children}
        </motion.div>
      </motion.div>
    </section>
  );
}

// Self-contained cycling pill ("Polling District" -> "Federal Area" -> ...)
// — the one piece of the hero with real interactive state, isolated to its
// own tiny client component so the surrounding headline/paragraph stay
// plain server-rendered text.
export function CyclingBoundaryPill({ levels }: { levels: string[] }) {
  const [activeLevel, setActiveLevel] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    const id = setInterval(() => setActiveLevel((i) => (i + 1) % levels.length), 2600);
    return () => clearInterval(id);
  }, [reduceMotion, levels.length]);

  return (
    <span className="relative inline-grid">
      <AnimatePresence mode="wait">
        <motion.span
          key={activeLevel}
          initial={{ opacity: 0, y: 10, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.94 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="col-start-1 row-start-1 inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-primary/20 border border-primary/40 text-primary font-bold"
        >
          <MapPin size={16} aria-hidden="true" />
          {levels[activeLevel]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

// The one piece of the page that genuinely needs client-side auth state:
// the CTA destination/label depends on whether a session exists. Signed-out
// visitors get two role-segmented CTAs instead of one generic button, since
// a citizen and a future candidate want to land in different places -- the
// `role` query param carries through /auth -> /onboarding so the role step
// there is pre-selected instead of asked twice. Kept as a small island
// rather than making the whole page client-side for it.
export function RoleSplitCta({
  size = "lg",
  align = "center",
}: {
  size?: "lg" | "md";
  align?: "center" | "start";
}) {
  const { session } = useAuth();
  const big = size === "lg";
  const pad = big ? "px-8 py-4.5 text-lg" : "px-6 py-3.5 text-sm";
  const iconSize = big ? 20 : 16;
  const justify = align === "start" ? "justify-center lg:justify-start" : "justify-center";

  if (session) {
    return (
      <Link
        href="/feed"
        className={`group inline-flex items-center gap-3 ${
          big ? "px-9 py-4.5 text-xl" : pad
        } rounded-2xl bg-primary text-text-on-primary font-bold hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all duration-300 cursor-pointer shadow-elevated-md`}
      >
        Open your feed
        <ArrowRight
          size={big ? 22 : iconSize}
          className="transition-transform duration-300 group-hover:translate-x-1.5"
          aria-hidden="true"
        />
      </Link>
    );
  }

  return (
    <div className={`flex flex-col sm:flex-row items-center ${justify} gap-4`}>
      <Link
        href="/auth?role=citizen"
        className={`group inline-flex items-center gap-3 ${pad} rounded-2xl bg-primary text-text-on-primary font-bold hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all duration-300 cursor-pointer shadow-elevated-md`}
      >
        I&apos;m a Citizen
        <ArrowRight
          size={iconSize}
          className="transition-transform duration-300 group-hover:translate-x-1.5"
          aria-hidden="true"
        />
      </Link>
      <Link
        href="/auth?role=politician"
        className={`group inline-flex items-center gap-3 ${pad} rounded-2xl border-2 border-primary/50 bg-surface-elevated/70 text-text-main font-bold hover:bg-primary/10 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all duration-300 cursor-pointer`}
      >
        I&apos;m Running for Office
        <ArrowRight
          size={iconSize}
          className="transition-transform duration-300 group-hover:translate-x-1.5"
          aria-hidden="true"
        />
      </Link>
    </div>
  );
}

export { useReducedMotion };
