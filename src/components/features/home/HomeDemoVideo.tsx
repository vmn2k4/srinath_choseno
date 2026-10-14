"use client";

import { useState } from "react";
import { Play, X, Compass } from "lucide-react";
import { Reveal, SectionOrbs } from "@/components/features/home/HomeMotion";
import { useTranslation } from "@/contexts/LanguageContext";

const YOUTUBE_VIDEO_ID = "sBldUnN2Mm8";

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

      <div className="relative max-w-5xl mx-auto grid items-center gap-10 lg:gap-16 lg:grid-cols-[1fr_320px]">
        {/* Copy */}
        <Reveal className="text-center lg:text-left">
          <div className="flex justify-center lg:justify-start mb-4 sm:mb-5">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Compass className="w-6 h-6 animate-pulse" aria-hidden="true" />
            </div>
          </div>

          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-text-main">
            {t("home.demo.title", "Why Choseno?")}
          </h2>

          <p className="mt-3 sm:mt-4 text-base sm:text-lg md:text-xl font-bold text-primary tracking-wide">
            {t(
              "home.demo.quote",
              "\"Built for everyday citizens — powered for real democracy.\""
            )}
          </p>

          <div className="mt-4 sm:mt-5 max-w-2xl mx-auto lg:mx-0 space-y-1.5">
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

        {/* Vertical (9:16) video card */}
        <Reveal delay={120} className="mx-auto w-full max-w-[300px] sm:max-w-[320px]">
          <div className="relative w-full glass-card elevation-3 p-1.5 sm:p-2.5">
            <div className="relative w-full aspect-[9/16] rounded-2xl overflow-hidden bg-surface border border-border-light/40 shadow-2xl">
              {isPlaying ? (
                <>
                  <iframe
                    className="absolute inset-0 w-full h-full border-0"
                    src={`https://www.youtube-nocookie.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                    title="Choseno Product Demo"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                  <button
                    onClick={() => setIsPlaying(false)}
                    className="absolute top-3 right-3 z-20 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-elevated/90 hover:bg-surface-active text-text-main text-xs font-semibold backdrop-blur-md border border-border-light transition-colors shadow-lg cursor-pointer"
                    aria-label="Close video preview"
                  >
                    <X size={14} />
                    <span>Close</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsPlaying(true)}
                  className="group absolute inset-0 w-full h-full flex flex-col items-center justify-center px-5 text-center cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label="Play Choseno product demo video"
                >
                  <div
                    className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-105"
                    style={{
                      background:
                        "radial-gradient(ellipse at 80% 20%, color-mix(in srgb, var(--color-primary) 18%, transparent) 0%, transparent 70%), radial-gradient(ellipse at 20% 80%, color-mix(in srgb, var(--color-accent) 22%, transparent) 0%, transparent 75%), var(--color-surface)",
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-surface/70 via-transparent to-surface/40 pointer-events-none" />

                  <div className="relative z-10 flex flex-col items-center justify-center">
                    <div className="mb-6 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-surface-elevated/90 border border-border-light text-text-main shadow-md elevation-1">
                      <div className="w-5 h-5 rounded-lg bg-primary text-text-on-primary font-black flex items-center justify-center text-xs shadow-sm">
                        C
                      </div>
                      <span className="text-sm font-bold text-text-main tracking-wide">Choseno</span>
                    </div>

                    <div className="relative my-3">
                      <div className="absolute -inset-3 rounded-full bg-primary/20 blur-md group-hover:bg-primary/35 transition-all duration-500 animate-pulse" />
                      <div className="relative w-20 h-20 rounded-full bg-primary text-text-on-primary elevation-3 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:bg-primary-hover group-active:scale-95 shadow-xl">
                        <Play className="w-9 h-9 fill-current translate-x-0.5" aria-hidden="true" />
                      </div>
                    </div>

                    <h3 className="mt-5 text-xl font-bold text-text-main tracking-tight">
                      {t("home.demo.cardTitle", "Complete Product Demo")}
                    </h3>
                    <p className="mt-2 text-sm text-text-muted max-w-[16rem] font-medium leading-relaxed">
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
