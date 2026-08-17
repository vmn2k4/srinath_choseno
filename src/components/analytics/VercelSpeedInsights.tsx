import { SpeedInsights } from "@vercel/speed-insights/next";

// Vercel Speed Insights -- same reasoning as VercelAnalytics.tsx (this
// folder): no production gate needed, it only actually reports Core Web
// Vitals when served from Vercel's own infrastructure, so it's already
// inert in local dev and on any non-Vercel host.
export default function VercelSpeedInsights() {
  return <SpeedInsights />;
}
