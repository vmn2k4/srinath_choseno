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
  useMotionValue,
  useSpring,
  useReducedMotion,
} from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/LanguageContext";
import { MapPin, ArrowRight } from "lucide-react";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// `mode="view"` (default) triggers once the element scrolls into the
// viewport -- the right choice for anything below the fold. `mode="mount"`
// triggers immediately on mount instead, for above-the-fold hero content
// that should play right away rather than waiting on an intersection
// observer that's already satisfied at load.
export function Reveal({
  children,
  className = "",
  delay = 0,
  mode = "view",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  mode?: "view" | "mount";
}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <div className={className}>{children}</div>;
  const motionProps =
    mode === "mount"
      ? { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 } }
      : {
          initial: { opacity: 0, y: 32 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, amount: 0.15 },
        };
  return (
    <motion.div className={className} {...motionProps} transition={{ duration: 0.7, ease: EASE, delay: delay / 1000 }}>
      {children}
    </motion.div>
  );
}

// Generic hover-lift for cards -- replaces the old per-section inline
// `motion.div whileHover={{ y: -8 }}` duplication. `shine` layers in a
// diagonal light-sweep on hover (variants propagate the hover state from
// this element down to the sweep child automatically -- no separate
// pointer-tracking needed). Uses `color-mix()` off `--color-primary` per the
// design system's "never a raw color" rule, and `screen` blend so it reads
// as light catching glass rather than a flat tinted layer over the copy.
export function HoverLift({
  children,
  className = "",
  lift = 8,
  shine = false,
}: {
  children: ReactNode;
  className?: string;
  lift?: number;
  shine?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const cardVariants = {
    rest: { y: 0, scale: 1 },
    hover: reduceMotion ? { y: 0, scale: 1 } : { y: -lift, scale: lift > 4 ? 1.01 : 1 },
  };

  return (
    <motion.div
      initial="rest"
      whileHover="hover"
      variants={cardVariants}
      transition={{ duration: 0.3, ease: EASE }}
      className={`relative ${shine ? "overflow-hidden" : ""} ${className}`}
    >
      {children}
      {shine && !reduceMotion && (
        <motion.span
          aria-hidden="true"
          variants={{ rest: { x: "-130%" }, hover: { x: "130%" } }}
          transition={{ duration: 0.85, ease: EASE }}
          className="pointer-events-none absolute inset-0 z-10 skew-x-[-15deg]"
          style={{
            background:
              "linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-primary) 16%, transparent), transparent)",
            mixBlendMode: "screen",
          }}
        />
      )}
    </motion.div>
  );
}

// Variants-driven stagger pair for grids -- one `whileInView` observer on
// the container fires a cascading entrance across its children, instead of
// each grid item running its own independent `Reveal` + manually-computed
// `delay={i * 120}`.
const staggerContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};

export function StaggerGroup({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={staggerContainerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className = "" }: { children: ReactNode; className?: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={{
        hidden: reduceMotion ? { opacity: 1 } : { opacity: 0, y: 28, scale: 0.98 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: EASE } },
      }}
    >
      {children}
    </motion.div>
  );
}

// Subtle cursor-tracked 3D tilt -- the hero's "find your district" widget is
// the one card interactive enough (search input, live results) to earn a
// bespoke premium treatment beyond the generic hover-lift. Pure transform
// (rotateX/rotateY via spring-smoothed motion values), so it stays
// GPU-accelerated and never touches layout.
export function TiltCard({
  children,
  className = "",
  max = 7,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springRotateX = useSpring(rotateX, { stiffness: 220, damping: 22 });
  const springRotateY = useSpring(rotateY, { stiffness: 220, damping: 22 });

  if (reduceMotion) return <div className={className}>{children}</div>;

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    rotateY.set(px * max);
    rotateX.set(-py * max);
  };
  const handleLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ perspective: 1200 }}
      className={className}
    >
      <motion.div style={{ rotateX: springRotateX, rotateY: springRotateY, transformStyle: "preserve-3d" }}>
        {children}
      </motion.div>
    </motion.div>
  );
}

