"use client";

// The "why Choseno" easter egg: read the last three letters backwards and
// "Choseno" ends in "...eno" -> reversed, "one" ( positions 6,5,4 = o,n,e ).
// Most visitors will never notice that just from the wordmark, so once this
// section scrolls into view we spotlight it: a camera-style zoom pulses
// through each letter left-to-right spelling "CHOSEN" (positions 0-5),
// then a second, slower pass zooms specifically through positions 6, 5, 4
// -- "O", "N", "E" -- which stay lit afterward so the word "ONE" visibly
// hangs there once the pass finishes. The caption spelling out the pun is
// always on screen (not gated behind the animation finishing), so the point
// lands even for a visitor who skims past before the zoom completes -- and
// a replay button lets anyone who wants to watch it again (or show a
// friend) trigger it on demand.

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { RotateCcw } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// Original letters of "Choseno", left-to-right, index 0-6.
const LETTERS = ["C", "h", "o", "s", "e", "n", "o"];
// Pass 1: spell out "CHOSEN" left-to-right (everything but the trailing "o").
const CHOSEN_PASS = [0, 1, 2, 3, 4, 5];
// Pass 2: the last three letters, visited back-to-front -- o(6), n(5), e(4)
// -- which is exactly "one" read in forward order once lit.
const ONE_PASS = [6, 5, 4];
const STEP_MS = 380;
const ONE_STEP_MS = 480;

export default function NameOriginReveal() {
  const reduceMotion = useReducedMotion();
  const { t } = useTranslation();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [litIndices, setLitIndices] = useState<Set<number>>(new Set());
  const hasPlayedRef = useRef(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearPending = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  };

  const playSequence = useCallback(() => {
    clearPending();
    setActiveIndex(null);
    setLitIndices(new Set());

    let delay = 250; // small lead-in before the first zoom
    const after = (fn: () => void) => {
      timeoutsRef.current.push(setTimeout(fn, delay));
    };

    CHOSEN_PASS.forEach((index) => {
      after(() => setActiveIndex(index));
      delay += STEP_MS;
    });

    delay += 260; // breath between the two passes
    ONE_PASS.forEach((index) => {
      after(() => {
        setActiveIndex(index);
        setLitIndices((prev) => new Set(prev).add(index));
      });
      delay += ONE_STEP_MS;
    });

    // O, N, E stay lit after the pass -- no auto-reset. The caption is
    // always visible anyway, so there's nothing left to reveal; a visitor
    // who wants to watch the zoom again just hits replay.
    after(() => setActiveIndex(null));
  }, []);

  useEffect(() => clearPending, []);

  const captionText = t(
    "home.nameReveal.caption",
    "Spelled backwards, “Choseno” ends where it starts — with ONE. Because you are."
  );

  if (reduceMotion) {
    return (
      <div className="mx-auto max-w-2xl text-center px-4 pb-6 sm:pb-8">
        <p className="font-display text-2xl sm:text-3xl font-extrabold tracking-[0.15em] sm:tracking-[0.25em]">
          Chos
          <span className="text-primary">en</span>
          <span className="text-primary">o</span>
        </p>
        <p className="mt-3 text-text-muted text-sm sm:text-base leading-relaxed">{captionText}</p>
      </div>
    );
  }

  return (
    <motion.div
      className="mx-auto max-w-2xl text-center px-4 pb-6 sm:pb-8"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      onViewportEnter={() => {
        if (hasPlayedRef.current) return;
        hasPlayedRef.current = true;
        playSequence();
      }}
      transition={{ duration: 0.6, ease: EASE }}
    >
      <div className="flex items-center justify-center gap-2 sm:gap-3" aria-hidden="true">
        {LETTERS.map((letter, index) => {
          const isActive = activeIndex === index;
          const isLit = litIndices.has(index);
          const isDimmed = activeIndex !== null && !isActive && !isLit;
          return (
            <motion.span
              key={index}
              animate={{ scale: isActive ? 1.65 : 1, y: isActive ? -6 : 0, opacity: isDimmed ? 0.3 : 1 }}
              transition={{ duration: 0.28, ease: EASE }}
              // Color and glow are plain CSS-transitioned style values, not
              // framer `animate` targets -- framer's color interpolator
              // can't reliably tween between two var()-based color strings
              // (it needs numeric/hex colors to blend), which under any
              // timing pressure left a letter stuck mid-color once. A native
              // CSS transition tweens var()/color-mix() values just fine.
              style={{
                color: isActive || isLit ? "var(--color-primary)" : "var(--color-text-main)",
                textShadow:
                  isActive || isLit
                    ? "0 0 20px color-mix(in srgb, var(--color-primary) 60%, transparent)"
                    : "0 0 0 transparent",
                transition: "color 280ms ease, text-shadow 280ms ease",
              }}
              className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight inline-block origin-bottom"
            >
              {letter}
            </motion.span>
          );
        })}
      </div>

      {/* Visually-hidden, static version for screen readers -- the letters
          above pulse individually and are marked aria-hidden, so this is the
          one thing assistive tech actually reads. */}
      <p className="sr-only">Choseno</p>

      <p className="mt-4 text-text-muted text-sm sm:text-base leading-relaxed">{captionText}</p>

      <button
        type="button"
        onClick={() => {
          hasPlayedRef.current = true;
          playSequence();
        }}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-primary transition-colors cursor-pointer"
      >
        <RotateCcw size={12} aria-hidden="true" />
        {t("home.nameReveal.replayLabel", "Watch it again")}
      </button>
    </motion.div>
  );
}
