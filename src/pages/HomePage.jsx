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
    title: 'Verify your district',
    text: 'Share your location once. PostGIS automatically matches your coordinates with official electoral boundaries — no address forms, zero identity leakage.',
  },
  {
    icon: Layers,
    title: 'Explore local feeds',
    text: 'Access civic conversations scoped strictly to where you live. Seamlessly switch between polling district, municipal, federal, and international levels.',
  },
  {
    icon: Megaphone,
    title: 'Signal constituent support',
    text: 'Participate anonymously and endorse key local issues. Representatives receive verified constituent signals rather than out-of-district noise.',
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
    points: [
      'Access local civic feeds locked to your electoral boundary',
      'Engage in constituent discussions with local representatives',
      'Upvote and endorse issues using rotatable Ghost IDs',
      'Burn your Ghost ID anytime to un-link all future posts',
    ],
  },
  {
    icon: Landmark,
    label: 'Representatives',
    accent: 'text-primary',
    points: [
      'Publish video position statements directly on key topics',
      'Gather verified "I Support" endorsements from constituents',
      'Target messages directly to the districts you represent',
      'Maintain an official candidate wall for public constituent review',
    ],
  },
  {
    icon: ShieldCheck,
    label: 'Admins',
    accent: 'text-text-muted',
    points: [
      'Import electoral geometries as GeoJSON or Shapefiles',
      'Manage multi-jurisdictional boundary hierarchy maps',
      'Maintain district accuracy as electoral boundaries shift',
      'Verify PostGIS spatial matching for constituent location privacy',
    ],
  },
];

