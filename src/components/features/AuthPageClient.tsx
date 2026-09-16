"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/LanguageContext";
import { signUp, signInWithPassword, signInWithGoogle } from "@/lib/services/auth";
import { Card, Input, Button, Alert } from "@/components/primitives";
import { EARLY_EXPLORER_BADGE_LINE } from "@/lib/constants/site";
import { createClient } from "@/lib/supabase/client";
import { trackSignUp, trackLogin, trackSignUpFailed, trackSignUpAbandoned } from "@/lib/analytics/events";
import { Mail, Flag } from "lucide-react";

export default function AuthPageClient({
  initialRole,
  nextPath,
  initialIntent,
  initialError,
}: {
  initialRole?: "citizen" | "politician";
  nextPath?: string;
  initialIntent?: "login";
  initialError?: string;
}) {
  const { t } = useTranslation();
  const supabase = createClient();
  const router = useRouter();
  const { session, profile, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // An incoming ?error= (e.g. an expired "forgot password" link) always
  // means the user needs to log in or retry, not sign up.
  const [isSignUp, setIsSignUp] = useState(
    initialIntent === "login" || initialError ? false : Boolean(initialRole)
  );
  const [message, setMessage] = useState<{ type: "error" | "success" | ""; text: string }>(
    initialError
      ? {
          type: "error",
          text: "This link has expired or was already used. Enter your email below to request a new one.",
        }
      : { type: "", text: "" }
  );

  useEffect(() => {
    if (session && !authLoading && profile) {
      router.replace(nextPath || (profile.role === "admin" ? "/admin" : "/feed"));
    }
  }, [session, profile, authLoading, nextPath, router]);

  // Abandonment tracking: fires trackSignUpAbandoned only if (a) the visitor
  // actually typed into the sign-up form -- landing on the page and leaving
  // immediately isn't an "abandoned attempt", it's just a bounce, already
  // covered by GA4 page metrics -- and (b) no real outcome (success or a
  // tracked failure) was ever recorded for this visit. hasReportedOutcomeRef
  // is the guard against double-counting: every success/failure path below
  // sets it before this can fire. isSignUpRef mirrors the isSignUp state
  // into a ref so the listener (registered once, on mount) always reads the
  // current tab instead of closing over whichever value existed when the
  // listener was attached -- re-registering on every isSignUp toggle would
  // fire this on the toggle itself via the cleanup below, a false positive.
  const hasStartedFormRef = useRef(false);
  const hasReportedOutcomeRef = useRef(false);
  const isSignUpRef = useRef(isSignUp);
  useEffect(() => {
    isSignUpRef.current = isSignUp;
  }, [isSignUp]);

  useEffect(() => {
    const reportAbandonIfNeeded = () => {
      if (isSignUpRef.current && hasStartedFormRef.current && !hasReportedOutcomeRef.current) {
        hasReportedOutcomeRef.current = true; // guard first: pagehide + unmount cleanup can both fire for one real departure
        trackSignUpAbandoned("email");
      }
    };
    // pagehide (not beforeunload, which blocks the back/forward cache) covers
    // an actual tab close/reload; the cleanup below covers a Next.js
    // client-side navigation away, which never fires either browser event.
    window.addEventListener("pagehide", reportAbandonIfNeeded);
    return () => {
      window.removeEventListener("pagehide", reportAbandonIfNeeded);
      reportAbandonIfNeeded();
    };
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      if (isSignUp) {
        const { data, error } = await signUp(supabase, email, password, nextPath);
        if (error) throw error;
        // Supabase deliberately returns a fake "success" (not an error) when
        // the email is already registered, to avoid leaking which emails
        // have accounts. The tell is an empty identities array — a genuinely
        // new signup always gets exactly one. Surface this explicitly instead
        // of showing "check your email" for an email that will never get one.
        if (data?.user && data.user.identities?.length === 0) {
          hasReportedOutcomeRef.current = true;
          trackSignUpFailed({ method: "email", reason: "email_already_exists" });
          setIsSignUp(false);
          setMessage({
            type: "error",
            text: "An account with this email already exists. Log in instead, or use \"Forgot password\" if you don't remember it.",
          });
          return;
        }
        hasReportedOutcomeRef.current = true;
        trackSignUp("email");
        if (data?.session) {
          router.push(nextPath || (initialRole ? `/onboarding?role=${initialRole}` : "/onboarding"));
          router.refresh();
        } else {
          setMessage({
            type: "success",
            text: "Account created! Check your email for confirmation or log in.",
          });
        }
      } else {
        const { data, error } = await signInWithPassword(supabase, email, password);
        if (error) throw error;
        if (data?.session) {
          trackLogin("email");
          router.refresh();
        }
      }
    } catch (err: unknown) {
      const errorObj = err as { error_description?: string; message?: string };
      const text = errorObj.error_description || errorObj.message || "An unexpected error occurred.";
      if (isSignUp) {
        hasReportedOutcomeRef.current = true;
        trackSignUpFailed({ method: "email", reason: "validation_error", message: text });
      }
      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setMessage({ type: "", text: "" });
    try {
      // Fires here, not after redirect: the OAuth handoff leaves the page,
      // so this is the last point client-side JS runs in the flow. Marking
      // the outcome here too, for the same reason -- if signInWithGoogle
      // below throws (e.g. before the redirect even starts), the catch
      // tracks a failure for an attempt this line already counted as a
      // success. Accepted as-is: a thrown error here is rare (most failures
      // happen after the redirect, outside this component entirely), and
      // correcting the earlier trackSignUp call would need a bigger change
      // to how that success signal works than this task asked for.
      hasReportedOutcomeRef.current = true;
      if (isSignUp) trackSignUp("google");
      else trackLogin("google");
      await signInWithGoogle(supabase, nextPath);
    } catch (err: unknown) {
      const errorObj = err as { error_description?: string; message?: string };
      const text = errorObj.error_description || errorObj.message || "Google sign-in failed.";
      if (isSignUp) trackSignUpFailed({ method: "google", reason: "google_oauth_error", message: text });
      setMessage({ type: "error", text });
      setLoading(false);
    }
  };

  const handleDemoSignIn = async (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("password123");
    setLoading(true);
    setMessage({ type: "", text: "" });
    try {
      const { data, error } = await signInWithPassword(supabase, demoEmail, "password123");
      if (error) throw error;
      if (data?.session) {
        trackLogin("demo");
        router.push("/feed");
        router.refresh();
      }
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.message || "Demo login failed. Make sure test user exists or create an account above.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto mt-10 sm:mt-14 px-4 pb-16">
      <Card padding="lg" className="shadow-2xl animate-fade-in border border-border-light/40">
        <h1 className="text-2xl font-extrabold text-text-main text-center">
          {isSignUp ? t("auth.signUpBtn") : t("auth.title")}
        </h1>
        {isSignUp && initialRole && (
          <p className="text-center text-sm text-text-muted mt-1.5 mb-4">
            {initialRole === "citizen"
              ? "Setting up your citizen account — anonymous by default."
              : "Setting up your politician account — you'll add candidacy details next."}
          </p>
        )}
        {!(isSignUp && initialRole) && <div className="mb-6" />}

        {isSignUp && (
          <p className="flex items-start gap-1.5 text-[11px] font-semibold text-primary bg-primary/10 rounded-lg px-2.5 py-2 leading-snug mb-4">
            <Flag size={13} className="shrink-0 mt-0.5" />
            {EARLY_EXPLORER_BADGE_LINE}
          </p>
        )}

        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          <div>
            <label className="block mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
              {t("auth.emailLabel")}
            </label>
            <Input
              type="email"
              placeholder={t("auth.emailPlaceholder")}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (isSignUp) hasStartedFormRef.current = true;
              }}
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="block mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
              {t("auth.passwordLabel")}
            </label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (isSignUp) hasStartedFormRef.current = true;
              }}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              minLength={isSignUp ? 6 : undefined}
              required
            />
            {isSignUp && (
              <p className="mt-1.5 text-[11px] text-text-muted">At least 6 characters.</p>
            )}
          </div>

          {!isSignUp && (
            <div className="-mt-1 text-right">
              <Link
                href={`/auth/forgot-password${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
                className="text-xs text-text-muted hover:text-text-main transition-colors font-semibold"
              >
                {t("auth.forgotPasswordLink")}
              </Link>
            </div>
          )}

          <Button type="submit" size="lg" disabled={loading} className="mt-2 w-full font-bold">
            {loading ? "Processing..." : isSignUp ? t("auth.signUpBtn") : t("auth.signInBtn")}
          </Button>
        </form>

        {message.text && (
          <div className="mt-4">
            <Alert tone={message.type === "error" ? "danger" : "success"}>
              {message.text}
            </Alert>
          </div>
        )}

        {/* Divider */}
        <div className="mt-6 relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border-light/20"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-2 bg-surface text-text-muted">or</span>
          </div>
        </div>

        {/* Google Sign-In Button */}
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={loading}
          onClick={handleGoogleSignIn}
          className="mt-6 w-full font-bold flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Sign in with Google
        </Button>

        <div className="mt-6 text-center">
          <button
            type="button"
            className="text-xs text-text-muted hover:text-text-main transition-colors font-semibold cursor-pointer underline decoration-primary/40 underline-offset-4"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setMessage({ type: "", text: "" });
            }}
          >
            {isSignUp
              ? "Already have an account? Log In"
              : "Don't have an account? Sign Up"}
          </button>
        </div>

        {/* Quick Demo Logins for Fast Local Testing - Dev Only */}
        {process.env.NODE_ENV === "development" && (
          <div className="mt-8 pt-6 border-t border-border-light/20 text-center">
            <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3">
              Quick Local Demo Access
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDemoSignIn("voter@example.com")}
                disabled={loading}
                className="text-xs"
              >
                Demo Voter
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDemoSignIn("politician@example.com")}
                disabled={loading}
                className="text-xs"
              >
                Demo Politician
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDemoSignIn("admin@example.com")}
                disabled={loading}
                className="text-xs"
              >
                Demo Admin
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
