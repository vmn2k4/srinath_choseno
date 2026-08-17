"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/contexts/LanguageContext";
import { resetPasswordForEmail } from "@/lib/services/auth";
import { trackPasswordResetRequested } from "@/lib/analytics/events";
import { Card, Input, Button, Alert } from "@/components/primitives";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordClient({ nextPath }: { nextPath?: string }) {
  const { t } = useTranslation();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  // Always shown after a submit, whether or not the email actually has an
  // account -- resetPasswordForEmail succeeds either way (see auth.ts), so
  // reflecting that here avoids leaking which emails are registered.
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { error } = await resetPasswordForEmail(supabase, email, nextPath);
      if (error) throw error;
      trackPasswordResetRequested();
      setSent(true);
    } catch (err: unknown) {
      const errorObj = err as { error_description?: string; message?: string };
      setError(errorObj.error_description || errorObj.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto mt-10 sm:mt-14 px-4 pb-16">
      <Card padding="lg" className="shadow-2xl animate-fade-in border border-border-light/40">
        <h1 className="text-2xl font-extrabold text-text-main text-center">{t("auth.forgotPasswordTitle")}</h1>
        <p className="text-center text-sm text-text-muted mt-1.5 mb-6">{t("auth.forgotPasswordSubtitle")}</p>

        {sent ? (
          <Alert tone="success">{t("auth.forgotPasswordSent")}</Alert>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
                {t("auth.emailLabel")}
              </label>
              <Input
                type="email"
                placeholder={t("auth.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                autoFocus
              />
            </div>

            <Button type="submit" size="lg" disabled={loading} className="mt-2 w-full font-bold">
              {loading ? "Sending..." : t("auth.sendResetLinkBtn")}
            </Button>
          </form>
        )}

        {error && (
          <div className="mt-4">
            <Alert tone="danger">{error}</Alert>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link
            href={`/auth${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
            className="text-xs text-text-muted hover:text-text-main transition-colors font-semibold underline decoration-primary/40 underline-offset-4"
          >
            {t("auth.backToLogin")}
          </Link>
        </div>
      </Card>
    </div>
  );
}
