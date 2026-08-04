"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { signUp, signInWithPassword } from "@/lib/services/auth";
import { Card, Input, Button, Alert } from "@/components/primitives";
import { createClient } from "@/lib/supabase/client";

export default function AuthPageClient() {
  const supabase = createClient();
  const router = useRouter();
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success" | ""; text: string }>({
    type: "",
    text: "",
  });

  useEffect(() => {
    if (session) {
      router.replace("/feed");
    }
  }, [session, router]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      if (isSignUp) {
        const { data, error } = await signUp(supabase, email, password);
        if (error) throw error;
        if (data?.session) {
          router.push("/onboarding");
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
          router.push("/feed");
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

  const handleDemoSignIn = async (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("password123");
    setLoading(true);
    setMessage({ type: "", text: "" });
    try {
      const { data, error } = await signInWithPassword(supabase, demoEmail, "password123");
      if (error) throw error;
      if (data?.session) {
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
        <h2 className="text-2xl font-extrabold text-text-main mb-6 text-center">
          {isSignUp ? "Create an Account" : "Welcome Back"}
        </h2>

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

        {/* Quick Demo Logins for Fast Local Testing */}
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
      </Card>
    </div>
  );
}
