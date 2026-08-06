import { GoogleAnalytics as NextGoogleAnalytics } from "@next/third-parties/google";
import { GA_MEASUREMENT_ID } from "@/lib/constants/analytics";
import GlobalErrorListener from "./GlobalErrorListener";

// Loads gtag.js and wires window.dataLayer via @next/third-parties -- see
// node_modules/next/dist/docs/01-app/02-guides/third-party-libraries.md.
// Production-only, same gate as the dev-only tools in layout.tsx (inverted):
// GA shouldn't count localhost/dev traffic. Verify with `next build && next
// start` locally, not `next dev` (NODE_ENV is always "development" there).
export default function GoogleAnalytics() {
  if (process.env.NODE_ENV !== "production" || !GA_MEASUREMENT_ID) return null;
  return (
    <>
      <NextGoogleAnalytics gaId={GA_MEASUREMENT_ID} />
      <GlobalErrorListener />
    </>
  );
}
