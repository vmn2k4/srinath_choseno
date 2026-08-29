"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X, ShieldOff, Ban, MessagesSquare, Sparkles, Flag } from "lucide-react";
import { Card, Button, Modal } from "@/components/primitives";
import { useAuth } from "@/contexts/AuthContext";
import { trackMissionCtaClicked, trackMissionCtaShown } from "@/lib/analytics/events";
import { EARLY_EXPLORER_BADGE_LINE } from "@/lib/constants/site";

// Anonymous-visitor conversion CTA, shown on the pages where a guest is
// most likely to have an opinion forming (the homepage, a news story, their
// own district, a candidate race) but can't yet act on it. Two parts
// sharing one copy table below:
//   1. A one-time-per-window modal -- fires after a scroll/time delay.
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

export type MissionCtaVariant = "home" | "news" | "district" | "elections";

// v1 kept one global "seen = '1'" key forever -- a single dismissal on any
// page (e.g. a bounce off the news CTA) silently opted a visitor out of
// ever seeing it again, on any of the other pages, for the life of the
// browser. v2 keys per-variant (a district bounce still gets a shot on
// elections) and stores a timestamp instead of a flag so the suppression
// expires after RESHOW_AFTER_DAYS instead of being permanent. Renamed
// (v1 -> v2) rather than migrated: the old keys just go stale and every
// existing visitor gets one fresh look, which is the intended effect of
// loosening this.
const MODAL_SEEN_PREFIX = "choseno_mission_modal_seen_v2";
const SIDEBAR_DISMISSED_PREFIX = "choseno_mission_sidebar_dismissed_v2";
const RESHOW_AFTER_DAYS = 7;

function storageKey(prefix: string, variant: MissionCtaVariant): string {
  return `${prefix}_${variant}`;
}

// Suppressed only while the stored dismissal is younger than the re-show
// window -- anything unparseable (missing, or a leftover legacy "1" from a
// key collision) is treated as "not suppressed" rather than thrown away
// silently as an error, since worst case is showing the CTA one extra time.
function isSuppressed(key: string): boolean {
  const raw = window.localStorage.getItem(key);
  if (!raw) return false;
  const seenAt = Number(raw);
  if (!Number.isFinite(seenAt)) return false;
  const daysSince = (Date.now() - seenAt) / (1000 * 60 * 60 * 24);
  return daysSince < RESHOW_AFTER_DAYS;
}

function markSeen(key: string): void {
  window.localStorage.setItem(key, String(Date.now()));
}

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
  home: {
    eyebrow: "Google Reviews, for politicians",
    headline: "Stop being a spectator.",
    pitch: "Frustrated watching decisions get made about you, not by you? Rate every official anonymously — no username, no toxic replies, just your opinion.",
    sidebarHeadline: "Done watching from the sidelines?",
    sidebarBody: "Rate your officials anonymously — just your opinion.",
    cta: "Rate Anonymously",
  },
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
  // Ref guards (not just the effects' own dependency arrays / closure
  // locals) so React StrictMode's dev-only double-invoke of effects can't
  // double-count a single real impression -- see the two analogous
  // gateShownRef guards in BoundaryDirectoryClient/HomeLocateWidget.
  const sidebarShownRef = useRef(false);
  const modalShownRef = useRef(false);

  useEffect(() => {
    if (loading || user) return; // matches the component's own `if (loading || user) return null` -- an
    // impression fired here for a signed-in visitor would be counted against a CTA that never actually renders.
    const suppressed = isSuppressed(storageKey(SIDEBAR_DISMISSED_PREFIX, variant));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSidebarDismissed(suppressed);
    if (!suppressed && !sidebarShownRef.current) {
      sidebarShownRef.current = true;
      trackMissionCtaShown({ variant, trigger: "sidebar" });
    }
  }, [variant, loading, user]);

  useEffect(() => {
    if (loading || user) return;
    if (isSuppressed(storageKey(MODAL_SEEN_PREFIX, variant))) return;

    let fired = false;
    const fire = () => {
      if (fired) return;
      fired = true;
      setShowModal(true);
      if (!modalShownRef.current) {
        modalShownRef.current = true;
        trackMissionCtaShown({ variant, trigger: "modal" });
      }
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
  }, [loading, user, variant]);

  const dismissModal = useCallback(() => {
    setShowModal(false);
    markSeen(storageKey(MODAL_SEEN_PREFIX, variant));
  }, [variant]);

  const dismissSidebar = useCallback(() => {
    setSidebarDismissed(true);
    markSeen(storageKey(SIDEBAR_DISMISSED_PREFIX, variant));
  }, [variant]);

  const handleModalCtaClick = useCallback(() => {
    trackMissionCtaClicked({ variant, trigger: "modal" });
    dismissModal();
  }, [variant, dismissModal]);

  const handleSidebarCtaClick = useCallback(() => {
    trackMissionCtaClicked({ variant, trigger: "sidebar" });
  }, [variant]);

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

            <p className="flex items-start gap-1.5 text-[11px] font-semibold text-primary bg-primary/10 rounded-lg px-2.5 py-2 leading-snug">
              <Flag size={13} className="shrink-0 mt-0.5" />
              {EARLY_EXPLORER_BADGE_LINE}
            </p>

            <div className="flex flex-col items-center gap-2 pt-1">
              <Button as={Link} href={href} onClick={handleModalCtaClick} variant="primary" className="w-full justify-center !bg-orange-600 hover:!bg-orange-700 !shadow-lg hover:!shadow-xl relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-orange-500/0 before:via-white/10 before:to-orange-500/0 before:animate-pulse">
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
            <p className="flex items-start gap-1 text-[10.5px] font-semibold text-primary leading-snug">
              <Flag size={11} className="shrink-0 mt-0.5" />
              {EARLY_EXPLORER_BADGE_LINE}
            </p>
            <Button as={Link} href={href} onClick={handleSidebarCtaClick} size="sm" variant="primary" className="w-full justify-center !bg-orange-600 hover:!bg-orange-700 !shadow-lg hover:!shadow-xl relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-orange-500/0 before:via-white/10 before:to-orange-500/0 before:animate-pulse">
              <span className="relative z-10">{copy.cta}</span>
            </Button>
          </Card>
        </div>
      )}
    </>
  );
}
