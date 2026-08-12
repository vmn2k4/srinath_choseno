"use client";

import { useState, type ReactNode } from "react";
import Modal from "./Modal";
import Card from "./Card";
import Button from "./Button";
import Textarea from "./Textarea";

// Text-input counterpart to ConfirmDialog — same reasoning applies:
// window.prompt() has no mobile-app equivalent, can't be themed, and in some
// embedded/sandboxed runtimes (e.g. certain preview iframes) throws outright
// ("prompt() is not supported") instead of merely looking out of place. One
// shared in-app prompt dialog for every "give a reason" action (reject,
// reverse, etc.) from here on.
export default function PromptDialog({
  open,
  title,
  message,
  placeholder,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: ReactNode;
  message?: ReactNode;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  // Reset the draft each time the dialog transitions from closed to open —
  // otherwise a leftover reason from the previous claim would silently
  // prefill the next one. Adjusting state during render (React's documented
  // alternative to an Effect for "reset on prop change") rather than
  // setState-in-an-effect, which triggers an extra render pass.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setValue("");
  }

  if (!open) return null;

  const trimmed = value.trim();

  return (
    <Modal onOverlayClick={onCancel}>
      <Card variant="hero" padding="lg" className="max-w-sm w-full">
        <h2 className="text-lg font-bold text-text-main mb-2">{title}</h2>
        {message && <p className="text-sm text-text-secondary mb-3">{message}</p>}
        <Textarea
          autoFocus
          rows={3}
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={loading}
          className="mb-6"
        />
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant="danger"
            onClick={() => onConfirm(trimmed)}
            disabled={loading || !trimmed}
          >
            {loading ? "Working..." : confirmLabel}
          </Button>
        </div>
      </Card>
    </Modal>
  );
}