// Continuous idle bob -- distinct from HoverLift (which only moves on
// hover): this drifts a small amount forever, so the element reads as
// "floating," not "waiting to be interacted with." `delay`/`duration` are
// exposed so a group of these (e.g. a row of icon badges) can be desynced
// per-index instead of bobbing in unison, which reads as robotic.
export function FloatingElement({
  children,
  className = "",
  distance = 10,
  duration = 4,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  distance?: number;
  duration?: number;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      animate={{ y: [0, -distance, 0] }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut", delay }}
    >
      {children}
    </motion.div>
  );
}

// Drop-in decorative orb layer for any `<section>` beyond the hero --
// reuses `ParallaxOrb` (same scroll-linked drift technique) instead of a
// bespoke effect per section. Renders as an absolutely-positioned overlay
// sized to fill its `relative` parent section (`inset-0` against that
// parent is what supplies the ref's measurable box -- no extra wrapper
// needed), so a section opts in with one line: `<SectionOrbs orbs={[...]} />`
// as the first child. Deliberately still section-scoped, not a page-wide
// fixed layer -- the one global ambient background stays on `body::before`
// (see DESIGN.md); this is the same bespoke marketing-page decoration the
// hero already uses, just extended to a few more sections.
export function SectionOrbs({
  orbs,
}: {
  // `variant` is one of the color/size presets from globals.css (orb-a..e)
  // -- callers never spell out the base `.orb` class (position/blur/radius)
  // themselves, so it can't be forgotten at a call site the way a raw
  // `className` prop could be.
  orbs: { variant: "orb-a" | "orb-b" | "orb-c" | "orb-d" | "orb-e"; range?: number[]; driftX?: number[]; duration?: number }[];
}) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  return (
    <div ref={layerRef} aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
      {orbs.map((orb, i) => (
        <ParallaxOrb
          key={i}
          sectionRef={layerRef}
          className={`orb ${orb.variant}`}
          range={orb.range}
          driftX={orb.driftX}
          duration={orb.duration}
        />
      ))}
    </div>
  );
}

