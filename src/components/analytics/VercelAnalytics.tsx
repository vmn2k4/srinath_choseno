import { Analytics } from "@vercel/analytics/next";

// Vercel Web Analytics -- unlike GoogleAnalytics.tsx (this folder), this
// isn't gated to production only: the <Analytics/> component only actually
// sends beacons when served from Vercel's own infrastructure (it posts to
// /_vercel/insights/view, which only exists on a real Vercel deployment),
// so it's already a no-op in local dev and on any non-Vercel host.
export default function VercelAnalytics() {
  return <Analytics />;
}
