import { Spinner } from "@/components/primitives";

// Shown instantly on navigation while the page's server-side data fetch is
// still in flight, instead of leaving the browser on a blank/frozen tab.
// Matches the <Spinner fullPage /> convention already used for client-side
// loading states throughout the app (see Spinner.tsx).
export default function Loading() {
  return <Spinner fullPage />;
}