// Magnetic CTA -- the button subtly pulls toward the cursor as it enters
// the hit area (spring-damped, small max offset so it reads as "responsive
// weight," not a gimmick) and sweeps a light-catch highlight across on
// hover. Wraps a real Next `Link` so it stays a normal anchor for
// navigation/SEO -- only the motion is bolted on. Callers keep full control
// of visual styling via `className`; this never touches color or font.
export function MagneticCta({
  href,
  className = "",
  children,
  wrapperClassName = "",
  strength = 0.3,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  wrapperClassName?: string;
  strength?: number;
}) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLAnchorElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 300, damping: 20, mass: 0.5 });
  const springY = useSpring(y, { stiffness: 300, damping: 20, mass: 0.5 });

  const handleMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (reduceMotion || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set((e.clientX - rect.left - rect.width / 2) * strength);
    y.set((e.clientY - rect.top - rect.height / 2) * strength);
  };
  const handleLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div style={reduceMotion ? undefined : { x: springX, y: springY }} className={wrapperClassName}>
      <Link
        ref={ref}
        href={href}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        className={`relative overflow-hidden ${className}`}
      >
        {children}
        {!reduceMotion && (
          <motion.span
            aria-hidden="true"
            initial={{ x: "-130%" }}
            whileHover={{ x: "130%" }}
            transition={{ duration: 0.85, ease: EASE }}
            className="pointer-events-none absolute inset-0 skew-x-[-15deg]"
            style={{
              background:
                "linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-primary) 30%, transparent), transparent)",
              mixBlendMode: "screen",
            }}
          />
        )}
      </Link>
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
//
// Entrance choreography lives on the individual children now (each wrapped
// in its own `Reveal mode="mount"` at an increasing delay in HomePage.tsx),
// not as one block-level fade here -- that's what turns "the hero appears"
// into "the badge, then the headline, then the subhead, then the CTAs
// cascade in," which reads as considerably more deliberate for the same
// total time budget.
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
  const scrollCueOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const { t } = useTranslation();

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
        {children}
      </motion.div>

      {!reduceMotion && (
        <motion.div
          aria-hidden="true"
          style={{ opacity: scrollCueOpacity }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden sm:flex flex-col items-center gap-1.5 text-text-muted z-10"
        >
          <span className="text-[10px] font-semibold tracking-[0.2em] uppercase">{t("home.scrollCue", "Scroll")}</span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            className="w-5 h-8 rounded-full border-2 border-border-light flex items-start justify-center p-1"
          >
            <span className="w-1 h-1.5 rounded-full bg-primary" />
          </motion.div>
        </motion.div>
      )}
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
  const { t } = useTranslation();
  const big = size === "lg";
  const pad = big
    ? "py-3 px-6 text-base sm:px-8 sm:py-4.5 sm:text-lg"
    : "py-2.5 px-5 text-sm sm:px-6 sm:py-3.5";
  const iconSize = big ? 20 : 16;
  const justify = align === "start" ? "justify-center lg:justify-start" : "justify-center";

  if (session) {
    return (
      <MagneticCta
        href="/feed"
        wrapperClassName="w-full sm:w-auto"
        className={`group inline-flex items-center gap-3 w-full sm:w-auto justify-center ${
          big ? "py-3 px-6 text-base sm:px-9 sm:py-4.5 sm:text-xl" : pad
        } rounded-2xl bg-primary text-text-on-primary font-bold hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all duration-300 cursor-pointer shadow-elevated-md`}
      >
        {t("home.openFeed")}
        <ArrowRight
          size={big ? 22 : iconSize}
          className="transition-transform duration-300 group-hover:translate-x-1.5"
          aria-hidden="true"
        />
      </MagneticCta>
    );
  }

  return (
    <div className={`w-full flex flex-col sm:flex-row items-center ${justify} gap-3 sm:gap-4`}>
      <MagneticCta
        href="/auth?role=citizen"
        wrapperClassName="w-full sm:w-auto"
        className={`group inline-flex items-center gap-3 w-full sm:w-auto justify-center ${pad} rounded-2xl bg-primary text-text-on-primary font-bold hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all duration-300 cursor-pointer shadow-elevated-md`}
      >
        {t("home.citizenCta")}
        <ArrowRight
          size={iconSize}
          className="transition-transform duration-300 group-hover:translate-x-1.5"
          aria-hidden="true"
        />
      </MagneticCta>
      <MagneticCta
        href="/auth?role=politician"
        wrapperClassName="w-full sm:w-auto"
        className={`group inline-flex items-center gap-3 w-full sm:w-auto justify-center ${pad} rounded-2xl border-2 border-primary/50 bg-surface-elevated/70 text-text-main font-bold hover:bg-primary/10 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all duration-300 cursor-pointer`}
      >
        {t("home.candidateCta")}
        <ArrowRight
          size={iconSize}
          className="transition-transform duration-300 group-hover:translate-x-1.5"
          aria-hidden="true"
        />
      </MagneticCta>
    </div>
  );
}

