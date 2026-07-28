import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { ContainerScroll } from '../components/ui';
import {
  MapPin, Megaphone, Users, ShieldCheck, Flame, Video,
  ThumbsUp, Globe2, ArrowRight, Landmark, MessageSquare, Layers,
} from 'lucide-react';

const EASE = [0.22, 1, 0.36, 1];
const MotionLink = motion.create(Link);

/* Scroll-triggered reveal — replaces the old IntersectionObserver hook with
   framer-motion's built-in viewport tracking. */
function Reveal({ children, className = '', delay = 0 }) {
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

const heroStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};

const heroItem = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
};

const BOUNDARY_LEVELS = ['Polling District', 'Federal Area', 'Country', 'International'];

const STEPS = [
  {
    icon: MapPin,
    title: 'Get located',
    text: 'Share your location once. We match it against official electoral boundaries to find your polling district and federal area — no address forms, no guesswork.',
  },
  {
    icon: Layers,
    title: 'See your feeds',
    text: 'Your newsfeed is scoped to where you actually live. Flip between polling district, federal, country, and international conversations in one tap.',
  },
  {
    icon: Megaphone,
    title: 'Make yourself heard',
    text: 'React, comment, and support the issues that matter. Politicians see real signals from real constituents — not noise from everywhere else.',
  },
];

const MOCK_SEATS = [
  { role: 'MLA', name: 'Surrey South', election: '2028 Provincial', candidates: '3 candidates' },
  { role: 'MP', name: 'Vancouver-Fraserview', election: '2028 Federal', candidates: '2 candidates' },
  { role: 'City Councillor', name: 'District 4', election: 'Municipal', candidates: '5 candidates' },
];

const ROLES = [
  {
    icon: Users,
    label: 'Citizens',
    accent: 'text-accent',
    ring: 'group-hover:shadow-[0_0_40px_rgba(172,193,150,0.18)]',
    points: [
      'Read a newsfeed scoped to your own constituency',
      'Comment on issues raised by your representatives',
      'Vote posts up or down under an anonymous ghost identity',
      'Burn your ghost ID anytime for a clean slate',
    ],
  },
  {
    icon: Landmark,
    label: 'Politicians',
    accent: 'text-primary',
    ring: 'group-hover:shadow-[0_0_40px_rgba(233,235,158,0.18)]',
    points: [
      'Post video statements about local issues',
      'Collect "I Support" endorsements from constituents',
      'Reach exactly the districts you represent',
      'Run a public wall citizens can visit and share',
    ],
  },
  {
    icon: ShieldCheck,
    label: 'Admins',
    accent: 'text-text-muted',
    ring: 'group-hover:shadow-[0_0_40px_rgba(121,148,150,0.18)]',
    points: [
      'Upload electoral boundaries as GeoJSON or shapefiles',
      'Manage boundary types across multiple countries',
      'Keep constituency maps accurate as districts change',
      'Every user is matched against the maps you maintain',
    ],
  },
];

const FEATURES = [
  {
    icon: Flame,
    title: 'Ghost identities',
    text: 'Speak freely. Posts are tied to a rotating anonymous ID, never your name — and you can burn it whenever you want.',
  },
  {
    icon: Video,
    title: 'Video-first issues',
    text: 'Politicians record video statements right in the browser, so positions are heard in their own words.',
  },
  {
    icon: ThumbsUp,
    title: 'I Support',
    text: 'A single, honest endorsement signal. One ghost, one vote — no bots, no brigading from outside the district.',
  },
  {
    icon: Globe2,
    title: 'Four levels of debate',
    text: 'From your polling district to the international stage, every conversation happens at the level it belongs to.',
  },
  {
    icon: MessageSquare,
    title: 'Constituency threads',
    text: 'Comments stay local. The people replying to you are your actual neighbours, not the whole internet.',
  },
  {
    icon: MapPin,
    title: 'Real boundary data',
    text: 'Feeds are drawn from official electoral geometry, matched to your coordinates with point-in-polygon precision.',
  },
];

