"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { X, ShieldOff, Ban, MessagesSquare, Sparkles } from "lucide-react";
import { Card, Button, Modal } from "@/components/primitives";
import { useAuth } from "@/contexts/AuthContext";

// Anonymous-visitor conversion CTA, shown on the three pages where a guest
// is most likely to have an opinion forming (a news story, their own
// district, a candidate race) but can't yet act on it. Two parts sharing
// one copy table below:
//   1. A one-time modal -- fires after a scroll/time delay, dismissed and
//      never shown again once seen (any browser, any of the three pages).
//   2. A small persistent floating card -- stays until dismissed, a much
//      quieter nudge than the modal.
// Both disappear entirely once `useAuth()` reports a signed-in user, and
// neither renders anything while auth is still resolving (no flash).
//
// Both panels force a solid `!bg-surface` instead of Card's default
// translucent "glass" look (bg-surface/30) -- fine for a card embedded in a
// page, but over a blurred overlay/page background it read as washed-out
// and hard to read (reported directly against this component). Same fix
// InteractiveLocationPicker already applies to its own popover for the
// identical legibility reason.

export type MissionCtaVariant = "news" | "district" | "elections";

const MODAL_SEEN_KEY = "choseno_mission_modal_seen_v1";
const SIDEBAR_DISMISSED_KEY = "choseno_mission_sidebar_dismissed_v1";

const COPY: Record<
  MissionCtaVariant,
  {
    eyebrow: string;
    headline: string;
    pitch: string;
    sidebarHeadline: string;
    sidebarBody: string;
    cta: string;
  }
> = {
  news: {
    eyebrow: "Beyond the headline",
    headline: "What do YOU think?",
    pitch: "Choseno isn't just news — it's where citizens anonymously rate the politicians in every story. Join the mission.",
    sidebarHeadline: "Got a take on this story?",
    sidebarBody: "Rate the politicians in it — anonymously.",
    cta: "Join the Mission",
  },
  district: {
    eyebrow: "You found them",
    headline: "Now hold them accountable.",
    pitch: "Anonymously rate every official in your district — no username, no toxic replies. Join the mission.",
    sidebarHeadline: "Now rate who represents you",
    sidebarBody: "Anonymous. No toxic replies.",
    cta: "Join the Mission",
  },
  elections: {
    eyebrow: "Before you vote",
    headline: "Judge the race yourself.",
    pitch: "Anonymously rate every candidate running — no username, no toxic replies. Join the mission.",
    sidebarHeadline: "Rate the candidates on this page",
    sidebarBody: "Anonymous. No toxic replies.",
    cta: "Join the Mission",
  },
};

const TRUST_CHIPS = [
  { icon: ShieldOff, label: "Anonymous" },
  { icon: Ban, label: "Capped comments" },
  { icon: MessagesSquare, label: "No replies" },
];

export default function MissionRegisterCTA({
  variant,
  nextPath,
}: {
  variant: MissionCtaVariant;
  nextPath?: string;
}) {
  const { user, loading } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [sidebarDismissed, setSidebarDismissed] = useState(true); // starts hidden until localStorage check below, to avoid a flash

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSidebarDismissed(window.localStorage.getItem(SIDEBAR_DISMISSED_KEY) === "1");
  }, []);

  useEffect(() => {
    if (loading || user) return;
    if (window.localStorage.getItem(MODAL_SEEN_KEY) === "1") return;

    let fired = false;
    const fire = () => {
      if (fired) return;
      fired = true;
      setShowModal(true);
    };

    // Whichever comes first: ~15s of dwell time, or scrolling halfway down
    // the page -- either signals genuine interest rather than a bounce.
    const timer = window.setTimeout(fire, 15000);
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY / max >= 0.5) fire();
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [loading, user]);

  const dismissModal = useCallback(() => {
    setShowModal(false);
    window.localStorage.setItem(MODAL_SEEN_KEY, "1");
  }, []);

  const dismissSidebar = useCallback(() => {
    setSidebarDismissed(true);
    window.localStorage.setItem(SIDEBAR_DISMISSED_KEY, "1");
  }, []);

  if (loading || user) return null;

  const copy = COPY[variant];
  const href = `/auth?role=citizen&next=${encodeURIComponent(nextPath || "/")}`;

  return (
    <>
      {showModal && (
        <Modal onOverlayClick={dismissModal}>
          <Card padding="md" className="relative w-[88vw] max-w-sm !bg-surface shadow-2xl space-y-3.5">
            <button
              type="button"
              onClick={dismissModal}
              aria-label="Close"
              className="absolute top-3.5 right-3.5 text-text-muted hover:text-text-main transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="space-y-1 pr-6">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary uppercase tracking-wide">
                <Sparkles size={12} /> {copy.eyebrow}
              </span>
              <h2 className="text-lg font-extrabold text-text-main leading-snug text-balance">
                {copy.headline}
              </h2>
            </div>

            <p className="text-sm text-text-secondary leading-snug">{copy.pitch}</p>

            <div className="flex flex-wrap gap-1.5">
              {TRUST_CHIPS.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 px-2 py-1 rounded-full"
                >
                  <Icon size={11} /> {label}
                </span>
              ))}
            </div>

            <div className="flex flex-col items-center gap-2 pt-1">
              <Button as={Link} href={href} onClick={dismissModal} variant="primary" className="w-full justify-center !bg-orange-600 hover:!bg-orange-700 !shadow-lg hover:!shadow-xl relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-orange-500/0 before:via-white/10 before:to-orange-500/0 before:animate-pulse">
                <span className="relative z-10">{copy.cta}</span>
              </Button>
              <button
                type="button"
                onClick={dismissModal}
                className="text-xs font-semibold text-text-muted hover:text-text-main transition-colors cursor-pointer"
              >
                Maybe later
              </button>
            </div>
          </Card>
        </Modal>
      )}

      {!sidebarDismissed && (
        <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:w-72 z-40 animate-fade-in">
          <Card padding="sm" className="relative !bg-surface shadow-xl border-primary/20 space-y-2">
            <button
              type="button"
              onClick={dismissSidebar}
              aria-label="Dismiss"
              className="absolute top-2.5 right-2.5 text-text-muted hover:text-text-main transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
            <p className="text-sm font-bold text-text-main pr-5 leading-snug">{copy.sidebarHeadline}</p>
            <p className="text-xs text-text-muted leading-snug">{copy.sidebarBody}</p>
            <Button as={Link} href={href} size="sm" variant="primary" className="w-full justify-center !bg-orange-600 hover:!bg-orange-700 !shadow-lg hover:!shadow-xl relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-orange-500/0 before:via-white/10 before:to-orange-500/0 before:animate-pulse">
              <span className="relative z-10">{copy.cta}</span>
            </Button>
          </Card>
        </div>
      )}
    </>
  );
}
