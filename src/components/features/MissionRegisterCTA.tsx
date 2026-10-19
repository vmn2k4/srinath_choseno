"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, ShieldOff, Ban, MessagesSquare, Sparkles, Flag, Share2, Check } from "lucide-react";
import { Card, Button, Modal } from "@/components/primitives";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { signInWithGoogle } from "@/lib/services/auth";
import {
  trackMissionCtaClicked,
  trackMissionCtaShown,
  trackShare,
  trackSignUp,
  trackSignUpFailed,
} from "@/lib/analytics/events";
import IntroVideoPlayer from "./IntroVideoPlayer";

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

export type MissionCtaVariant = "home" | "news" | "district" | "elections" | "seat" | "candidate" | "politician";

// Gated actions elsewhere on the page (Support / Sign In to Post / Be the
// First to Review...) call this instead of navigating straight to /auth, so
// the same popup -- Google + email, same copy -- appears at the exact moment
// of intent. Returns false when no popup is mounted on the page (or the
// visitor is signed in), so the caller can fall back to its old /auth redirect.
export const OPEN_MISSION_POPUP_EVENT = "choseno:open-mission-popup";
export function openMissionPopup(): boolean {
  if (typeof window === "undefined") return false;
  const event = new CustomEvent(OPEN_MISSION_POPUP_EVENT, { cancelable: true });
  return !window.dispatchEvent(event); // a mounted popup calls preventDefault()
}

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

// First-ever visit (any page) shows this intro video in the modal slot
// instead of the mission copy. Once it's closed we stamp this key, so every
// later modal -- on any page -- is the normal mission popup. The mission
// per-variant keys are deliberately left untouched by the video, so the
// mission popup still gets its first showing on the next page/visit.
const INTRO_VIDEO_URL = "https://youtube.com/shorts/qlr9s9QkVww";
const INTRO_VIDEO_SEEN_KEY = "choseno_intro_video_seen_v1";

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

// Skeleton shared by every popup, top to bottom:
//   eyebrow (always the category line) -> headline (names a fear or asks a
//   question) -> pitch (safety + where the opinion goes) -> trust chips ->
//   founder badge line -> [Continue with Google] [Sign up with email].
// Only the headline, pitch and button text change per screen (CtaCopy below).
const MISSION_EYEBROW = "The social network for local politics";

// Small, one-line early-adopter nudge -- deliberately quiet so it never
// competes with the sign-up buttons.
const MISSION_BADGE_LINE = "Join early and earn a permanent Founder badge.";

type CtaCopy = {
  headline: string;
  pitch: string;
  sidebarHeadline: string;
  sidebarBody: string;
  cta: string;
};

const COPY: Record<MissionCtaVariant, CtaCopy> = {
  home: {
    headline: "Your political opinions deserve a voice.",
    pitch: "Share your views without your name being shown. No social pressure. No need to argue or reply.",
    sidebarHeadline: "Have a say in local politics.",
    sidebarBody: "Share your views anonymously. No replies required.",
    cta: "Share your opinion",
  },
  news: {
    headline: "What's your take on this story?",
    pitch: "Share your perspective anonymously. No need to argue or reply.",
    sidebarHeadline: "What's your take on this story?",
    sidebarBody: "Share your opinion anonymously.",
    cta: "Share your opinion",
  },
  district: {
    headline: "Make your voice count in your community.",
    pitch: "Discover your local representatives and share what matters to your neighbourhood.",
    sidebarHeadline: "What should local leaders know?",
    sidebarBody: "Make your voice heard in your community.",
    cta: "Have your say",
  },
  elections: {
    headline: "Which candidates have earned your support?",
    pitch: "Share your opinion without your name being shown. Every voice deserves a chance to be heard.",
    sidebarHeadline: "Which candidates have your support?",
    sidebarBody: "Share your views anonymously.",
    cta: "Share your opinion",
  },
  // Generic fallback when seatCopyFor below has no role_title to work with
  // (shouldn't happen in practice -- every seat has one).
  seat: {
    headline: "Who should represent your area?",
    pitch: "Share your views on the candidates in this race. It takes about 30 seconds to have your say.",
    sidebarHeadline: "Who should represent your area?",
    sidebarBody: "Have your say in this race.",
    cta: "Share your opinion",
  },
  candidate: {
    headline: "What do you think of this candidate?",
    pitch: "Share your thoughts on this candidate's ideas, priorities, and promises without your name being shown.",
    sidebarHeadline: "What do you think of this candidate?",
    sidebarBody: "Share your opinion anonymously.",
    cta: "Have your say",
  },
  politician: {
    headline: "Your representatives should hear from you.",
    pitch: "Share what you think about your representative and the issues that matter to you. Your name won't be displayed.",
    sidebarHeadline: "Is your representative delivering?",
    sidebarBody: "Share your views on their work and decisions.",
    cta: "Speak up",
  },
};

