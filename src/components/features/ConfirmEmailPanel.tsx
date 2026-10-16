"use client";

import React, { useEffect, useRef, useState } from "react";
import { Mail } from "lucide-react";
import { Button, Input, Alert } from "@/components/primitives";
import { createClient } from "@/lib/supabase/client";
import { verifySignupCode, resendSignupEmail } from "@/lib/services/auth";

// Supabase's email-code length is a project setting (the live project issues
// 8 digits, local config says 6), so accept any length from 6 to 10 and let
// the server say whether it's right. Auto-submit once it looks complete.
const MIN_CODE_LENGTH = 6;
const MAX_CODE_LENGTH = 10;

// Supabase's "wait N seconds" answer to a too-soon resend/signup is a normal
// cooldown, not a failure.
function cooldownFrom(err: { message?: string; code?: string }): number | null {
  const m = err.message?.match(/after (\d+) seconds?/i);
  if (m && /for security purposes/i.test(err.message ?? "")) return Number(m[1]);
  if (err.code === "over_email_send_rate_limit") return 60;
  return null;
}

function friendlyVerifyError(err: { message?: string; code?: string }): string {
  const text = `${err.code ?? ""} ${err.message ?? ""}`.toLowerCase();
  // Supabase answers a wrong code and an expired one with the same error, so
  // say both rather than guessing which.
  if (text.includes("expired") || text.includes("invalid") || text.includes("otp")) {
    return "That code isn't right or has expired. Check the email, or tap “Resend code” for a new one.";
  }
  return err.message || "We couldn't confirm that code. Please try again.";
}

// Shown right after sign-up (and when someone with an unconfirmed email tries
// to log in): type the 6-digit code from the email instead of using the link,
// resend if it expired, or go back and fix the address.
export default function ConfirmEmailPanel({
  email,
  autoResend = false,
  onConfirmed,
  onChangeEmail,
}: {
  email: string;
  // True when we got here from a failed login on an unconfirmed email: send a
  // fresh code immediately so the user isn't left with an expired one.
  autoResend?: boolean;
  onConfirmed: () => void;
  onChangeEmail: () => void;
}) {
  const supabase = createClient();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(autoResend ? 0 : 60);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const didAutoResend = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const resend = async (silent = false) => {
    setBusy(true);
    const { error } = await resendSignupEmail(supabase, email);
    setBusy(false);
    if (error) {
      const wait = cooldownFrom(error);
      if (wait !== null) {
        setCooldown(wait);
        if (!silent) setMessage({ type: "error", text: `Please wait ${wait} seconds before requesting another code.` });
      } else {
        setMessage({ type: "error", text: error.message || "We couldn't send a new code. Please try again." });
      }
      return;
    }
    setCooldown(60);
    setMessage({ type: "success", text: `We sent a new code to ${email}. The previous code no longer works.` });
  };

  useEffect(() => {
    if (autoResend && !didAutoResend.current) {
      didAutoResend.current = true;
      void resend(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verify = async (value: string) => {
    if (value.length < MIN_CODE_LENGTH || busy) return;
    setBusy(true);
    setMessage(null);
    const { data, error } = await verifySignupCode(supabase, email, value);
    setBusy(false);
    if (error || !data?.session) {
      setMessage({ type: "error", text: friendlyVerifyError(error ?? {}) });
      return;
    }
    onConfirmed();
  };

  return (
    <div className="flex flex-col gap-4 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Mail size={22} />
      </div>
      <div>
        <h2 className="text-xl font-extrabold text-text-main">Check your email</h2>
        <p className="mt-1.5 text-sm text-text-muted">
          We sent a confirmation email to <strong className="text-text-main">{email}</strong>. Tap the button in it, or
          enter the code here.
        </p>
      </div>

      <Input
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={MAX_CODE_LENGTH + 2}
        placeholder="Code from the email"
        aria-label="Confirmation code"
        value={code}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, MAX_CODE_LENGTH);
          setCode(digits);
        }}
        className="text-center text-2xl font-bold tracking-[0.2em]"
      />

      <Button type="button" size="lg" className="w-full font-bold" disabled={busy || code.length < MIN_CODE_LENGTH} onClick={() => verify(code)}>
        {busy ? "Checking…" : "Confirm email"}
      </Button>

      {message && <Alert tone={message.type === "error" ? "danger" : "success"}>{message.text}</Alert>}

      <div className="flex flex-col items-center gap-2 text-xs font-semibold">
        <button
          type="button"
          disabled={busy || cooldown > 0}
          onClick={() => resend()}
          className="text-primary disabled:text-text-muted cursor-pointer disabled:cursor-not-allowed"
        >
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
        <button type="button" onClick={onChangeEmail} className="text-text-muted hover:text-text-main underline underline-offset-4 cursor-pointer">
          Wrong email? Start over
        </button>
        <p className="text-[11px] font-normal text-text-muted">Can’t find it? Check your spam folder.</p>
      </div>
    </div>
  );
}
