"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Quote, X } from "lucide-react";
import { Reveal } from "@/components/features/home/HomeMotion";
import { useTranslation } from "@/contexts/LanguageContext";

export default function HomeTestimonial() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Pop-out player: Esc closes, page behind doesn't scroll, focus moves to Close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <section className="relative py-16 sm:py-24 px-4 sm:px-6" aria-label="What elected officials say about Choseno">
      <div className="relative max-w-4xl mx-auto">
        <Reveal className="text-center">
          <p className="text-xs sm:text-sm font-bold uppercase tracking-widest text-primary">
            {t("home.testimonial.eyebrow", "In their words")}
          </p>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-text-main">
            {t("home.testimonial.title", "What elected officials say")}
          </h2>
        </Reveal>

        <Reveal delay={120} className="mt-10 sm:mt-14">
          <div className="glass-card elevation-3 p-4 sm:p-6 md:p-8 grid gap-6 md:gap-10 md:grid-cols-[minmax(0,280px)_1fr] items-center">
            {/* Poster thumbnail -- opens the pop-out player */}
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="group relative mx-auto block w-full max-w-[260px] md:max-w-none rounded-2xl overflow-hidden bg-surface border border-border-light/40 shadow-2xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Play video testimonial from Jessie Sunner, MLA for Surrey-Newton"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/testimonials/jessie-sunner-poster.jpg"
                alt=""
                className="block w-full aspect-[9/16] object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary text-text-on-primary elevation-3 flex items-center justify-center shadow-xl transition-transform duration-300 group-hover:scale-110 group-active:scale-95">
                  <Play className="w-7 h-7 sm:w-9 sm:h-9 fill-current translate-x-0.5" aria-hidden="true" />
                </span>
              </span>
              <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-black/60 text-white text-xs font-semibold backdrop-blur-sm">
                0:22
              </span>
            </button>

            <figure className="text-left">
              <Quote className="w-8 h-8 text-primary/60" aria-hidden="true" />
              <blockquote className="mt-3 text-lg sm:text-xl md:text-2xl font-semibold leading-snug text-text-main">
                {t(
                  "home.testimonial.quote",
                  "Everyone can get information about their specific ridings in every election — municipal, federal, provincial."
                )}
              </blockquote>
              <figcaption className="mt-5">
                <div className="font-bold text-text-main">Jessie Sunner</div>
                <div className="text-sm text-text-muted font-medium">
                  {t("home.testimonial.role", "MLA for Surrey-Newton, British Columbia")}
                </div>
              </figcaption>
              <p className="mt-5 text-xs text-text-muted leading-relaxed">
                {t(
                  "home.testimonial.disclaimer",
                  "Shared voluntarily. Choseno is independent and non-partisan; a testimonial is not an endorsement of any party or candidate."
                )}
              </p>
            </figure>
          </div>
        </Reveal>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Video testimonial from Jessie Sunner, MLA for Surrey-Newton"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative h-[min(88vh,900px)] max-w-full aspect-[9/16] rounded-2xl overflow-hidden bg-black shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              className="h-full w-full object-contain"
              controls
              autoPlay
              playsInline
              controlsList="nofullscreen"
              disablePictureInPicture
              poster="/testimonials/jessie-sunner-poster.jpg"
            >
              <source src="/testimonials/jessie-sunner.mp4" type="video/mp4" />
            </video>
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white text-xs font-semibold backdrop-blur-md transition-colors cursor-pointer"
              aria-label="Close video"
            >
              <X size={14} />
              <span>Close</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
