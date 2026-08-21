"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { claimCandidacyViaToken } from "@/lib/services/elections";
import { buildCandidateSlug } from "@/lib/utils/slugs";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { Card, Button, Spinner } from "@/components/primitives";
import { createClient } from "@/lib/supabase/client";

interface ClaimCandidacyClientProps {
  token: string;
}

export default function ClaimCandidacyClient({
  token,
}: ClaimCandidacyClientProps) {
  const supabase = createClient();
  const router = useRouter();
  const [status, setStatus] = useState<"claiming" | "success" | "error">(
    "claiming"
  );
  const [error, setError] = useState("");
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    (async () => {
      const { data, error: claimError } = await claimCandidacyViaToken(
        supabase,
        token
      );
      if (claimError) {
        setError(claimError.message);
        setStatus("error");
        return;
      }
      setCandidateId(data.id);
      setStatus("success");
    })();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="w-full max-w-md mx-auto animate-fade-in py-20 px-4">
      <Card padding="lg" className="text-center">
        {status === "claiming" && (
          <>
            <Spinner />
            <p className="text-sm text-text-secondary mt-4">
              Claiming your candidacy...
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 size={32} className="text-success mx-auto mb-3" />
            <h1 className="text-lg font-bold text-text-main mb-2">
              Candidacy Claimed
            </h1>
            <p className="text-sm text-text-secondary mb-5">
              This campaign page is now yours. You can post updates, answer
              questionnaire questions, and manage everything from here.
            </p>
            {/* Straight into the video interview -- this is the "no account
                needed, just click the link" path described in
                docs/VIRTUAL_INTERVIEW_SYSTEM.md Gap 2. The claim itself
                already handled auth (Supabase's invite-email sign-in), so
                this is the first real action, not a second signup step. */}
            <Button
              onClick={() => router.push(`/apply/${candidateId}`)}
              className="w-full mb-2"
            >
              Answer Interview Questions
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                router.push(`/candidacy/${buildCandidateSlug({ id: candidateId! })}`)
              }
              className="w-full"
            >
              Go to My Campaign Page
            </Button>
          </>
        )}

        {status === "error" && (
          <>
            <ShieldAlert size={32} className="text-danger mx-auto mb-3" />
            <h1 className="text-lg font-bold text-text-main mb-2">
              Couldn&apos;t Claim This Candidacy
            </h1>
            <p className="text-sm text-text-secondary mb-5">{error}</p>
            <Button
              variant="outline"
              onClick={() => router.push("/elections")}
              className="w-full"
            >
              Browse Elections
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
