"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { deleteMyAccount } from "@/lib/services/auth";

export default function DeleteAccountClient() {
  const { user, loading, signOut } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (loading) return null;

  if (done) {
    return <p className="rounded-xl border border-border p-4 text-text-main">Your account has been deleted.</p>;
  }

  if (!user) {
    return (
      <p className="rounded-xl border border-border p-4 text-text-muted">
        <Link href="/auth?next=/delete-account" className="text-primary hover:underline">
          Sign in
        </Link>{" "}
        to delete your account.
      </p>
    );
  }

  const onDelete = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await deleteMyAccount(createClient());
    if (err) {
      setError(err.message);
      setBusy(false);
      return;
    }
    await signOut().catch(() => {});
    setDone(true);
  };

  return (
    <div className="rounded-xl border border-danger/40 p-4 space-y-3">
      <p className="text-text-main font-semibold">Signed in as {user.email}</p>
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white"
        >
          Delete my account
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-text-muted">This is permanent and cannot be undone.</p>
          <div className="flex gap-2">
            <button
              onClick={onDelete}
              disabled={busy}
              className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Deleting…" : "Yes, delete forever"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="rounded-lg border border-border px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
