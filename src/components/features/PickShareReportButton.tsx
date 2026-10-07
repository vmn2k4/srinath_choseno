"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { reportRacePickShare } from "@/lib/services/pickShares";

// Small "report" link for a shared pick page. Anonymous-friendly: the RPC
// dedupes by hashed network and hides the share after a few distinct reports.
export default function PickShareReportButton({ code }: { code: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");

  async function report() {
    setState("sending");
    await reportRacePickShare(createClient(), code);
    setState("done");
  }

  if (state === "done") return <span className="text-xs text-text-muted">Thanks — we&apos;ll review this share.</span>;
  return (
    <button
      type="button"
      onClick={report}
      disabled={state === "sending"}
      className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-main transition-colors cursor-pointer"
    >
      <Flag size={12} /> Report this share
    </button>
  );
}
