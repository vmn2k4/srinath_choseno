"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { googleCalendarUrl, icsDataUrl, type CalendarEvent } from "@/lib/utils/calendar";

export interface CalendarOption {
  /** Shown in the menu, e.g. "Sat, Oct 17 · 8am–8pm". */
  label: string;
  event: CalendarEvent;
}

// One "Add to calendar" button that opens a menu: every date offered, each
// with Google Calendar and .ics (Apple / Outlook) links.
export default function AddToCalendarMenu({ options }: { options: CalendarOption[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (ev: MouseEvent) => {
      if (!ref.current?.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (options.length === 0) return null;

  return (
    // `contents` lets the button and the menu panel both sit directly in the
    // parent's flex-wrap row, so the panel drops onto its own full-width line
    // inside the card instead of floating out (and getting clipped by a
    // scrolling side rail).
    <span ref={ref} className="contents">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-1 rounded-full border border-accent/40 px-3 py-1 text-sm font-semibold text-accent hover:bg-accent hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <CalendarPlus size={14} aria-hidden="true" />
        Add to calendar
      </button>
      {open && (
        <span role="menu" className="flex basis-full flex-col rounded-lg border border-border bg-surface-hover/40 p-2 text-sm">
          {options.map((o) => (
            <span key={`${o.event.date}-${o.label}`} className="flex flex-col gap-1 border-b border-border/60 px-1 py-2 last:border-b-0">
              <span className="font-medium text-text-main">{o.label}</span>
              <span className="flex gap-3">
                <a
                  role="menuitem"
                  href={googleCalendarUrl(o.event)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="text-accent hover:underline"
                >
                  Google
                </a>
                <a
                  role="menuitem"
                  href={icsDataUrl(o.event)}
                  download={`vote-${o.event.date}.ics`}
                  onClick={() => setOpen(false)}
                  className="text-accent hover:underline"
                >
                  Apple / Outlook
                </a>
              </span>
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
