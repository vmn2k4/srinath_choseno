"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { captureSignupContext, noteClick } from "@/lib/analytics/signupSource";

// Renders nothing. Records first-touch + last-page-before-auth context so a
// later signup can be attributed (see 20261007000000_profile_signup_source.sql).
// Reads window.location.search directly instead of useSearchParams() so it
// doesn't force a Suspense boundary / dynamic rendering on every page.
export default function SignupSourceCapture() {
  const pathname = usePathname();
  useEffect(() => {
    captureSignupContext(pathname, window.location.search);
  }, [pathname]);
  // Capture-phase, passive: observes clicks without ever touching them.
  useEffect(() => {
    const onClick = (e: MouseEvent) => noteClick(e.target);
    document.addEventListener("click", onClick, { capture: true, passive: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);
  return null;
}
