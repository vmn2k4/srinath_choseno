"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { Card, Button, Spinner } from "@/components/primitives";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { redeemOfficeholderWallClaim } from "@/lib/services/elections";

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default function OfficeholderClaimClient({ token }: { token: string }) {
  const supabase = createClient();
  const router = useRouter();
  const { session, loading } = useAuth();
  const [state, setState] = useState<"waiting" | "claiming" | "success" | "error">("waiting");
  const [error, setError] = useState("");
  const attempted = useRef(false);

  useEffect(() => {
    if (loading || !session || attempted.current) return;
    attempted.current = true;
    setState("claiming");
    (async () => {
      const { error: claimError } = await redeemOfficeholderWallClaim(supabase, await hashToken(token));
      if (claimError) {
        setError(claimError.message);
        setState("error");
      } else {
        setState("success");
      }
    })();
  }, [loading, session, token]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="w-full max-w-md mx-auto animate-fade-in py-20 px-4">
      <Card padding="lg" className="text-center">
        {!session && !loading && state === "waiting" && (
          <>
            <h1 className="text-lg font-bold text-text-main mb-2">Sign in to claim this wall</h1>
            <p className="text-sm text-text-secondary mb-5">Use the Choseno account that should own this officeholder wall, then return to this link.</p>
            <Button onClick={() => router.push("/auth?role=politician")} className="w-full">Sign in or sign up</Button>
          </>
        )}
        {(loading || state === "claiming") && <><Spinner /><p className="text-sm text-text-secondary mt-4">Verifying your claim...</p></>}
        {state === "success" && <><CheckCircle2 size={32} className="text-success mx-auto mb-3" /><h1 className="text-lg font-bold text-text-main mb-2">Claim submitted</h1><p className="text-sm text-text-secondary mb-5">Your identity is verified. An administrator will review and merge the imported wall.</p><Button onClick={() => router.push("/profile")} className="w-full">Go to my profile</Button></>}
        {state === "error" && <><ShieldAlert size={32} className="text-danger mx-auto mb-3" /><h1 className="text-lg font-bold text-text-main mb-2">Couldn&apos;t verify this claim</h1><p className="text-sm text-text-secondary mb-5">{error}</p><Button variant="outline" onClick={() => router.push("/")} className="w-full">Return home</Button></>}
      </Card>
    </div>
  );
}
