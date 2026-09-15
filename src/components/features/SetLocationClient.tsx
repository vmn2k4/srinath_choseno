"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { findBoundariesByPoint, syncUserBoundaryMemberships } from "@/lib/services/boundaries";
import { getOwnProfile, upsertProfileCore } from "@/lib/services/profile";
import InteractiveLocationPicker from "./InteractiveLocationPicker";
import { Card, Button, Alert } from "@/components/primitives";
import { Layers, Check, ArrowRight } from "lucide-react";

// The location-only counterpart to OnboardingFlowClient's StepLocation --
// same lookup/sync mechanics, but standalone: reached only via
// LocationRequiredGate's hard redirect for a candidate who claimed an
// interview invite (finalize_candidate_claim sets onboarding_completed=true
// directly, skipping the normal stepper's location step entirely -- see
// that gate's own comment for why zero boundary memberships + role
// 'politician' uniquely identifies this state). Not part of /onboarding
// itself: that flow's multi-step state machine assumes a brand-new account
// still choosing a role/name, which this candidate already has.
export default function SetLocationClient({ nextPath }: { nextPath?: string }) {
  const supabase = createClient();
  const { user } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState<string | null>(null);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [matchedBoundaries, setMatchedBoundaries] = useState<any[]>([]);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await getOwnProfile(supabase, user.id, { columns: "full_name" });
      setFullName((data as { full_name?: string | null } | null)?.full_name ?? null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const lookupBoundaries = async (latitude: number, longitude: number) => {
    setLocLoading(true);
    setLocError("");
    try {
      const { data: boundaries, error: rpcError } = await findBoundariesByPoint(supabase, latitude, longitude);
      if (rpcError) throw rpcError;

      const { error: syncError } = await syncUserBoundaryMemberships(supabase, latitude, longitude);
      if (syncError) throw syncError;

      setLat(latitude.toString());
      setLng(longitude.toString());
      setMatchedBoundaries(boundaries || []);

      if (!boundaries || boundaries.length === 0) {
        setLocError("No configured boundaries cover this location yet. You can still continue.");
      }
    } catch (err: unknown) {
      console.error(err);
      setLocError("Could not resolve location boundaries.");
    } finally {
      setLocLoading(false);
    }
  };

  const hasLocation = Boolean(lat && lng);

  const finish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const matchedNames = matchedBoundaries.map((b: any) => b.name).join(", ") || null;
      const derivedCountry = matchedBoundaries[0]?.country ?? null;
      // upsertProfileCore is a full-row upsert, not a partial update --
      // omitting fullName here would null out an already-set name (see the
      // function's own comment). role stays 'politician' unconditionally:
      // this page is only ever reached for that role (LocationRequiredGate
      // checks it before redirecting here).
      await upsertProfileCore(supabase, user.id, {
        role: "politician",
        fullName,
        country: derivedCountry,
        constituency: matchedNames,
      });
      router.push(nextPath || "/feed");
      router.refresh();
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  };

  return (
    <div className="w-full flex items-center justify-center py-6 sm:py-10 px-4">
      <Card padding="lg" className="w-full max-w-2xl space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-text-main mb-2">Set Your Location</h1>
          <p className="text-sm text-text-muted">
            One more thing before you continue — we need to know where you are so your race shows up in
            your district, and so citizens nearby can find you.
          </p>
        </div>

        <InteractiveLocationPicker
          currentLat={lat}
          currentLng={lng}
          onLocationSelect={lookupBoundaries}
          loading={locLoading}
          error={locError}
        />

        {matchedBoundaries.length > 0 && (
          <div className="p-4 bg-primary/10 border border-primary/30 rounded-2xl space-y-2">
            <p className="text-xs text-text-muted uppercase font-bold tracking-wider flex items-center gap-1.5">
              <Layers size={14} /> Verified in {matchedBoundaries.length}{" "}
              constituenc{matchedBoundaries.length > 1 ? "ies" : "y"}
            </p>
            <div className="flex flex-wrap gap-2">
              {matchedBoundaries.map((b: any) => (
                <span
                  key={b.id}
                  className="px-3 py-1 bg-surface-elevated border border-border-light/40 rounded-xl text-xs font-medium text-text-main flex items-center gap-1.5"
                >
                  <Check size={12} className="text-accent" /> {b.name}
                  {b.boundary_type && (
                    <span className="text-[10px] text-text-muted font-normal">({b.boundary_type})</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {locError && matchedBoundaries.length === 0 && <Alert tone="warning">{locError}</Alert>}

        <div className="flex justify-end pt-2 border-t border-border-light/20">
          <Button onClick={finish} disabled={!hasLocation || saving}>
            {saving ? "Saving..." : "Continue"} <ArrowRight size={18} className="ml-1" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
