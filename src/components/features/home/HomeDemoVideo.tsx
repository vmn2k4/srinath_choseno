"use client";

import { useState } from "react";
import { Play, X, Compass } from "lucide-react";
import { Reveal, SectionOrbs } from "@/components/features/home/HomeMotion";
import { useTranslation } from "@/contexts/LanguageContext";

const YOUTUBE_VIDEO_ID = "WJIpU9Cyoho";

export default function HomeDemoVideo() {
  const { t } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <section className="relative py-16 sm:py-24 px-4 sm:px-6 overflow-hidden" aria-label="Product Demo">
      <SectionOrbs
        orbs={[
          { variant: "orb-a", range: [-100, 120], driftX: [0, 35, -20, 0], duration: 22 },
          { variant: "orb-b", range: [110, -90], driftX: [0, -30, 25, 0], duration: 26 },
        ]}
      />

      <div className="relative max-w-5xl mx-auto text-center">
        {/* Section Header */}
        <Reveal>
          {/* Top Badge Icon */}
          <div className="flex justify-center mb-4 sm:mb-5">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Compass className="w-6 h-6 animate-pulse" aria-hidden="true" />
            </div>
          </div>

          {/* Heading */}
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-text-main">
            {t("home.demo.title", "Why Choseno?")}
          </h2>

          {/* Quote in theme primary/accent color */}
          <p className="mt-3 sm:mt-4 text-base sm:text-lg md:text-xl font-bold text-primary tracking-wide">
            {t(
              "home.demo.quote",
              "\"Built for everyday citizens — powered for real democracy.\""
            )}
          </p>

          {/* Body Lines */}
          <div className="mt-4 sm:mt-5 max-w-2xl mx-auto space-y-1.5">
            <p className="text-sm sm:text-base md:text-lg text-text-muted font-medium leading-relaxed">
              {t(
                "home.demo.line1",
                "Forget party loyalty and algorithmic echo chambers. Choseno gives you independent, hyperlocal tools to evaluate candidates and hold elected officials accountable."
              )}
            </p>
            <p className="text-sm sm:text-base md:text-lg text-text-main font-semibold leading-relaxed">
              {t(
                "home.demo.line2",
                "Everything you need to make your voice heard — 100% free and anonymous."
              )}
            </p>
          </div>
        </Reveal>

        {/* Video Card Container */}
        <Reveal delay={120} className="mt-10 sm:mt-14">
          <div className="relative mx-auto w-full glass-card elevation-3 p-1.5 sm:p-2.5 transition-all duration-300">
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-surface border border-border-light/40 shadow-2xl">
              {isPlaying ? (
                <div className="relative w-full h-full">
                  <iframe
                    className="w-full h-full border-0"
                    src={`https://www.youtube-nocookie.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&rel=0&modestbranding=1`}
                    title="Choseno Product Demo"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                  <button
                    onClick={() => setIsPlaying(false)}
                    className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-surface-elevated/90 hover:bg-surface-active text-text-main text-xs font-semibold backdrop-blur-md border border-border-light transition-colors shadow-lg cursor-pointer"
                    aria-label="Close video preview"
                  >
                    <X size={14} />
                    <span>Close</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsPlaying(true)}
                  className="group relative w-full h-full flex flex-col items-center justify-center p-6 text-center cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label="Play Choseno product demo video"
                >
                  {/* Theme-derived ambient gradient backdrop */}
                  <div
                    className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-105"
                    style={{
                      background:
                        "radial-gradient(ellipse at 80% 30%, color-mix(in srgb, var(--color-primary) 18%, transparent) 0%, transparent 70%), radial-gradient(ellipse at 20% 70%, color-mix(in srgb, var(--color-accent) 22%, transparent) 0%, transparent 75%), var(--color-surface)",
                    }}
                  />

                  {/* Surface layer subtle shading */}
                  <div className="absolute inset-0 bg-gradient-to-t from-surface/70 via-transparent to-surface/40 pointer-events-none" />

                  {/* Content Container */}
                  <div className="relative z-10 flex flex-col items-center justify-center max-w-lg mx-auto">
                    {/* Brand Pill */}
                    <div className="mb-4 sm:mb-6 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-surface-elevated/90 border border-border-light text-text-main shadow-md elevation-1">
                      <div className="w-5 h-5 rounded-lg bg-primary text-text-on-primary font-black flex items-center justify-center text-xs shadow-sm">
                        C
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-text-main tracking-wide">
                        Choseno
                      </span>
                    </div>

                    {/* Play Button */}
                    <div className="relative my-2 sm:my-3">
                      {/* Ambient Pulse Ring */}
                      <div className="absolute -inset-3 rounded-full bg-primary/20 blur-md group-hover:bg-primary/35 transition-all duration-500 animate-pulse" />
                      
                      {/* Theme-colored Play Disc */}
                      <div className="relative w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full bg-primary text-text-on-primary elevation-3 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:bg-primary-hover group-active:scale-95 shadow-xl">
                        <Play
                          className="w-7 h-7 sm:w-9 sm:h-9 md:w-10 md:h-10 fill-current translate-x-0.5"
                          aria-hidden="true"
                        />
                      </div>
                    </div>

                    {/* Card Title & Subtitle */}
                    <h3 className="mt-4 sm:mt-5 text-lg sm:text-xl md:text-2xl font-bold text-text-main tracking-tight">
                      {t("home.demo.cardTitle", "Complete Product Demo")}
                    </h3>
                    <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm md:text-base text-text-muted max-w-sm sm:max-w-md font-medium leading-relaxed">
                      {t(
                        "home.demo.cardSubtitle",
                        "Watch our full demo to see all Choseno features in action"
                      )}
                    </p>
                  </div>
                </button>
              )}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