// Candidate / politician pages personalize on the person's name.
function personCopyFor(variant: "candidate" | "politician", personName?: string | null): CtaCopy {
  if (!personName) return COPY[variant];
  if (variant === "candidate") {
    return {
      headline: `What do you think of ${personName}?`,
      pitch: "Share your thoughts on this candidate's ideas, priorities, and promises without your name being shown.",
      sidebarHeadline: `What do you think of ${personName}?`,
      sidebarBody: "Share your opinion anonymously.",
      cta: "Have your say",
    };
  }
  return {
    headline: "Your representatives should hear from you.",
    pitch: `Share what you think about ${personName} and the issues that matter to you. Your name won't be displayed.`,
    sidebarHeadline: `Is ${personName} delivering?`,
    sidebarBody: "Share your views on their work and decisions.",
    cta: "Speak up",
  };
}

// Seat copy personalized to the specific office, e.g. "Mayor of Surrey".
// The one screen that pairs the pitch with an ask to share: a seat is one race
// that affects a whole neighborhood.
function seatCopyFor(roleTitle?: string | null, areaName?: string | null): CtaCopy {
  if (!roleTitle) return COPY.seat;
  return {
    headline: areaName ? `Who should represent ${areaName}?` : `Who should be your ${roleTitle}?`,
    pitch: `Share your views on the candidates for ${roleTitle}. It takes about 30 seconds to have your say.`,
    sidebarHeadline: areaName ? `Who should represent ${areaName}?` : `Who should be your ${roleTitle}?`,
    sidebarBody: "Have your say in this race.",
    cta: "Share your opinion",
  };
}

// News copy personalized to the article's key tagged politician, when known.
// Neutral on purpose: invites an opinion in either direction.
function newsCopyFor(personName?: string | null): CtaCopy {
  if (!personName) return COPY.news;
  return {
    headline: `What's your opinion of ${personName}?`,
    pitch: "Share what you think about their actions, ideas, and public record — without your name being shown.",
    sidebarHeadline: `What's your opinion of ${personName}?`,
    sidebarBody: "Share your opinion anonymously.",
    cta: "Share your view",
  };
}

const TRUST_CHIPS = [
  { icon: ShieldOff, label: "Your name stays private" },
  { icon: Ban, label: "No social pressure" },
  { icon: MessagesSquare, label: "No need to reply" },
];

