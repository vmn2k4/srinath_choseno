"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { signUp, signInWithPassword, signInWithGoogle } from "@/lib/services/auth";
import { Card, Input, Button, Alert } from "@/components/primitives";
import { createClient } from "@/lib/supabase/client";
import { trackSignUp, trackLogin } from "@/lib/analytics/events";
import { Mail } from "lucide-react";

export default function AuthPageClient({
  initialRole,
  nextPath,
}: {
  initialRole?: "citizen" | "politician";
  nextPath?: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const { session, profile, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(Boolean(initialRole));
  const [message, setMessage] = useState<{ type: "error" | "success" | ""; text: string }>({
    type: "",
    text: "",
  });

  useEffect(() => {
    if (session && !authLoading && profile) {
      router.replace(nextPath || (profile.role === "admin" ? "/admin" : "/feed"));
    }
  }, [session, profile, authLoading, nextPath, router]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      if (isSignUp) {
        const { data, error } = await signUp(supabase, email, password);
        if (error) throw error;
        trackSignUp("email");
        if (data?.session) {
          router.push(initialRole ? `/onboarding?role=${initialRole}` : "/onboarding");
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
      setMessage({
        type: "error",
        text: errorObj.error_description || errorObj.message || "An unexpected error occurred.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setMessage({ type: "", text: "" });
    try {
      // Fires here, not after redirect: the OAuth handoff leaves the page,
      // so this is the last point client-side JS runs in the flow.
      if (isSignUp) trackSignUp("google");
      else trackLogin("google");
      await signInWithGoogle(supabase);
    } catch (err: unknown) {
      const errorObj = err as { error_description?: string; message?: string };
      setMessage({
        type: "error",
        text: errorObj.error_description || errorObj.message || "Google sign-in failed.",
      });
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
          {isSignUp ? "Create an Account" : "Welcome Back"}
        </h1>
        {isSignUp && initialRole && (
          <p className="text-center text-sm text-text-muted mt-1.5 mb-4">
            {initialRole === "citizen"
              ? "Setting up your citizen account — anonymous by default."
              : "Setting up your politician account — you'll add candidacy details next."}
          </p>
        )}
        {!(isSignUp && initialRole) && <div className="mb-6" />}

        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          <div>
            <label className="block mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
              Email Address
            </label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="block mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
              Password
            </label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              required
            />
          </div>

          <Button type="submit" size="lg" disabled={loading} className="mt-2 w-full font-bold">
            {loading ? "Processing..." : isSignUp ? "Sign Up" : "Log In"}
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
