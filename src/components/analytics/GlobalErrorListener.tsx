"use client";

import { useEffect } from "react";
import { trackError } from "@/lib/analytics/events";

// error.tsx only catches render-time exceptions (React error boundaries
// don't see event-handler or async errors -- see the Next.js docs at
// node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md,
// "Nested error boundaries"). This catches the rest: uncaught exceptions in
// event handlers and unhandled promise rejections.
export default function GlobalErrorListener() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      trackError({
        errorType: "uncaught_exception",
        message: event.message,
        page: window.location.pathname,
      });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      trackError({
        errorType: "unhandled_rejection",
        message,
        page: window.location.pathname,
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
