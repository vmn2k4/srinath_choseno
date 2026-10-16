"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { Smartphone, Globe } from "lucide-react";
import { Card, Button } from "@/components/primitives";

// "Open in the Choseno app" for mobile sign-ups, with the browser as a
// fallback (no app installed, or opened on a computer). Both buttons are plain
// links so nothing is confirmed until the person chooses.
export default function OpenAppPrompt({ tokenHash, type }: { tokenHash: string; type: string }) {
  const appUrl = `choseno://auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(type)}`;
  const browserUrl = `/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(type)}`;

  // Best-effort automatic hand-off on phones; harmless if the app isn't
  // installed (the browser just stays here and the buttons remain).
  useEffect(() => {
    if (!tokenHash) return;
    const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    if (!isMobile) return;
    const t = window.setTimeout(() => {
      window.location.href = appUrl;
    }, 400);
    return () => window.clearTimeout(t);
  }, [tokenHash, appUrl]);

  if (!tokenHash) {
    return (
      <div className="w-full max-w-md mx-auto mt-14 px-4 pb-16">
        <Card padding="lg" className="text-center">
          <h1 className="text-xl font-extrabold text-text-main">This link isn&apos;t valid</h1>
          <p className="mt-2 text-sm text-text-muted">It may be incomplete. Open the Choseno app and request a new code.</p>
          <Link href="/auth" className="mt-4 inline-block text-sm font-semibold text-primary">
            Go to sign in
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto mt-14 px-4 pb-16">
      <Card padding="lg" className="text-center flex flex-col gap-4">
        <h1 className="text-2xl font-extrabold text-text-main">
          {type === "recovery" ? "Reset your password" : "Confirm your email"}
        </h1>
        <p className="text-sm text-text-muted">
          {type === "recovery"
            ? "Tap below to open the Choseno app and choose a new password."
            : "You signed up in the Choseno app, so we'll finish there. Tap below to open it and you'll be signed in."}
        </p>
        <a href={appUrl} className="block">
          <Button type="button" size="lg" className="w-full font-bold gap-2">
            <Smartphone size={18} /> Open the Choseno app
          </Button>
        </a>
        <p className="text-xs text-text-muted">Nothing happening? You can also type the 6-digit code from the email into the app.</p>
        <div className="border-t border-border-light/30 pt-4">
          <p className="mb-2 text-xs text-text-muted">On a computer, or don&apos;t have the app?</p>
          <a href={browserUrl}>
            <Button type="button" variant="outline" className="gap-2">
              <Globe size={16} /> Continue in your browser instead
            </Button>
          </a>
        </div>
      </Card>
    </div>
  );
}
