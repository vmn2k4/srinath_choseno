// Measurement ID for the GA4 property. Public by design (it's embedded in
// client-side script tags), sourced from env so it's swappable per
// environment without a code change.
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";
