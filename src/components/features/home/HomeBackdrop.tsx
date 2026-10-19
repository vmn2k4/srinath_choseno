"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Ghost, MousePointer2 } from "lucide-react";

// "Voices": an interactive backdrop meant to be played with.
//   - A dot grid ripples with a slow ambient wave, so the page is alive on its own.
//   - Your cursor parts the dots like water, lights them up (primary -> accent) and
//     links to the nearest ones with threads of light. Move fast and the field
//     reacts harder.
//   - Click anywhere to "speak": a shockwave rolls across the whole page, shoving
//     the dots outward as it passes, and a "Ghost-... spoke up" chip floats away.
//     Keep clicking and you build a streak that triggers a bigger triple wave.
//   - With no mouse (touch, or idle for a few seconds) a ghost cursor wanders the
//     page, so first-time visitors see the effect without having to discover it.
// Drawn on one <canvas> (a few thousand dots stay smooth), colours read from the
// theme's `primary` / `accent` tokens so every theme re-tints it, framer-motion
// handles the chips, and with reduced motion it's a still dot grid.

const SPACING = 34;
const SPACING_SMALL = 42;
const RADIUS_BASE = 150;
const LINK_RADIUS = 125;
const MAX_LINKS = 9;
const WAVE_SPEED = 560; // px/s
const WAVE_WIDTH = 95;
const WAVE_LIFE = 2.8; // s
const STREAK_WINDOW_MS = 8000;
const STREAK_TARGET = 5;
const IDLE_BEFORE_GHOST_MS = 6000;

const GHOST_NAMES = [
  "Ghost-CandidFalcon", "Ghost-QuietHeron", "Ghost-SturdyOtter", "Ghost-NimbleWren",
  "Ghost-BoldFinch", "Ghost-KeenLynx", "Ghost-CivicRaven", "Ghost-FrankBadger",
  "Ghost-SteadyElk", "Ghost-HumbleMarten", "Ghost-ArdentOsprey", "Ghost-LocalCoyote",
];

type Wave = { x: number; y: number; t0: number; power: number };
type Chip = { id: number; x: number; y: number; text: string; big: boolean };

