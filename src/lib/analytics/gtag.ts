import { sendGAEvent } from "@next/third-parties/google";
import { GA_MEASUREMENT_ID } from "@/lib/constants/analytics";

// Thin wrapper around @next/third-parties' sendGAEvent. That helper pushes
// straight to window.dataLayer (the <GoogleAnalytics> component from the
// same package owns dataLayer setup) -- it does NOT read window.gtag, so
// calling it before <GoogleAnalytics> has mounted just warns and no-ops,
// it never throws. Page views need no manual call: GA4 Enhanced Measurement
// tracks browser History API navigation automatically, which is what
// Next.js client-side routing uses.
export type GtagEventParams = Record<string, string | number | boolean | null | undefined>;

export function sendEvent(eventName: string, params?: GtagEventParams) {
  if (typeof window === "undefined" || !GA_MEASUREMENT_ID) return;
  sendGAEvent("event", eventName, params ?? {});
}
