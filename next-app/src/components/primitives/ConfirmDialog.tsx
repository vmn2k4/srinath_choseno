"use client";

import type { ReactNode } from "react";
import Modal from "./Modal";
import Card from "./Card";
import Button from "./Button";

// New primitive — every destructive action in the Vite app (burn identity
// x2, withdraw candidacy, delete boundary/election/seat/question, etc.)
// used the browser's native window.confirm(), which has no mobile-app
// equivalent (a real gap for the eventual Flutter port) and can't be
// styled/themed. One shared in-app confirm dialog from here on.
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: ReactNode;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <Modal onOverlayClick={onCancel}>
      <Card variant="hero" padding="lg" className="max-w-sm w-full">
        <h2 className="text-lg font-bold text-text-main mb-2">{title}</h2>
        {message && <p className="text-sm text-text-secondary mb-6">{message}</p>}
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Working..." : confirmLabel}
          </Button>
        </div>
      </Card>
    </Modal>
  );
}
