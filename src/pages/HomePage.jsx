import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  MapPin, Megaphone, Users, ShieldCheck, Flame, Video,
  ThumbsUp, Globe2, ArrowRight, Landmark, MessageSquare, Layers,
} from 'lucide-react';

/* Reveal-on-scroll: adds .is-visible when the element enters the viewport */
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('is-visible');
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-visible');
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function Reveal({ children, className = '', delay = 0 }) {
  const ref = useReveal();
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

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

export default function HomePage() {
  const { session } = useAuth();
  const [activeLevel, setActiveLevel] = useState(0);

  /* Cycle the boundary-level pill in the hero */
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setActiveLevel((i) => (i + 1) % BOUNDARY_LEVELS.length), 2600);
    return () => clearInterval(id);
  }, []);

  const primaryCta = session
    ? { to: '/feed', label: 'Open your feed' }
    : { to: '/auth', label: 'Join Choseno' };

  return (
    <div className="w-full overflow-x-clip">
      {/* ============ HERO ============ */}
      <section className="relative min-h-[92vh] flex items-center justify-center px-6">
        {/* Ambient orbs */}
        <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="orb orb-a" />
          <div className="orb orb-b" />
          <div className="orb orb-c" />
          {/* Dot grid */}
          <div className="absolute inset-0 hero-grid opacity-40" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="hero-item" style={{ animationDelay: '0ms' }}>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border-light bg-surface-elevated backdrop-blur-md text-sm text-text-tertiary tracking-wide">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
              </span>
              A framework for future democracy
            </span>
          </div>

          <h1 className="hero-item font-display text-5xl md:text-7xl font-bold leading-[1.05] mt-8 tracking-tight" style={{ animationDelay: '120ms' }}>
            Your voice, heard
            <br />
            <span className="text-shimmer">where you live.</span>
          </h1>

          <p className="hero-item text-lg md:text-xl text-text-muted max-w-2xl mx-auto mt-6 leading-relaxed" style={{ animationDelay: '240ms' }}>
            Choseno connects citizens and politicians inside real electoral
            boundaries. Local issues, anonymous voices, honest support signals —
            democracy at the resolution of your street.
          </p>

          {/* Cycling boundary pill */}
          <div className="hero-item mt-8 flex items-center justify-center gap-3 text-sm text-text-muted" style={{ animationDelay: '360ms' }}>
            <span>Conversations scoped to</span>
            <span
              key={activeLevel}
              className="level-swap inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary/15 border border-primary/25 text-primary font-medium"
            >
              <MapPin size={14} aria-hidden="true" />
              {BOUNDARY_LEVELS[activeLevel]}
            </span>
          </div>

          <div className="hero-item mt-10 flex flex-col sm:flex-row items-center justify-center gap-4" style={{ animationDelay: '480ms' }}>
            <Link
              to={primaryCta.to}
              className="group inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-primary text-text-darker font-semibold text-lg hover:bg-primary-hover transition-all duration-300 hover:shadow-[0_0_45px_rgba(233,235,158,0.35)] hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary cursor-pointer"
            >
              {primaryCta.label}
              <ArrowRight size={20} className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
            </Link>
            <Link
              to="/explore"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl border border-border-light bg-surface-elevated backdrop-blur-md text-text-secondary font-medium text-lg hover:bg-surface-hover hover:border-primary/30 transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary cursor-pointer"
            >
              <Globe2 size={20} aria-hidden="true" />
              Explore boundaries
            </Link>
          </div>
        </div>

        {/* Scroll hint */}
        <div aria-hidden="true" className="absolute bottom-8 left-1/2 -translate-x-1/2 hero-item" style={{ animationDelay: '900ms' }}>
          <div className="w-6 h-10 rounded-full border-2 border-border-light flex justify-center pt-2">
            <div className="w-1 h-2.5 rounded-full bg-text-muted animate-scroll-dot" />
          </div>
        </div>
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
                <div className="glass-card p-8 h-full group hover:border-primary/25 transition-all duration-300 hover:-translate-y-1.5">
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
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ ROLES ============ */}
      <section className="relative py-28 px-6">
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
          <div className="orb orb-d" />
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
                <div className={`glass-card p-8 h-full group transition-all duration-500 hover:-translate-y-1.5 ${role.ring}`}>
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
                </div>
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
                <div className="group p-7 rounded-3xl border border-border-light bg-surface/40 backdrop-blur-sm h-full hover:bg-surface-elevated hover:border-primary/25 transition-all duration-300 hover:-translate-y-1">
                  <div className="w-11 h-11 rounded-xl bg-accent/15 border border-accent/25 text-accent flex items-center justify-center mb-5 group-hover:rotate-6 group-hover:scale-110 transition-transform duration-300">
                    <feature.icon size={20} aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-text-muted text-[0.95rem] leading-relaxed">{feature.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="relative py-32 px-6">
        <div className="max-w-4xl mx-auto">
          <Reveal>
            <div className="relative glass-card p-12 md:p-16 text-center overflow-hidden">
              <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
                <div className="orb orb-e" />
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
                  <Link
                    to={primaryCta.to}
                    className="group inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-primary text-text-darker font-semibold text-lg hover:bg-primary-hover transition-all duration-300 hover:shadow-[0_0_45px_rgba(233,235,158,0.35)] hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary cursor-pointer"
                  >
                    {primaryCta.label}
                    <ArrowRight size={20} className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t border-border-light py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-text-muted">
          <span className="font-display font-bold text-lg bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
            Choseno
          </span>
          <span>A framework for future democracy.</span>
        </div>
      </footer>
    </div>
  );
}
