"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/primitives";
import { trackError } from "@/lib/analytics/events";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    console.error(error);
    trackError({ errorType: "render_exception", message: error.message, page: pathname });
  }, [error, pathname]);

  return (
    <div className="w-full max-w-md mx-auto mt-16 px-4 text-center space-y-4">
      <h2 className="text-2xl font-extrabold text-text-main">Something went wrong</h2>
      <p className="text-sm text-text-muted">
        An unexpected error occurred. You can try again, or head back home if it persists.
      </p>
      <Button onClick={() => retry()}>Try again</Button>
    </div>
  );
}
