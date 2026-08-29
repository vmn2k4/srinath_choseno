import { sendEvent } from "./gtag";
import { createClient } from "@/lib/supabase/client";
import { logClientError, type ClientErrorType } from "@/lib/services/errorLog";
import { isDevEnvironment } from "@/lib/utils/environment";

// Wraps GA4's own recommended events (sign_up, login, search, share,
// select_content) where one exists -- these unlock GA4's built-in reports
// instead of only showing up as generic custom events. Everything without a
// GA4-recommended equivalent (posts, comments, district lookup, nav, errors)
// is a Choseno-specific custom event, snake_case to match GA4 convention.

export function trackSignUp(method: "email" | "google") {
  sendEvent("sign_up", { method });
}

export function trackLogin(method: "email" | "google" | "demo") {
  sendEvent("login", { method });
}

export function trackLogout() {
  sendEvent("logout");
}

export function trackPasswordResetRequested() {
  sendEvent("password_reset_requested");
}

export function trackPasswordResetCompleted() {
  sendEvent("password_reset_completed");
}

export function trackPostCreated(params: {
  hasImage: boolean;
  hasVideo: boolean;
  hasLink: boolean;
  contentLength: number;
}) {
  sendEvent("post_created", {
    has_image: params.hasImage,
    has_video: params.hasVideo,
    has_link: params.hasLink,
    content_length: params.contentLength,
  });
}

export function trackPostEngagement(action: "upvote" | "downvote", postId: string) {
  sendEvent("post_engagement", { action, post_id: postId });
}

export function trackCommentAdded(postId: string, commentLength: number) {
  sendEvent("comment_added", { post_id: postId, comment_length: commentLength });
}

export function trackFindDistrictCompleted(params: { found: boolean; boundaryCount: number }) {
  sendEvent("find_district_completed", {
    found: params.found,
    boundary_count: params.boundaryCount,
  });
}

export function trackElectionViewed(params: { seatId: string; roleTitle?: string | null; electionName?: string | null }) {
  sendEvent("election_viewed", {
    seat_id: params.seatId,
    role_title: params.roleTitle,
    election_name: params.electionName,
  });
}

export function trackPoliticianViewed(params: { ghostId: string; source: "wall" | "election_seat" }) {
  sendEvent("politician_viewed", { ghost_id: params.ghostId, source: params.source });
}

export function trackNewsArticleOpened(params: { slug: string; category?: string | null }) {
  sendEvent("news_article_opened", { slug: params.slug, category: params.category });
}

export function trackNavClick(destination: string) {
  sendEvent("nav_click", { destination });
}

export function trackSearch(searchTerm: string) {
  sendEvent("search", { search_term: searchTerm });
}

export function trackShare(contentType: string, itemId?: string) {
  sendEvent("share", { content_type: contentType, item_id: itemId });
}

export function trackSelectContent(contentType: string, itemId: string) {
  sendEvent("select_content", { content_type: contentType, item_id: itemId });
}

// MissionRegisterCTA's "Join the Mission" click -- the only anonymous->guest
// conversion touchpoint outside /auth itself. Without this there was no way
// to tell whether the CTA converts poorly because it doesn't get clicked
// (a trigger/placement problem) or gets clicked but drops off before
// completing signup at /auth (a form/friction problem) -- see
// MissionRegisterCTA.tsx for where this fires.
export function trackMissionCtaClicked(params: {
  variant: "home" | "news" | "district" | "elections";
  trigger: "modal" | "sidebar";
}) {
  sendEvent("mission_cta_clicked", { variant: params.variant, trigger: params.trigger });
}

// Impression counterpart to trackMissionCtaClicked -- without this, a click
// count alone can't distinguish "the CTA doesn't get shown much" from "it's
// shown plenty but nobody clicks it." Click-through rate = clicks /
// impressions needs both sides recorded.
export function trackMissionCtaShown(params: {
  variant: "home" | "news" | "district" | "elections";
  trigger: "modal" | "sidebar";
}) {
  sendEvent("mission_cta_shown", { variant: params.variant, trigger: params.trigger });
}

// Shown/clicked pair for the "N more representatives -- sign in to see the
// rest" gate on HomeLocateWidget and find-my-district's Chain of
// Representation (see ANON_REP_PREVIEW_LIMIT in lib/constants/site.ts).
// Mirrors trackMissionCtaShown/Clicked so this touchpoint's CTR is directly
// comparable to the mission CTA's -- two different hooks competing for the
// same signup, measured the same way.
export function trackRepListGateShown(params: {
  surface: "home_widget" | "find_my_district";
  hiddenCount: number;
}) {
  sendEvent("rep_list_gate_shown", { surface: params.surface, hidden_count: params.hiddenCount });
}

export function trackRepListGateClicked(params: {
  surface: "home_widget" | "find_my_district";
  hiddenCount: number;
}) {
  sendEvent("rep_list_gate_clicked", { surface: params.surface, hidden_count: params.hiddenCount });
}

// GA4's error_occurred stays as the aggregate volume/trend signal (shows up
// in the same reports as every other event). It can't carry the detail
// needed to actually fix something though -- message is truncated to 150
// chars below before GA4 even sees it, there's no stack-trace field, and
// error_type/message were never registered as GA4 custom dimensions so
// they're not even queryable via the Data API today (see
// analytics-live-data-pull-howto memory). client_error_logs (Supabase) is
// the detailed side: full message, stack, page, browser, viewport -- see
// 20260826000000_client_error_logs.sql.
//
// Never lets a failure here throw: this runs inside window.onerror /
// onunhandledrejection handlers, so an exception in the reporting path
// itself would recurse into those same handlers.
export function trackError(params: {
  errorType: ClientErrorType;
  message?: string;
  page?: string;
  stack?: string | null;
  digest?: string | null;
}) {
  sendEvent("error_occurred", {
    error_type: params.errorType,
    message: params.message?.slice(0, 150),
    page: params.page,
  });

  if (typeof window === "undefined") return;
  try {
    const supabase = createClient();
    void logClientError(supabase, {
      errorType: params.errorType,
      message: params.message || "(no message)",
      page: params.page || window.location.pathname,
      stack: params.stack ?? null,
      digest: params.digest ?? null,
      referrer: document.referrer || null,
      userAgent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      isTest: isDevEnvironment(),
    });
  } catch {
    // Swallow -- see note above.
  }
}
