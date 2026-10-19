"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { Button } from "@/components/primitives";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { signInWithGoogle } from "@/lib/services/auth";
import {
  trackHomeSignupClicked,
  trackHomeSignupSeen,
  trackSignUp,
  trackSignUpFailed,
  type HomeSignupPlacement,
} from "@/lib/analytics/events";
import { GoogleMark, MissionAuthButtons } from "@/components/features/MissionRegisterCTA";

// Where a visitor lands after signing up. "/" bounces signed-in users to /feed
// (HomePageClient), same as the mission popup's home variant.
const NEXT_PATH = "/";
const EMAIL_HREF = `/auth?role=citizen&next=${encodeURIComponent(NEXT_PATH)}`;

// One Google handler for every homepage placement, so each one shares the same
// OAuth call the popup and /auth already make and differs only in the
// `placement` it reports -- that's what lets the funnel say which spot on the
// page converts.
function useHomeGoogleSignup(placement: HomeSignupPlacement) {
  const [busy, setBusy] = useState(false);
  const start = useCallback(async () => {
    setBusy(true);
    trackHomeSignupClicked({ placement, method: "google" });
    try {
      trackSignUp("google");
      await signInWithGoogle(createClient(), NEXT_PATH);
    } catch (err: unknown) {
      const e = err as { error_description?: string; message?: string };
      trackSignUpFailed({ method: "google", reason: "google_oauth_error", message: e.error_description || e.message });
      setBusy(false);
    }
  }, [placement]);
  return { busy, start };
}

// Fires the "seen" event once per page view, the first time the element is in view.
function useSeenOnce(placement: HomeSignupPlacement) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  useEffect(() => {
    if (inView) trackHomeSignupSeen({ placement });
  }, [inView, placement]);
  return ref;
}

// Google first (one tap), email second -- identical pair to the mission popup,
// reused via MissionAuthButtons so the two can never drift apart.
export function HomeSignupButtons({
  placement,
  cta,
  className = "",
}: {
  placement: HomeSignupPlacement;
  cta: string;
  className?: string;
}) {
  const seenRef = useSeenOnce(placement);
  const { busy, start } = useHomeGoogleSignup(placement);
  return (
    <div ref={seenRef} className={className}>
      <MissionAuthButtons
        cta={cta}
        href={EMAIL_HREF}
        googleBusy={busy}
        onGoogleClick={start}
        onEmailClick={() => trackHomeSignupClicked({ placement, method: "email" })}
      />
    </div>
  );
}

// Mobile/tablet bar floating above the bottom tab bar once the hero's buttons have scrolled
// away, so a convinced visitor never has to scroll back up to sign up. It steps
// aside while the closing CTA (#home-closing-cta) is on screen, rather than
// stacking two sign-up prompts.
export function HomeStickySignup() {
  const { user, loading } = useAuth();
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [pastHero, setPastHero] = useState(false);
  const [closingVisible, setClosingVisible] = useState(false);
  const { busy, start } = useHomeGoogleSignup("sticky_bar");
  const shownRef = useRef(false);

  useEffect(() => {
    const onScroll = () => setPastHero(window.scrollY > 640);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const target = document.getElementById("home-closing-cta");
    if (!target) return;
    const io = new IntersectionObserver(([entry]) => setClosingVisible(entry.isIntersecting), { threshold: 0.2 });
    io.observe(target);
    return () => io.disconnect();
  }, []);

  const visible = pastHero && !closingVisible && !loading && !user;

  useEffect(() => {
    if (visible && !shownRef.current) {
      shownRef.current = true;
      trackHomeSignupSeen({ placement: "sticky_bar" });
    }
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={reduceMotion ? false : { y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { y: 24, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 36 }}
          // Floats above NavBar's always-visible mobile tab bar (lg:hidden,
          // fixed bottom-0, ~3.5rem tall + the home-indicator inset).
          style={{ bottom: "calc(3.75rem + env(safe-area-inset-bottom))" }}
          className="lg:hidden fixed inset-x-3 z-40 rounded-2xl bg-surface elevation-4 border border-border-light px-4 py-3"
        >
          <p className="text-center text-xs font-semibold text-text-secondary mb-2">{t("home.social.stickyNote")}</p>
          <Button
            type="button"
            variant="primary"
            disabled={busy}
            onClick={start}
            data-signup-trigger="Sticky bar (Google)"
            className="w-full justify-center gap-2"
          >
            <GoogleMark />
            {busy ? t("home.social.googleOpening") : t("home.social.googleCta")}
          </Button>
          <Link
            href={EMAIL_HREF}
            onClick={() => trackHomeSignupClicked({ placement: "sticky_bar", method: "email" })}
            data-signup-trigger="Sticky bar"
            className="block text-center text-xs font-semibold text-text-muted hover:text-text-main mt-2 py-1"
          >
            {t("home.social.emailCta")}
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
