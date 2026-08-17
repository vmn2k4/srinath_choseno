"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bug, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Dev-only tool — rendered from the root layout only when NODE_ENV !== "production" (see
// src/app/layout.tsx). Pairs with sql/seed_debug_personas.sql, which seeds these 8 fixed
// accounts directly in the database (no signup/onboarding UI needed to get a usable persona
// of each role). Not meant to ship: never import this from anything that runs in production.

const DEBUG_PASSWORD = process.env.NEXT_PUBLIC_DEBUG_PASSWORD || "";

const PERSONAS = [
  { email: "debug.candidate1@choseno.test", label: "Priya Nakamura", role: "Candidate" },
  { email: "debug.candidate2@choseno.test", label: "Marcus Whitfield", role: "Candidate" },
  { email: "debug.electionadmin@choseno.test", label: "Debug Election Admin", role: "Election Admin" },
  { email: "debug.citizen1@choseno.test", label: "Debug Citizen 1", role: "Citizen" },
  { email: "debug.citizen2@choseno.test", label: "Debug Citizen 2", role: "Citizen" },
  { email: "debug.citizen3@choseno.test", label: "Debug Citizen 3", role: "Citizen" },
  { email: "debug.citizen4@choseno.test", label: "Debug Citizen 4", role: "Citizen" },
  { email: "debug.citizen5@choseno.test", label: "Debug Citizen 5", role: "Citizen" },
] as const;

export default function DebugUserSwitcher() {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const { user } = useAuth();
  const supabase = createClient();
  const router = useRouter();

  const switchTo = async (email: string) => {
    setSwitching(email);
    await supabase.auth.signOut();
    const { error } = await supabase.auth.signInWithPassword({ email, password: DEBUG_PASSWORD });
    if (error) {
      alert(`Debug switch failed: ${error.message}\n\nRun sql/seed_debug_personas.sql against the dev DB first.`);
      setSwitching(null);
      return;
    }
    router.push("/feed");
    router.refresh();
  };

  const signOut = async () => {
    setSwitching("__signout__");
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div className="fixed bottom-4 left-4 z-debug font-sans">
      {open && (
        <div className="mb-2 w-72 rounded-2xl border border-border-light bg-surface shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border-light bg-surface-hover">
            <span className="text-xs font-bold text-text-main">Debug User Switcher</span>
            <button onClick={() => setOpen(false)} className="text-text-muted hover:text-text-main cursor-pointer">
              <X size={14} />
            </button>
          </div>
          <div className="px-3 py-2 text-[11px] text-text-muted border-b border-border-light">
            {user ? `Signed in: ${user.email}` : "Signed out"}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-border-light/50">
            {PERSONAS.map((p) => (
              <button
                key={p.email}
                onClick={() => switchTo(p.email)}
                disabled={switching !== null}
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-surface-hover disabled:opacity-50 cursor-pointer"
              >
                <span>
                  <span className="block text-xs font-semibold text-text-main">{p.label}</span>
                  <span className="block text-[10px] text-text-muted">{p.email}</span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wide text-primary-light">
                  {switching === p.email ? "…" : p.role}
                </span>
              </button>
            ))}
          </div>
          <button
            onClick={signOut}
            disabled={switching !== null}
            className="w-full px-3 py-2 text-xs font-semibold text-danger-light hover:bg-danger/10 border-t border-border-light disabled:opacity-50 cursor-pointer"
          >
            {switching === "__signout__" ? "Signing out…" : "Sign Out"}
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-11 h-11 rounded-full bg-primary text-text-on-primary shadow-lg flex items-center justify-center hover:bg-primary-hover cursor-pointer"
        title="Debug user switcher"
      >
        <Bug size={18} />
      </button>
    </div>
  );
}