const FEATURES = [
  {
    icon: Flame,
    title: 'Rotatable Ghost IDs',
    text: 'Participate freely. Posts use a privacy-preserving ghost UUID — burn it anytime for a completely fresh identity.',
  },
  {
    icon: Video,
    title: 'Direct video statements',
    text: 'Representatives post video messages in-browser, ensuring position statements remain authentic and unedited.',
  },
  {
    icon: ThumbsUp,
    title: 'Constituent endorsements',
    text: 'One verified constituent, one endorsement. Prevents bot farms, brigading, and out-of-district manipulation.',
  },
  {
    icon: Globe2,
    title: '4-Tier boundary scoping',
    text: 'From your immediate polling district to federal and international levels, debate happens where it belongs.',
  },
  {
    icon: MessageSquare,
    title: 'Hyper-local threads',
    text: 'Discussion threads remain scoped to your actual district, connecting you with verified local neighbours.',
  },
  {
    icon: MapPin,
    title: 'PostGIS boundary matching',
    text: 'Feeds use official spatial geometry matched to your coordinates with exact point-in-polygon precision.',
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
        </div>

        <motion.div
          style={reduceMotion ? undefined : { y: heroContentY, opacity: heroContentOpacity, scale: heroContentScale }}
          className="relative z-10 max-w-5xl mx-auto text-center"
        >
          <motion.div initial={reduceMotion ? false : 'hidden'} animate="visible" variants={heroStagger}>
            <motion.div variants={heroItem}>
              <span className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full border border-accent/40 bg-surface-elevated/90 backdrop-blur-xl text-xs font-bold tracking-wide text-accent">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent" />
                </span>
                A framework for future democracy
              </span>
            </motion.div>

            <motion.h1 variants={heroItem} className="font-display text-6xl sm:text-7xl md:text-8xl font-extrabold leading-[1.02] mt-8 tracking-tight drop-shadow-2xl">
              Your voice, heard
              <br />
              <span className="text-primary">where you live.</span>
            </motion.h1>

            <motion.p variants={heroItem} className="text-xl md:text-2xl text-text-main/90 font-medium max-w-3xl mx-auto mt-7 leading-relaxed">
              Choseno connects citizens and politicians inside real electoral
              boundaries. Local issues, anonymous voices, honest support signals —
              democracy at the resolution of your street.
            </motion.p>

            {/* Cycling boundary pill */}
            <motion.div variants={heroItem} className="mt-9 flex items-center justify-center gap-3 text-base text-text-muted">
              <span className="font-medium text-text-main/80">Conversations scoped to</span>
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
                    {BOUNDARY_LEVELS[activeLevel]}
                  </motion.span>
                </AnimatePresence>
              </span>
            </motion.div>

            <motion.div variants={heroItem} className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
              <MotionLink
                to={primaryCta.to}
                whileHover={reduceMotion ? undefined : { scale: 1.03, boxShadow: 'var(--shadow-elevated-lg)' }}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="group inline-flex items-center gap-3 px-9 py-4.5 rounded-2xl bg-primary text-text-on-primary font-bold text-xl hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all duration-300 cursor-pointer shadow-elevated-md"
              >
                {primaryCta.label}
                <ArrowRight size={22} className="transition-transform duration-300 group-hover:translate-x-1.5" aria-hidden="true" />
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
            <h2 className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight">
              From coordinates to community
            </h2>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-7">
            {STEPS.map((step, i) => (
              <Reveal key={step.title} delay={i * 120}>
                <motion.div
                  whileHover={reduceMotion ? undefined : { y: -8, scale: 1.01 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="glass-card p-8 h-full group hover:border-primary/40 hover:shadow-elevated-lg transition-all duration-300 relative overflow-hidden"
                >
                  <span className="font-display text-7xl font-black text-primary/20 group-hover:text-primary/35 transition-colors duration-500 select-none leading-none">
                    0{i + 1}
                  </span>
                  <h3 className="mt-5 text-2xl font-bold tracking-tight flex items-center gap-2.5">
                    <step.icon size={20} className="text-primary" aria-hidden="true" />
                    {step.title}
                  </h3>
                  <p className="mt-3 text-text-muted text-base leading-relaxed">{step.text}</p>
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
              <h2 className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight">
                Every district,
                <br />
                <span className="text-primary">one feed away.</span>
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
                  className="flex items-center justify-between gap-4 px-5 md:px-6 py-4.5 border-b border-border-light/50 last:border-b-0 hover:bg-surface-hover/40 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-accent tracking-wide mb-1">{seat.election} · Nominations open</p>
                    <p className="font-extrabold text-lg text-text-main flex items-center gap-2 flex-wrap">
                      {seat.role}
                      <span className="text-sm font-medium text-text-muted flex items-center gap-1.5 bg-surface/60 px-2.5 py-0.5 rounded-lg border border-border-light">
                        <MapPin size={13} className="text-accent" /> {seat.name}
                      </span>
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-xl shrink-0">{seat.candidates}</span>
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
            <h2 className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight">
              Built for everyone in the room
            </h2>
            <p className="text-text-main/80 text-xl max-w-2xl mx-auto mt-4 font-medium">
              Citizens speak, representatives answer, admins keep the map honest.
            </p>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-7">
            {ROLES.map((role, i) => (
              <Reveal key={role.label} delay={i * 120}>
                <motion.div
                  whileHover={reduceMotion ? undefined : { y: -8, scale: 1.01 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="glass-card p-8 h-full group transition-all duration-500 border border-border-light hover:border-primary/40 hover:shadow-elevated-lg"
                >
                  <div className="flex items-center gap-3 mb-5">
                    <role.icon size={24} className={`${role.accent} group-hover:scale-110 transition-transform duration-300`} aria-hidden="true" />
                    <h3 className="font-display text-3xl font-extrabold tracking-tight">{role.label}</h3>
                  </div>
                  <ul className="space-y-3.5">
                    {role.points.map((point) => (
                      <li key={point} className="flex items-start gap-3 text-text-muted text-[0.98rem] leading-relaxed">
                        <span className={`mt-2.5 w-2 h-2 rounded-full shrink-0 bg-current ${role.accent}`} aria-hidden="true" />
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
            <h2 className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight">
              Democracy needs better plumbing
            </h2>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <Reveal key={feature.title} delay={(i % 3) * 100}>
                <motion.div
                  whileHover={reduceMotion ? undefined : { y: -6, scale: 1.01 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="group p-8 rounded-3xl border border-border-light bg-surface/60 backdrop-blur-md h-full hover:bg-surface-elevated hover:border-primary/40 hover:shadow-elevated-md transition-all duration-300"
                >
                  <div className="w-12 h-12 rounded-2xl bg-accent/20 border border-accent/35 text-accent flex items-center justify-center mb-6 group-hover:rotate-6 group-hover:scale-110 transition-transform duration-300">
                    <feature.icon size={22} aria-hidden="true" />
                  </div>
                  <h3 className="text-xl font-bold mb-2.5 tracking-tight">{feature.title}</h3>
                  <p className="text-text-muted text-base leading-relaxed">{feature.text}</p>
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
            <div className="relative glass-card p-12 md:p-16 text-center overflow-hidden border border-primary/20 shadow-elevated-xl">
              <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
                <ParallaxOrb className="orb orb-e" sectionRef={ctaRef} range={[-90, 90]} driftX={[0, -25, 25, 0]} duration={19} />
              </div>
              <div className="relative">
                <h2 className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight drop-shadow-lg">
                  The future of democracy
                  <br />
                  <span className="text-primary">starts in your district.</span>
                </h2>
                <p className="text-text-main/80 text-xl max-w-xl mx-auto mt-6 font-medium leading-relaxed">
                  Join your constituency, follow the issues that touch your life,
                  and make your support count.
                </p>
                <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                  <MotionLink
                    to={primaryCta.to}
                    whileHover={reduceMotion ? undefined : { scale: 1.04, boxShadow: 'var(--shadow-elevated-xl)' }}
                    whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className="group inline-flex items-center gap-3 px-9 py-4.5 rounded-2xl bg-primary text-text-on-primary font-extrabold text-xl hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all duration-300 cursor-pointer shadow-elevated-md"
                  >
                    {primaryCta.label}
                    <ArrowRight size={22} className="transition-transform duration-300 group-hover:translate-x-1.5" aria-hidden="true" />
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
          <span className="font-display font-extrabold text-xl text-primary">
            Choseno
          </span>
          <span>A framework for future democracy.</span>
        </Reveal>
      </footer>
    </div>
  );
}