function readToken(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

const INTERACTIVE = "a,button,input,textarea,select,summary,label,[role='button']";

export default function HomeBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();
  const [chips, setChips] = useState<Chip[]>([]);
  const [showHint, setShowHint] = useState(true);
  const chipId = useRef(0);

  const spawnChip = useCallback((x: number, y: number, text: string, big = false) => {
    const id = ++chipId.current;
    setChips((c) => [...c.slice(-5), { id, x, y, text, big }]);
    window.setTimeout(() => setChips((c) => c.filter((k) => k.id !== id)), 2100);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let w = 0;
    let h = 0;
    let cols = 0;
    let rows = 0;
    let gx = new Float32Array(0);
    let gy = new Float32Array(0);
    let ox = new Float32Array(0);
    let oy = new Float32Array(0);
    let vx = new Float32Array(0);
    let vy = new Float32Array(0);
    let primary = readToken("--color-primary", "#3b82f6");
    let accent = readToken("--color-accent", "#8b5cf6");
    let lastTokenRead = 0;

    const build = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const spacing = w < 640 ? SPACING_SMALL : SPACING;
      cols = Math.ceil(w / spacing) + 1;
      rows = Math.ceil(h / spacing) + 1;
      const n = cols * rows;
      gx = new Float32Array(n);
      gy = new Float32Array(n);
      ox = new Float32Array(n);
      oy = new Float32Array(n);
      vx = new Float32Array(n);
      vy = new Float32Array(n);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          gx[i] = c * spacing + (r % 2 ? spacing / 2 : 0); // offset rows: reads more organic than a strict grid
          gy[i] = r * spacing;
        }
      }
    };
    build();

    if (reduceMotion) {
      // Still composition: the grid at its resting alpha, nothing animated.
      ctx.fillStyle = primary;
      ctx.globalAlpha = 0.09;
      for (let i = 0; i < gx.length; i++) {
        ctx.beginPath();
        ctx.arc(gx[i], gy[i], 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      const onResize = () => window.location.reload();
      window.addEventListener("orientationchange", onResize);
      return () => window.removeEventListener("orientationchange", onResize);
    }

    const waves: Wave[] = [];
    let px = w / 2;
    let py = h / 2;
    let ppx = px;
    let ppy = py;
    let hasRealPointer = false;
    let lastMove = 0;
    let speedSmooth = 0;
    let clicks: number[] = [];

    const onMove = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
      hasRealPointer = true;
      lastMove = performance.now();
    };

    const onDown = (e: PointerEvent) => {
      const now = performance.now();
      px = e.clientX;
      py = e.clientY;
      hasRealPointer = true;
      lastMove = now;
      setShowHint(false);
      const t = now / 1000;
      waves.push({ x: e.clientX, y: e.clientY, t0: t, power: 1 });
      clicks = clicks.filter((c) => now - c < STREAK_WINDOW_MS);
      clicks.push(now);
      const onInteractive = (e.target as Element | null)?.closest?.(INTERACTIVE);
      if (clicks.length >= STREAK_TARGET) {
        // Streak payoff: a staggered triple wave and a bigger chip.
        clicks = [];
        waves.push({ x: e.clientX, y: e.clientY, t0: t + 0.18, power: 1.4 }, { x: e.clientX, y: e.clientY, t0: t + 0.36, power: 1.8 });
        spawnChip(e.clientX, e.clientY, "Your community is listening", true);
      } else if (!onInteractive) {
        spawnChip(e.clientX, e.clientY, `${GHOST_NAMES[Math.floor(Math.random() * GHOST_NAMES.length)]} spoke up`);
      }
    };

    const onResize = () => build();
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("resize", onResize);

    let raf = 0;
    let last = performance.now();
    const links: Array<[number, number, number]> = [];

    const frame = (nowMs: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (nowMs - last) / 1000);
      last = nowMs;
      const s = dt * 60;
      const t = nowMs / 1000;

      if (nowMs - lastTokenRead > 2000) {
        primary = readToken("--color-primary", primary);
        accent = readToken("--color-accent", accent);
        lastTokenRead = nowMs;
      }

      // Pointer: the real one while it's active, otherwise a ghost cursor wandering a Lissajous path.
      const ghosting = !hasRealPointer || nowMs - lastMove > IDLE_BEFORE_GHOST_MS;
      if (ghosting) {
        px += (w * (0.5 + 0.34 * Math.sin(t * 0.45)) - px) * 0.04 * s;
        py += (h * (0.5 + 0.28 * Math.sin(t * 0.33 + 1.2)) - py) * 0.04 * s;
      }
      const speed = Math.hypot(px - ppx, py - ppy) / Math.max(dt, 0.001);
      speedSmooth += (speed - speedSmooth) * 0.12;
      ppx = px;
      ppy = py;
      const R = RADIUS_BASE + Math.min(speedSmooth * 0.04, 70); // move fast, disturb more of the field

      for (let i = waves.length - 1; i >= 0; i--) if (t - waves[i].t0 > WAVE_LIFE) waves.splice(i, 1);

      ctx.clearRect(0, 0, w, h);
      links.length = 0;
      let lastFill = "";

      for (let i = 0; i < gx.length; i++) {
        const bx = gx[i];
        const by = gy[i];

        // Cursor repulsion.
        const dxp = bx + ox[i] - px;
        const dyp = by + oy[i] - py;
        const d2 = dxp * dxp + dyp * dyp;
        let prox = 0;
        if (d2 < R * R) {
          const d = Math.sqrt(d2) || 1;
          prox = 1 - d / R;
          const push = prox * prox * 4 * s;
          vx[i] += (dxp / d) * push;
          vy[i] += (dyp / d) * push;
          if (d < LINK_RADIUS) links.push([d, bx + ox[i], by + oy[i]]);
        }

        // Shockwaves.
        for (let k = 0; k < waves.length; k++) {
          const wv = waves[k];
          const age = t - wv.t0;
          if (age < 0) continue;
          const rx = bx - wv.x;
          const ry = by - wv.y;
          const r = Math.sqrt(rx * rx + ry * ry) || 1;
          const diff = Math.abs(r - age * WAVE_SPEED);
          if (diff < WAVE_WIDTH) {
            const impulse = (1 - diff / WAVE_WIDTH) ** 2 * 4 * wv.power * (1 - age / WAVE_LIFE) * s;
            vx[i] += (rx / r) * impulse;
            vy[i] += (ry / r) * impulse;
          }
        }

        // Spring home + damping.
        vx[i] = (vx[i] - ox[i] * 0.05 * s) * Math.pow(0.88, s);
        vy[i] = (vy[i] - oy[i] * 0.05 * s) * Math.pow(0.88, s);
        ox[i] += vx[i] * s;
        oy[i] += vy[i] * s;

        const energy = Math.min(1, Math.hypot(ox[i], oy[i]) / 30 + prox * 0.85);
        const ambient = 0.5 + 0.5 * Math.sin(bx * 0.011 + by * 0.007 - t * 0.9);
        const radius = 1.1 + ambient * 0.4 + energy * 1.7;
        const fill = energy > 0.42 ? accent : primary;
        if (fill !== lastFill) {
          ctx.fillStyle = fill;
          lastFill = fill;
        }
        ctx.globalAlpha = Math.min(0.38, 0.07 + ambient * 0.05 + energy * 0.28);
        ctx.beginPath();
        ctx.arc(bx + ox[i], by + oy[i], radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Threads of light from the cursor to its nearest dots.
      links.sort((a, b) => a[0] - b[0]);
      ctx.strokeStyle = primary;
      ctx.lineWidth = 1;
      for (let k = 0; k < Math.min(MAX_LINKS, links.length); k++) {
        const [d, lx, ly] = links[k];
        ctx.globalAlpha = (1 - d / LINK_RADIUS) * 0.16;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(lx, ly);
        ctx.stroke();
      }

      // Soft glow at the cursor (also marks the ghost cursor).
      const glow = ctx.createRadialGradient(px, py, 0, px, py, 70);
      glow.addColorStop(0, accent);
      glow.addColorStop(1, "transparent");
      ctx.globalAlpha = ghosting ? 0.04 : 0.08;
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(px, py, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", onResize);
    };
  }, [reduceMotion, spawnChip]);

  useEffect(() => {
    if (!showHint) return;
    const id = window.setTimeout(() => setShowHint(false), 14000);
    return () => window.clearTimeout(id);
  }, [showHint]);

  return (
    <>
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 h-full w-full" />

      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
        <AnimatePresence>
          {chips.map((chip) => (
            <motion.div
              key={chip.id}
              style={{ left: chip.x, top: chip.y }}
              initial={{ opacity: 0, y: 6, scale: 0.8, x: "-50%" }}
              animate={{ opacity: 1, y: -38, scale: 1, x: "-50%" }}
              exit={{ opacity: 0, y: -78, scale: 0.96, x: "-50%" }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className={`absolute inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border-light bg-surface-elevated px-3 py-1.5 font-bold text-text-main elevation-2 ${
                chip.big ? "text-sm border-primary/60" : "text-xs"
              }`}
            >
              <Ghost size={chip.big ? 15 : 13} className="text-primary" />
              {chip.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showHint && !reduceMotion && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ delay: 1.6, duration: 0.5 }}
            aria-hidden="true"
            className="pointer-events-none fixed bottom-6 right-6 z-30 hidden items-center gap-2 rounded-full border border-border-light bg-surface-elevated/90 px-4 py-2 text-xs font-bold text-text-secondary elevation-2 [@media(hover:hover)]:flex"
          >
            <MousePointer2 size={14} className="text-primary" />
            Move your cursor. Click to speak.
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
