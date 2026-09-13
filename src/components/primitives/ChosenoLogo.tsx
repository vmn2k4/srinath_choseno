"use client";

// Ported ahead of the rest of Phase 2 — the nav shell (Phase 1) needs it.
// Concept: top forward-arrow arc, bottom reverse-arrow arc, center "eye" dot.
//
// The wordmark also carries a small brand joke: "Choseno" split as "Chosen"
// + trailing "o" already hints at "One" (that's why the "o" gets its own
// color below), and reading the last three letters backwards -- o-n-e --
// spells "ONE" outright. This logo loops that on a fixed cadence: a zoom
// pulses through C-H-O-S-E-N, then a second pass through O-N-E, which stay
// lit (and pulse the icon) until the next cycle resets them LOOP_INTERVAL_MS
// later.

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

type Size = "sm" | "md" | "lg" | "xl";

const ICON_SIZES: Record<Size, string> = {
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-10 h-10",
  xl: "w-16 h-16",
};

const TEXT_SIZES: Record<Size, string> = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-2xl",
  xl: "text-4xl",
};

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
// Original letters of "Choseno", left-to-right, index 0-6.
const LETTERS = ["C", "h", "o", "s", "e", "n", "o"];
// Pass 1: spell out "CHOSEN" left-to-right (everything but the trailing "o").
const CHOSEN_PASS = [0, 1, 2, 3, 4, 5];
// Pass 2: the last three letters, visited back-to-front -- o(6), n(5), e(4)
// -- which is exactly "one" read in forward order once lit.
const ONE_PASS = [6, 5, 4];
const STEP_MS = 260;
const ONE_STEP_MS = 340;
// Fixed cycle length -- one run of the sequence (lead-in + both passes)
// takes well under this, so there's always a static pause before the next
// run starts.
const LOOP_INTERVAL_MS = 10000;

export default function ChosenoLogo({
  size = "md",
  showText = true,
  className = "",
}: {
  size?: Size;
  showText?: boolean;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [litIndices, setLitIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (reduceMotion || !showText) return;

    let cancelled = false;
    let timeouts: ReturnType<typeof setTimeout>[] = [];
    const after = (fn: () => void, ms: number) => {
      timeouts.push(
        setTimeout(() => {
          if (!cancelled) fn();
        }, ms)
      );
    };

    const runOnce = () => {
      setActiveIndex(null);
      setLitIndices(new Set());

      let delay = 0;
      CHOSEN_PASS.forEach((index) => {
        after(() => setActiveIndex(index), delay);
        delay += STEP_MS;
      });

      delay += 200; // breath between the two passes
      ONE_PASS.forEach((index) => {
        after(() => {
          setActiveIndex(index);
          setLitIndices((prev) => new Set(prev).add(index));
        }, delay);
        delay += ONE_STEP_MS;
      });

      // O, N, E stay lit (see oneActive below) until the next cycle's reset
      // above -- no separate tagline/hold step to time against anymore.
      after(() => setActiveIndex(null), delay);
    };

    after(runOnce, 500); // let the page settle before the first run
    const intervalId = setInterval(() => {
      // Each tick starts a fresh batch of timeouts -- drop the (already
      // fired) ones from the previous cycle instead of growing forever.
      timeouts = [];
      runOnce();
    }, LOOP_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      timeouts.forEach(clearTimeout);
    };
    // Intentionally mount-only: the loop is driven by setInterval above, not
    // by `size`/`showText` identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const oneActive = activeIndex !== null && ONE_PASS.includes(activeIndex);

  return (
    <div
      className={`inline-flex items-center gap-2.5 font-display font-extrabold tracking-tight select-none ${className}`}
    >
      <motion.svg
        animate={reduceMotion ? undefined : { scale: oneActive ? 1.12 : 1 }}
        transition={{ duration: 0.25, ease: EASE }}
        style={{
          filter:
            oneActive || litIndices.size > 0
              ? "drop-shadow(0 2px 14px rgba(249,115,22,0.6))"
              : "drop-shadow(0 2px 8px rgba(249,115,22,0.35))",
          transition: "filter 250ms ease",
        }}
        className={`${ICON_SIZES[size]} shrink-0 transition-transform duration-300 hover:scale-105`}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Choseno Logo Icon"
      >
        <defs>
          <linearGradient id="choseno-orange-top" x1="4" y1="8" x2="44" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ff8c00" />
          </linearGradient>
          <linearGradient id="choseno-orange-bottom" x1="44" y1="28" x2="8" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ea580c" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>

        <path
          d="M 6 22 C 10 10, 24 6, 36 12 L 34 7 L 44 14 L 37 23 L 35 18 C 26 12, 14 14, 8 23 Z"
          fill="url(#choseno-orange-top)"
        />
        <path
          d="M 42 26 C 38 38, 24 42, 12 36 L 14 41 L 4 34 L 11 25 L 13 30 C 22 36, 34 34, 40 25 Z"
          fill="url(#choseno-orange-bottom)"
        />

        <circle cx="24" cy="24" r="6" fill="#ffffff" />
        <circle cx="24" cy="24" r="3.5" fill="#0f172a" />
      </motion.svg>

      {showText && (
        <span className={`${TEXT_SIZES[size]} flex items-center leading-none tracking-tight`}>
          {LETTERS.map((letter, index) => {
            const isChosenLetter = index < 6;
            const isActive = activeIndex === index;
            const isLit = litIndices.has(index);
            return (
              <motion.span
                key={index}
                animate={reduceMotion ? undefined : { scale: isActive ? 1.35 : 1, y: isActive ? -3 : 0 }}
                transition={{ duration: 0.22, ease: EASE }}
                style={{
                  textShadow: isActive || isLit ? "0 0 12px rgba(249,115,22,0.7)" : "0 0 0 transparent",
                  transition: "text-shadow 220ms ease",
                }}
                className={`inline-block origin-bottom transition-colors ${
                  isChosenLetter ? "text-orange-500 hover:text-orange-400" : "text-amber-500 hover:text-orange-400"
                }`}
              >
                {letter}
              </motion.span>
            );
          })}
        </span>
      )}
    </div>
  );
}
