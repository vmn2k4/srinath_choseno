"use client";

import { Quote } from "lucide-react";
import { Card } from "@/components/primitives";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/features/home/HomeMotion";
import { useTranslation } from "@/contexts/LanguageContext";

// Real feedback from early members, lightly reworded. Deliberately anonymous:
// no invented names, locations or star ratings, and the first quote keeps its
// honest "the platform is still new" line -- credibility matters more here than
// a spotless wall of praise.
const QUOTE_KEYS = ["q1", "q2", "q3"] as const;

export default function HomeMemberReviews() {
  const { t } = useTranslation();
  return (
    <section className="relative py-16 sm:py-24 px-4 sm:px-6" aria-labelledby="home-reviews-title">
      <div className="max-w-6xl mx-auto">
        <Reveal className="text-center mb-10 sm:mb-14">
          <p className="text-xs sm:text-sm font-bold uppercase tracking-widest text-primary">
            {t("home.social.reviews.eyebrow")}
          </p>
          <h2
            id="home-reviews-title"
            className="mt-3 font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-balance"
          >
            {t("home.social.reviews.title")}
          </h2>
        </Reveal>

        <StaggerGroup className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {QUOTE_KEYS.map((key) => (
            <StaggerItem key={key}>
              <Card as="figure" variant="default" padding="md" className="h-full flex flex-col">
                <Quote className="w-7 h-7 text-primary/60 shrink-0" aria-hidden="true" />
                <blockquote className="mt-3 flex-1 text-base sm:text-lg leading-relaxed text-text-main">
                  {t(`home.social.reviews.${key}`)}
                </blockquote>
                <figcaption className="mt-5 text-sm font-bold text-text-secondary">
                  {t("home.social.reviews.who")}
                </figcaption>
              </Card>
            </StaggerItem>
          ))}
        </StaggerGroup>

        <p className="mt-6 text-center text-xs text-text-muted">{t("home.social.reviews.note")}</p>
      </div>
    </section>
  );
}
