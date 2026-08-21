"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/LanguageContext";
import { updatePassword } from "@/lib/services/auth";
import { trackPasswordResetCompleted } from "@/lib/analytics/events";
import { Card, Input, Button, Alert, Spinner } from "@/components/primitives";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordClient({ nextPath }: { nextPath?: string }) {
  const { t } = useTranslation();
  const supabase = createClient();
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await updatePassword(supabase, password);
      if (error) throw error;
      trackPasswordResetCompleted();
      // The recovery session updateUser() just confirmed is now a regular
      // authenticated session -- send them straight into the app rather
      // than back through the login form.
      router.push(nextPath || "/feed");
      router.refresh();
    } catch (err: unknown) {
      const errorObj = err as { error_description?: string; message?: string };
      setError(errorObj.error_description || errorObj.message || "Couldn't update your password. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto mt-10 sm:mt-14 px-4 pb-16">
      <Card padding="lg" className="shadow-2xl animate-fade-in border border-border-light/40">
        <h1 className="text-2xl font-extrabold text-text-main text-center">{t("auth.resetPasswordTitle")}</h1>
        <p className="text-center text-sm text-text-muted mt-1.5">{t("auth.resetPasswordSubtitle")}</p>
        {/* Confirms which account this actually applies to -- useful for
            the ordinary "forgot password" case, and especially so for the
            invite-claim flow (/auth/confirm), which lands here via a link
            the person never typed an email into themselves. */}
        {session?.user?.email && (
          <p className="text-center text-sm font-semibold text-text-main mt-1 mb-6">{session.user.email}</p>
        )}
        {!session?.user?.email && <div className="mb-6" />}

        {authLoading ? (
          <Spinner fullPage />
        ) : !session ? (
          <>
            <Alert tone="danger">
              This password reset link is invalid or has expired. Request a new one below.
            </Alert>
            <div className="mt-6 text-center">
              <Link
                href="/auth/forgot-password"
                className="text-xs text-text-muted hover:text-text-main transition-colors font-semibold underline decoration-primary/40 underline-offset-4"
              >
                {t("auth.forgotPasswordLink")}
              </Link>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
                {t("auth.newPasswordLabel")}
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
                {t("auth.confirmPasswordLabel")}
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            <Button type="submit" size="lg" disabled={loading} className="mt-2 w-full font-bold">
              {loading ? "Updating..." : t("auth.updatePasswordBtn")}
            </Button>

            {error && <Alert tone="danger">{error}</Alert>}
          </form>
        )}
      </Card>
    </div>
  );
}
