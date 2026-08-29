export const SITE_URL = "https://www.choseno.com";
export const SITE_NAME = "Choseno";

// Single on/off switch for the representatives-list gating on
// HomeLocateWidget and FindMyDistrictClient (via BoundaryDirectoryClient's
// `gated` prop). Flip to false to instantly restore the old, fully-open
// behavior on both surfaces -- the old (ungated) code path is still there
// in both components, just short-circuited, so no need to revert any diff
// to turn this off. Deliberately NOT wired into /elections/[boundarySlug],
// which is SSR'd and indexed for "who represents me in X" search queries
// (see that page's own comments); gating a crawler-facing directory page
// would hurt the exact SEO it exists for regardless of this flag.
export const REP_LIST_GATING_ENABLED = true;

// Shared cap for the "representatives" teasers shown to signed-out visitors
// when REP_LIST_GATING_ENABLED is true. Signed-in visitors always see the
// full list on every surface, flag or no flag.
export const ANON_REP_PREVIEW_LIMIT = 3;

// Deliberately evergreen, no live founder count -- every signup gets a real
// tier badge regardless of when they join (First 1,000 / First 10,000 /
// Founding Member, see getFounderTier in profile.ts), so this stays true and
// doesn't look thin once growth passes small numbers. Shared by
// MissionRegisterCTA (home variant) and AuthPageClient's sign-up form --
// both used to fetch get_founder_count separately and show the raw number.
export const EARLY_EXPLORER_BADGE_LINE =
  "Be an early explorer — join now and earn a permanent Founder badge on your profile.";
