"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Play, X, Compass, Maximize2 } from "lucide-react";
import { Reveal, SectionOrbs } from "@/components/features/home/HomeMotion";
import { useTranslation } from "@/contexts/LanguageContext";

const YOUTUBE_VIDEO_ID = "sBldUnN2Mm8";

const EMBED_SRC = `https://www.youtube-nocookie.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&rel=0&modestbranding=1&playsinline=1&controls=0&fs=0&disablekb=1&iv_load_policy=3&cc_load_policy=0`;

// YouTube always draws its title/channel bar at the top of the embed and hides it
// for nobody. The iframe is made 96px taller above and below the overflow-hidden
// frame that holds it; the 9:16 video letterboxes into the middle, so the title,
// Shorts badge and captions land in the clipped bars and the whole video stays
// visible, uncropped.
function VideoFrame() {
  return (
    <iframe
      className="absolute left-0 w-full border-0 top-[-96px] h-[calc(100%+192px)]"
      src={EMBED_SRC}
      title="What Choseno Is"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
    />
  );
}

// Popout player. Portaled to <body> because the section's reveal animation
// uses transforms, which would otherwise trap a position:fixed overlay.
function VideoLightbox({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="What Choseno is"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/25 cursor-pointer"
        aria-label="Close full screen video"
      >
        <X size={16} aria-hidden="true" />
        Close
      </button>
      <div
        className="relative aspect-[9/16] h-[min(92vh,calc(92vw*16/9))] overflow-hidden rounded-2xl bg-black shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <VideoFrame />
      </div>
    </div>,
    document.body
  );
}

export default function HomeDemoVideo() {
  const { t } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <section className="relative py-16 sm:py-24 px-4 sm:px-6 overflow-hidden" aria-label="What Choseno is">
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
                <VideoFrame />
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
                      {t("home.demo.cardTitle", "See What Choseno Is")}
                    </h3>
                    <p className="mt-2 text-sm text-text-muted max-w-[16rem] font-medium leading-relaxed">
                      {t(
                        "home.demo.cardSubtitle",
                        "A quick look at how Choseno works"
                      )}
                    </p>
                  </div>
                </button>
              )}
            </div>
          </div>
          {isPlaying && (
            <div className="mt-3 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setIsFullscreen(true);
                }}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-text-muted hover:text-text-main hover:bg-surface-active transition-colors cursor-pointer"
                aria-label="Play video full screen"
              >
                <Maximize2 size={14} aria-hidden="true" />
                <span>Full screen</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPlaying(false)}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-text-muted hover:text-text-main hover:bg-surface-active transition-colors cursor-pointer"
                aria-label="Close video preview"
              >
                <X size={14} aria-hidden="true" />
                <span>Close video</span>
              </button>
            </div>
          )}
          {isFullscreen && <VideoLightbox onClose={() => setIsFullscreen(false)} />}
        </Reveal>
      </div>
    </section>
  );
}