// Continuous star rating animation -- stars fill one by one in a smooth loop.
// No scroll dependency, just smooth, engaging animation that continuously cycles.
export function ScrollRatingStars({
  sectionRef,
  politicianName,
  title,
  party,
  description,
}: {
  sectionRef: RefObject<HTMLDivElement | null>;
  politicianName: string;
  title: string;
  party: string;
  description?: string;
}) {
  const reduceMotion = useReducedMotion();

  // Button hover state
  const buttonScale = useMotionValue(1);
  const buttonY = useMotionValue(0);
  const springScale = useSpring(buttonScale, { stiffness: 300, damping: 20, mass: 0.5 });
  const springY = useSpring(buttonY, { stiffness: 300, damping: 20, mass: 0.5 });

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (reduceMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top - rect.height / 2;
    buttonY.set(y * 0.15);
  };

  const handleMouseLeave = () => {
    buttonScale.set(1);
    buttonY.set(0);
  };

  const handleMouseDown = () => {
    if (reduceMotion) return;
    buttonScale.set(0.95);
  };

  const handleMouseUp = () => {
    buttonScale.set(1);
  };

  if (reduceMotion) {
    return (
      <div className="flex flex-col items-center gap-6">
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <svg key={i} className="w-10 h-10" viewBox="0 0 24 24" fill="currentColor" style={{ color: "#FCD34D" }}>
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          ))}
        </div>
        <div className="text-center">
          <h3 className="font-bold text-lg">{politicianName}</h3>
          <p className="text-sm text-text-muted">{title}</p>
          <p className="text-xs text-accent font-semibold">{party}</p>
          {description && <p className="text-sm text-text-muted mt-3">{description}</p>}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      animate={!reduceMotion ? { y: [0, -8, 0] } : undefined}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      className="flex flex-col items-center gap-8"
    >
      {/* Stars - continuous filling animation */}
      <div className="flex gap-3 sm:gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <motion.div
            key={i}
            animate={
              !reduceMotion
                ? {
                    scale: [0.5, 1, 1, 1, 0.5],
                    y: [10, 0, 0, 0, 10],
                  }
                : undefined
            }
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.15, // Stagger each star
            }}
            className="relative"
          >
            {/* Background star (unfilled) */}
            <svg
              className="w-10 sm:w-12 h-10 sm:h-12"
              viewBox="0 0 24 24"
              fill="currentColor"
              style={{ color: "#FCD34D30" }}
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>

            {/* Filled star overlay - golden */}
            <motion.div
              className="absolute inset-0 overflow-hidden"
              animate={
                !reduceMotion
                  ? {
                      clipPath: [
                        "inset(0 100% 0 0)",
                        "inset(0 0% 0 0)",
                        "inset(0 0% 0 0)",
                        "inset(0 0% 0 0)",
                        "inset(0 100% 0 0)",
                      ],
                    }
                  : undefined
              }
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.15,
              }}
            >
              <svg
                className="w-10 sm:w-12 h-10 sm:h-12"
                viewBox="0 0 24 24"
                fill="currentColor"
                style={{ color: "#FCD34D" }}
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </motion.div>
          </motion.div>
        ))}
      </div>

      {/* Politician info */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="text-center"
      >
        <h3 className="font-display text-xl sm:text-2xl font-bold text-text-main">{politicianName}</h3>
        <p className="text-sm sm:text-base text-text-muted mt-1">{title}</p>
        <p className="text-xs sm:text-sm text-accent font-semibold mt-2">{party}</p>
      </motion.div>

      {/* Politician description - fades in smoothly */}
      {description && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-sm sm:text-base text-text-muted max-w-md text-center leading-relaxed"
        >
          {description}
        </motion.p>
      )}

      {/* Rate button with pointer interaction */}
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.6 }}
        style={!reduceMotion ? { scale: springScale, y: springY } : undefined}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        className="relative overflow-hidden px-6 sm:px-8 py-3 sm:py-4 rounded-xl bg-accent text-text-on-primary font-bold text-sm sm:text-base hover:bg-accent/90 transition-all duration-300 cursor-pointer shadow-elevated-md"
      >
        <span className="relative z-10">Submit Rating</span>
        {!reduceMotion && (
          <motion.span
            aria-hidden="true"
            initial={{ x: "-130%" }}
            whileHover={{ x: "130%" }}
            transition={{ duration: 0.85, ease: EASE }}
            className="pointer-events-none absolute inset-0 skew-x-[-15deg]"
            style={{
              background:
                "linear-gradient(90deg, transparent, color-mix(in srgb, white 30%, transparent), transparent)",
              mixBlendMode: "screen",
            }}
          />
        )}
      </motion.button>
    </motion.div>
  );
}

export { useReducedMotion };