// The one place the popup's sign-up buttons are defined, so the video modal and
// the mission modal always offer the same two ways in: Google first (one tap,
// opens the account picker), email second (the existing /auth sign-up page).
function MissionAuthButtons({
  cta,
  href,
  onEmailClick,
  onGoogleClick,
  googleBusy,
}: {
  cta: string;
  href: string;
  onEmailClick: () => void;
  onGoogleClick: () => void;
  googleBusy: boolean;
}) {
  return (
    <div className="w-full space-y-2">
      <Button
        type="button"
        variant="primary"
        disabled={googleBusy}
        onClick={onGoogleClick}
        data-signup-trigger={`${cta} (Google)`}
        className="w-full justify-center gap-2"
      >
        <GoogleMark />
        {googleBusy ? "Opening Google…" : "Continue with Google"}
      </Button>
      <Button
        as={Link}
        href={href}
        onClick={onEmailClick}
        data-signup-trigger={cta}
        variant="outline"
        className="w-full justify-center"
      >
        Sign up with email
      </Button>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export default function MissionRegisterCTA({
  variant,
  nextPath,
  personName,
  seatRoleTitle,
  seatAreaName,
  shareUrl,
  shareText,
  shareTrackingId,
}: {
  variant: MissionCtaVariant;
  nextPath?: string;
  // "news" variant only -- the article's key tagged politician's full name,
  // when known. Personalizes the CTA copy (see newsCopyFor); ignored for
  // every other variant.
  personName?: string | null;
  // "seat" variant only -- e.g. "Mayor" / "Surrey", to personalize the copy
  // via seatCopyFor. Ignored for every other variant.
  seatRoleTitle?: string | null;
  seatAreaName?: string | null;
  // When provided (any variant, but meant for "seat"), renders a secondary
  // "Share with neighbors" action alongside the primary CTA -- native share
  // sheet with a clipboard-copy fallback, same pattern PitchPlayer/ShareMenu
  // already use elsewhere. Omit to render no share button at all.
  shareUrl?: string;
  shareText?: string;
  shareTrackingId?: string;
}) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const resolvedNext = nextPath || pathname || "/";
  const [showModal, setShowModal] = useState(false);
  const [modalIsVideo, setModalIsVideo] = useState(false);
  const [sidebarDismissed, setSidebarDismissed] = useState(true); // starts hidden until localStorage check below, to avoid a flash
  const [shareCopied, setShareCopied] = useState(false);
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
      const isVideo = !window.localStorage.getItem(INTRO_VIDEO_SEEN_KEY);
      setModalIsVideo(isVideo);
      setShowModal(true);
      if (!modalShownRef.current) {
        modalShownRef.current = true;
        trackMissionCtaShown({ variant, trigger: isVideo ? "intro_video" : "modal" });
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

  // Gated-action opener (see openMissionPopup above): shows the popup now,
  // ignoring the once-per-window suppression and the scroll/time trigger,
  // but the first-ever popup is still the intro video.
  useEffect(() => {
    if (loading || user) return;
    const onOpen = (e: Event) => {
      e.preventDefault();
      // Still the first popup ever -> the intro video, same as the timed path.
      setModalIsVideo(!window.localStorage.getItem(INTRO_VIDEO_SEEN_KEY));
      setShowModal(true);
      trackMissionCtaShown({ variant, trigger: "gated_action" });
    };
    window.addEventListener(OPEN_MISSION_POPUP_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_MISSION_POPUP_EVENT, onOpen);
  }, [loading, user, variant]);

  const dismissModal = useCallback(() => {
    setShowModal(false);
    if (modalIsVideo) {
      window.localStorage.setItem(INTRO_VIDEO_SEEN_KEY, String(Date.now()));
      return;
    }
    markSeen(storageKey(MODAL_SEEN_PREFIX, variant));
  }, [variant, modalIsVideo]);

  const dismissSidebar = useCallback(() => {
    setSidebarDismissed(true);
    markSeen(storageKey(SIDEBAR_DISMISSED_PREFIX, variant));
  }, [variant]);

  const handleModalCtaClick = useCallback(() => {
    trackMissionCtaClicked({ variant, trigger: modalIsVideo ? "intro_video" : "modal" });
    dismissModal();
  }, [variant, modalIsVideo, dismissModal]);

  // Same call AuthPageClient's Google button makes (signInWithGoogle ->
  // /auth/callback?next=...), so Google's account picker opens immediately and
  // the visitor lands back on this page signed in. Attribution
  // (signup_source) is picked up by AuthContext after the redirect, as for
  // every other signup.
  const [googleBusy, setGoogleBusy] = useState(false);
  const handleGoogleClick = useCallback(async () => {
    setGoogleBusy(true);
    trackMissionCtaClicked({ variant, trigger: modalIsVideo ? "intro_video" : "modal" });
    try {
      trackSignUp("google");
      await signInWithGoogle(createClient(), resolvedNext);
    } catch (err: unknown) {
      const e = err as { error_description?: string; message?: string };
      trackSignUpFailed({ method: "google", reason: "google_oauth_error", message: e.error_description || e.message });
      setGoogleBusy(false);
    }
  }, [variant, modalIsVideo, resolvedNext]);

  const handleSidebarCtaClick = useCallback(() => {
    trackMissionCtaClicked({ variant, trigger: "sidebar" });
  }, [variant]);

  // Computed before handleShareClick (rather than after, by the other
  // derived consts below) so that callback's dependency array can name the
  // two string fields it actually uses instead of skipping them -- skipping
  // would leave handleShareClick's share-sheet text pinned to whichever
  // render first mounted it, silently stale once seatRoleTitle/personName
  // resolve from a null first paint to their real value.
  const copy =
    variant === "news"
      ? newsCopyFor(personName)
      : variant === "seat"
        ? seatCopyFor(seatRoleTitle, seatAreaName)
        : variant === "candidate" || variant === "politician"
          ? personCopyFor(variant, personName)
          : COPY[variant];

  // Native share sheet first (works on mobile browsers and lets the visitor
  // pick WhatsApp/Messages/etc. directly) -- falls back to copying the link
  // when navigator.share isn't available (most desktop browsers) or the
  // visitor dismisses the share sheet without picking anything. Never
  // throws either way, matching ShareMenu's handleNativeShareOrCopy.
  const handleShareClick = useCallback(async () => {
    if (!shareUrl) return;
    trackShare(`mission_cta_${variant}`, shareTrackingId);
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: copy.headline, text: shareText || copy.pitch, url: shareUrl });
        return;
      } catch {
        // Dismissed or unsupported -- fall through to copy.
      }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2500);
      } catch {
        // Clipboard permission denied -- nothing more we can do silently.
      }
    }
  }, [shareUrl, shareText, shareTrackingId, variant, copy.headline, copy.pitch]);

  if (loading || user) return null;

  const href = `/auth?role=citizen&next=${encodeURIComponent(resolvedNext)}`;

  return (
    <>
      {showModal && modalIsVideo && (
        <Modal onOverlayClick={dismissModal}>
          <Card padding="md" className="relative w-[92vw] max-w-sm !bg-surface shadow-2xl space-y-3 flex flex-col items-center !pt-10">
            <button
              type="button"
              onClick={dismissModal}
              aria-label="Close"
              className="absolute top-3.5 right-3.5 z-10 text-text-muted hover:text-text-main transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
            <IntroVideoPlayer url={INTRO_VIDEO_URL} autoPlay wide />
            <MissionAuthButtons cta={copy.cta} href={href} onEmailClick={handleModalCtaClick} onGoogleClick={handleGoogleClick} googleBusy={googleBusy} />
            <button
              type="button"
              onClick={dismissModal}
              className="text-xs font-semibold text-text-muted hover:text-text-main transition-colors cursor-pointer"
            >
              Close
            </button>
          </Card>
        </Modal>
      )}

      {showModal && !modalIsVideo && (
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
                <Sparkles size={12} /> {MISSION_EYEBROW}
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

            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-text-muted leading-snug">
              <Flag size={12} className="shrink-0 text-primary" />
              {MISSION_BADGE_LINE}
            </p>

            <div className="flex flex-col items-center gap-2 pt-1">
              <MissionAuthButtons cta={copy.cta} href={href} onEmailClick={handleModalCtaClick} onGoogleClick={handleGoogleClick} googleBusy={googleBusy} />
              {shareUrl && (
                <button
                  type="button"
                  onClick={handleShareClick}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer py-1"
                >
                  {shareCopied ? (
                    <>
                      <Check size={13} className="text-green-600" /> Link copied!
                    </>
                  ) : (
                    <>
                      <Share2 size={13} /> Share with your neighbors
                    </>
                  )}
                </button>
              )}
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
              {MISSION_BADGE_LINE}
            </p>
            <Button as={Link} href={href} onClick={handleSidebarCtaClick} size="sm" variant="primary" className="w-full justify-center">
              <span className="relative z-10">{copy.cta}</span>
            </Button>
            {shareUrl && (
              <button
                type="button"
                onClick={handleShareClick}
                className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer"
              >
                {shareCopied ? (
                  <>
                    <Check size={11} className="text-green-600" /> Link copied!
                  </>
                ) : (
                  <>
                    <Share2 size={11} /> Share with neighbors
                  </>
                )}
              </button>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
