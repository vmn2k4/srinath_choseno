"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getOwnProfile, getUserBoundaryShapeIds } from "@/lib/services/profile";
import { createClient } from "@/lib/supabase/client";

// A candidate who claims their candidacy through the interview-invite flow
// (see finalize_candidate_claim in 20260802000001_candidacy_claims.sql) gets
// profiles.onboarding_completed = true set directly, skipping the normal
// /onboarding stepper entirely -- that's deliberate, it's what lets them go
// straight to the interview instead of re-answering "who are you" onboarding
// already knows from the stub. But it also means they never go through
// StepLocation, so user_boundary_memberships stays empty forever: no "seats
// near you", no local feed, nothing that depends on knowing where they are.
// A normal signup can't end up in this state -- StepLocation's Continue
// button is disabled until a location resolves to at least one boundary
// (or the admin/onboarding flow explicitly allows continuing with none),
// so "politician, onboarded, zero boundary memberships" only ever happens
// via the claim shortcut. That combination is what this gate looks for.
//
// Hard-gates every navigation (not just a dismissible banner) per product
// decision 2026-09-14 -- until location is set, any route other than the
// explicit exemptions below bounces to /set-location.
const EXEMPT_PREFIXES = ["/set-location", "/auth", "/onboarding", "/apply", "/logout"];

function isExempt(pathname: string) {
  return EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default function LocationRequiredGate({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  // null = not checked yet this session. Checked once per signed-in user,
  // not on every navigation -- only the exemption check below needs to
  // re-run per pathname.
  const [needsLocation, setNeedsLocation] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (authLoading) return;
    if (!user) {
      setNeedsLocation(false);
      return;
    }

    (async () => {
      const { data: profile } = await getOwnProfile(supabase, user.id, { columns: "role" });
      if (cancelled) return;
      const role = (profile as { role?: string } | null)?.role;
      if (role !== "politician") {
        setNeedsLocation(false);
        return;
      }
      const { data: shapes } = await getUserBoundaryShapeIds(supabase, user.id);
      if (cancelled) return;
      setNeedsLocation(!shapes || shapes.length === 0);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);

  useEffect(() => {
    if (needsLocation && !isExempt(pathname)) {
      router.replace(`/set-location?next=${encodeURIComponent(pathname)}`);
    }
  }, [needsLocation, pathname, router]);

  return <>{children}</>;
}
