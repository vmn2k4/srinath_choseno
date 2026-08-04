"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Card from "./Card";

// New primitive — PoliticianWall's QR-code button was a hand-rolled
// absolutely-positioned <div> with no click-outside handling. One shared
// "anchored floating panel" component from here on; `anchor` is whatever
// trigger element opens it (a Button, typically), `open`/`onClose` are
// controlled by the caller.
export default function Popover({
  open,
  onClose,
  anchor,
  children,
  align = "left",
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  anchor: ReactNode;
  children?: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose]);

  return (
    <div className="relative inline-block" ref={ref}>
      {anchor}
      {open && (
        <Card
          variant="hero"
          padding="md"
          className={`absolute z-30 mt-2 min-w-[220px] ${align === "right" ? "right-0" : "left-0"} ${className}`.trim()}
        >
          {children}
        </Card>
      )}
    </div>
  );
}