/* A background orb whose vertical position is tied to how far its section
   has scrolled through the viewport, plus a slow idle drift — two
   independent transform axes composed by framer-motion into one layer. */
function ParallaxOrb({ className, sectionRef, range = [-140, 140], scrollOffset = ['start end', 'end start'], driftX = [0, 40, -20, 0], duration = 18 }) {
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: scrollOffset });
  const y = useTransform(scrollYProgress, [0, 1], range);

  if (reduceMotion) return <div aria-hidden="true" className={className} />;
  return (
    <motion.div
      aria-hidden="true"
      className={className}
      style={{ y }}
      animate={{ x: driftX, scale: [1, 1.08, 0.95, 1] }}
      transition={{ duration, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

export default function HomePage() {
  const { session } = useAuth();
  const [activeLevel, setActiveLevel] = useState(0);
  const reduceMotion = useReducedMotion();

  const heroRef = useRef(null);
  const rolesRef = useRef(null);
  const ctaRef = useRef(null);

  /* Hero parallax: as the hero scrolls out of view, its content recedes
     (fades, shrinks, drifts down) slower than the page itself — the
     foreground/background separation that reads as "parallax". */
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroContentY = useTransform(heroProgress, [0, 1], [0, 110]);
  const heroContentOpacity = useTransform(heroProgress, [0, 0.75], [1, 0]);
  const heroContentScale = useTransform(heroProgress, [0, 1], [1, 0.92]);
  const heroGridY = useTransform(heroProgress, [0, 1], [0, 70]);

  /* Cycle the boundary-level pill in the hero */
  useEffect(() => {
    if (reduceMotion) return;
    const id = setInterval(() => setActiveLevel((i) => (i + 1) % BOUNDARY_LEVELS.length), 2600);
    return () => clearInterval(id);
  }, [reduceMotion]);

  const primaryCta = session
    ? { to: '/feed', label: 'Open your feed' }
    : { to: '/auth', label: 'Join Choseno' };

  return (
    <div className="w-full overflow-x-clip">
      {/* ============ HERO ============ */}
      <section ref={heroRef} className="relative min-h-[92vh] flex items-center justify-center px-6 overflow-hidden">
        {/* Parallax background layer */}
        <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
          <ParallaxOrb className="orb orb-a" sectionRef={heroRef} range={[0, -180]} scrollOffset={['start start', 'end start']} driftX={[0, 40, -20, 0]} duration={18} />
          <ParallaxOrb className="orb orb-b" sectionRef={heroRef} range={[0, 220]} scrollOffset={['start start', 'end start']} driftX={[0, -35, 25, 0]} duration={22} />
          <ParallaxOrb className="orb orb-c" sectionRef={heroRef} range={[0, -120]} scrollOffset={['start start', 'end start']} driftX={[0, 30, -30, 0]} duration={16} />
          {/* Dot grid, drifting at its own depth */}
          <motion.div
            className="absolute inset-0 hero-grid opacity-40"
            style={reduceMotion ? undefined : { y: heroGridY }}
          />
        </div>

        <motion.div
          style={reduceMotion ? undefined : { y: heroContentY, opacity: heroContentOpacity, scale: heroContentScale }}
          className="relative z-10 max-w-4xl mx-auto text-center"
        >
          <motion.div initial={reduceMotion ? false : 'hidden'} animate="visible" variants={heroStagger}>
            <motion.div variants={heroItem}>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border-light bg-surface-elevated backdrop-blur-md text-sm text-text-tertiary tracking-wide">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                </span>
                A framework for future democracy
              </span>
            </motion.div>

            <motion.h1 variants={heroItem} className="font-display text-5xl md:text-7xl font-bold leading-[1.05] mt-8 tracking-tight">
              Your voice, heard
              <br />
              <span className="text-shimmer">where you live.</span>
            </motion.h1>

            <motion.p variants={heroItem} className="text-lg md:text-xl text-text-muted max-w-2xl mx-auto mt-6 leading-relaxed">
              Choseno connects citizens and politicians inside real electoral
              boundaries. Local issues, anonymous voices, honest support signals —
              democracy at the resolution of your street.
            </motion.p>

            {/* Cycling boundary pill */}
            <motion.div variants={heroItem} className="mt-8 flex items-center justify-center gap-3 text-sm text-text-muted">
              <span>Conversations scoped to</span>
              <span className="relative inline-grid">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={activeLevel}
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.45, ease: EASE }}
                    className="col-start-1 row-start-1 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary/15 border border-primary/25 text-primary font-medium"
                  >
                    <MapPin size={14} aria-hidden="true" />
                    {BOUNDARY_LEVELS[activeLevel]}
                  </motion.span>
                </AnimatePresence>
              </span>
            </motion.div>

            <motion.div variants={heroItem} className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <MotionLink
                to={primaryCta.to}
                whileHover={reduceMotion ? undefined : { y: -3, boxShadow: '0 0 45px rgba(233,235,158,0.35)' }}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="group inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-primary text-text-darker font-semibold text-lg hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary cursor-pointer"
              >
                {primaryCta.label}
                <ArrowRight size={20} className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
              </MotionLink>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          aria-hidden="true"
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.9, ease: EASE }}
        >
          <div className="w-6 h-10 rounded-full border-2 border-border-light flex justify-center pt-2">
            <motion.div
              className="w-1 h-2.5 rounded-full bg-text-muted"
              animate={reduceMotion ? undefined : { opacity: [1, 0.3, 1], y: [0, 8, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        </motion.div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section className="relative py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-16">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent mb-3">How it works</p>
            <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight">
              From coordinates to community
            </h2>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6">
            {STEPS.map((step, i) => (
              <Reveal key={step.title} delay={i * 120}>
                <motion.div
                  whileHover={reduceMotion ? undefined : { y: -6 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="glass-card p-8 h-full group hover:border-primary/25 transition-colors duration-300"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-300">
                      <step.icon size={22} aria-hidden="true" />
                    </div>
                    <span className="font-display text-5xl font-bold text-white/5 group-hover:text-primary/15 transition-colors duration-500">
                      0{i + 1}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                  <p className="text-text-muted leading-relaxed">{step.text}</p>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PRODUCT PREVIEW ============ */}
      <section className="relative px-6">
        <ContainerScroll
          titleComponent={
            <>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent mb-3">See it in action</p>
              <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight">
                Every district,
                <br />
                <span className="text-shimmer">one feed away.</span>
              </h2>
            </>
          }
        >
          <div className="h-full w-full flex flex-col" aria-hidden="true">
            <div className="flex items-center gap-2 px-4 md:px-6 py-3 border-b border-border-light/40 bg-surface-elevated/60 shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-danger/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-primary/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-accent/70" />
              <span className="ml-3 text-[11px] text-text-muted font-mono truncate">choseno.app/elections</span>
            </div>
            <div className="flex-1 overflow-hidden p-4 md:p-8 space-y-3">
              {MOCK_SEATS.map((seat) => (
                <div
                  key={seat.name}
                  className="flex items-center justify-between gap-4 px-4 md:px-5 py-4 rounded-2xl border border-border-light bg-surface-hover/40"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] text-text-muted mb-1">{seat.election} · Nominations open</p>
                    <p className="font-bold text-text-main flex items-center gap-2 flex-wrap">
                      {seat.role}
                      <span className="text-sm font-normal text-text-muted flex items-center gap-1">
                        <MapPin size={12} className="text-accent" /> {seat.name}
                      </span>
                    </p>
                  </div>
                  <span className="text-xs text-text-muted shrink-0">{seat.candidates}</span>
                </div>
              ))}
            </div>
          </div>
        </ContainerScroll>
      </section>

      {/* ============ ROLES ============ */}
      <section ref={rolesRef} className="relative py-28 px-6 overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
          <ParallaxOrb className="orb orb-d" sectionRef={rolesRef} range={[-130, 130]} driftX={[0, 30, -30, 0]} duration={20} />
        </div>
        <div className="relative max-w-6xl mx-auto">
          <Reveal className="text-center mb-16">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent mb-3">Three roles, one platform</p>
            <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight">
              Built for everyone in the room
            </h2>
            <p className="text-text-muted text-lg max-w-2xl mx-auto mt-4">
              Citizens speak, politicians answer, admins keep the map honest.
            </p>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6">
            {ROLES.map((role, i) => (
              <Reveal key={role.label} delay={i * 120}>
                <motion.div
                  whileHover={reduceMotion ? undefined : { y: -6 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className={`glass-card p-8 h-full group transition-shadow duration-500 ${role.ring}`}
                >
                  <div className={`w-14 h-14 rounded-2xl bg-surface-hover border border-border-light flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 ${role.accent}`}>
                    <role.icon size={26} aria-hidden="true" />
                  </div>
                  <h3 className="font-display text-2xl font-bold mb-5">{role.label}</h3>
                  <ul className="space-y-3">
                    {role.points.map((point) => (
                      <li key={point} className="flex items-start gap-3 text-text-muted leading-relaxed">
                        <span className={`mt-2 w-1.5 h-1.5 rounded-full shrink-0 bg-current ${role.accent}`} aria-hidden="true" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section className="relative py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-16">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent mb-3">Why Choseno</p>
            <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight">
              Democracy needs better plumbing
            </h2>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((feature, i) => (
              <Reveal key={feature.title} delay={(i % 3) * 100}>
                <motion.div
                  whileHover={reduceMotion ? undefined : { y: -4 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="group p-7 rounded-3xl border border-border-light bg-surface/40 backdrop-blur-sm h-full hover:bg-surface-elevated hover:border-primary/25 transition-colors duration-300"
                >
                  <div className="w-11 h-11 rounded-xl bg-accent/15 border border-accent/25 text-accent flex items-center justify-center mb-5 group-hover:rotate-6 group-hover:scale-110 transition-transform duration-300">
                    <feature.icon size={20} aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-text-muted text-[0.95rem] leading-relaxed">{feature.text}</p>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section ref={ctaRef} className="relative py-32 px-6 overflow-hidden">
        <div className="max-w-4xl mx-auto">
          <Reveal>
            <div className="relative glass-card p-12 md:p-16 text-center overflow-hidden">
              <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
                <ParallaxOrb className="orb orb-e" sectionRef={ctaRef} range={[-90, 90]} driftX={[0, -25, 25, 0]} duration={19} />
              </div>
              <div className="relative">
                <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight leading-tight">
                  The future of democracy
                  <br />
                  <span className="text-shimmer">starts in your district.</span>
                </h2>
                <p className="text-text-muted text-lg max-w-xl mx-auto mt-5">
                  Join your constituency, follow the issues that touch your life,
                  and make your support count.
                </p>
                <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4">
                  <MotionLink
                    to={primaryCta.to}
                    whileHover={reduceMotion ? undefined : { y: -3, boxShadow: '0 0 45px rgba(233,235,158,0.35)' }}
                    whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className="group inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-primary text-text-darker font-semibold text-lg hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary cursor-pointer"
                  >
                    {primaryCta.label}
                    <ArrowRight size={20} className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
                  </MotionLink>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t border-border-light py-10 px-6">
        <Reveal className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-text-muted">
          <span className="font-display font-bold text-lg bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
            Choseno
          </span>
          <span>A framework for future democracy.</span>
        </Reveal>
      </footer>
    </div>
  );
}
