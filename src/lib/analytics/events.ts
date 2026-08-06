import { sendEvent } from "./gtag";

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

export function trackError(params: { errorType: string; message?: string; page?: string }) {
  sendEvent("error_occurred", {
    error_type: params.errorType,
    message: params.message?.slice(0, 150),
    page: params.page,
  });
}
