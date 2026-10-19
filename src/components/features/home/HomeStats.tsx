"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";
import { Globe2, Landmark, MapPin, Users, type LucideIcon } from "lucide-react";
import { Card } from "@/components/primitives";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/features/home/HomeMotion";
import { useTranslation } from "@/contexts/LanguageContext";
import { SITE_STATS } from "@/lib/constants/siteStats";

// Social-proof strip. Counts up once when scrolled into view (instantly under
// reduced motion). Numbers come from siteStats.ts and are rounded down, with a
// trailing "+", so the claim is always at or below the real figure.

function CountUp({ to, plus = true }: { to: number; plus?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(reduceMotion ? to : 0);

  useEffect(() => {
    if (!inView || reduceMotion) return;
    const controls = animate(0, to, { duration: 1.6, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setValue(Math.round(v)) });
    return () => controls.stop();
  }, [inView, reduceMotion, to]);

  // Final value is always what screen readers / no-JS get.
  return (
    <span ref={ref} aria-label={`${to.toLocaleString("en-US")}${plus ? "+" : ""}`}>
      <span aria-hidden="true">
        {(inView || reduceMotion ? value : 0).toLocaleString("en-US")}
        {plus ? "+" : ""}
      </span>
    </span>
  );
}

export default function HomeStats() {
  const { t } = useTranslation();
  const stats: Array<{ icon: LucideIcon; value: number; plus: boolean; label: string }> = [
    { icon: Users, value: SITE_STATS.visitors, plus: true, label: t("home.social.stats.visitors") },
    { icon: MapPin, value: SITE_STATS.boundaries, plus: true, label: t("home.social.stats.boundaries") },
    { icon: Landmark, value: SITE_STATS.politicians, plus: true, label: t("home.social.stats.politicians") },
    { icon: Globe2, value: SITE_STATS.countries, plus: false, label: t("home.social.stats.countries") },
  ];

  return (
    <section className="relative px-4 sm:px-6 py-10 sm:py-14" aria-labelledby="home-stats-title">
      <div className="max-w-6xl mx-auto">
        <Reveal className="text-center mb-6 sm:mb-8">
          <h2 id="home-stats-title" className="text-xs sm:text-sm font-bold uppercase tracking-widest text-primary">
            {t("home.social.stats.title")}
          </h2>
        </Reveal>
        <StaggerGroup className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-5">
          {stats.map((s) => (
            <StaggerItem key={s.label}>
              <Card variant="default" padding="md" className="h-full text-center">
                <s.icon size={20} className="mx-auto text-primary" aria-hidden="true" />
                <p className="mt-2 font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-text-main">
                  <CountUp to={s.value} plus={s.plus} />
                </p>
                <p className="mt-1 text-xs sm:text-sm font-semibold text-text-muted leading-snug">{s.label}</p>
              </Card>
            </StaggerItem>
          ))}
        </StaggerGroup>
        <p className="mt-4 text-center text-xs text-text-muted">{t("home.social.stats.note")}</p>
      </div>
    </section>
  );
}
