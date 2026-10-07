"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { Button } from "@/components/primitives";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { getPoliticianEngagementSummaries } from "@/lib/services/ratings";
import {
  addSupport,
  withdrawSupport,
  addAnonymousSupport,
  withdrawAnonymousSupport,
  getMySupportedPoliticianIds,
  getMyAnonymousSupportedPoliticianIds,
} from "@/lib/services/politicianWall";
import { getAnonymousSupportSettings } from "@/lib/services/settings";
import { useAnonSupporterId } from "@/lib/utils/anonSupporter";

// ── The Heart "Support" button, shared ──────────────────────────────────
// Same button, services and optimistic update the Results poll on the seat
// page uses (ElectionSeatPageClient.handleToggleSupport): writes
// politician_supporters, or anonymous_supporters for logged-out visitors
// (subject to the admin kill switch). Extracted from PartyRosterClient so
// every list of candidates can show it without another copy of this logic.

export type SupportCandidate = { profileId?: string | null; name: string };

export interface SupportApi {
  counts: Map<string, number>;
  mine: Set<string>;
  toggle: (c: SupportCandidate) => void;
}

// State + handlers for a set of politician profile ids.
export function useCandidateSupport(profileIds: string[]): SupportApi {
  const supabase = useMemo(() => createClient(), []);
  const { user } = useAuth();
  const router = useRouter();
  const anonId = useAnonSupporterId();
  const [anonymousSupportEnabled, setAnonymousSupportEnabled] = useState(false);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [mine, setMine] = useState<Set<string>>(new Set());

  // Supporter counts: same batched RPC the seat page's Results poll uses.
  useEffect(() => {
    let live = true;
    (async () => {
      const next = new Map<string, number>();
      for (let i = 0; i < profileIds.length; i += 150) {
        const { data } = await getPoliticianEngagementSummaries(supabase, profileIds.slice(i, i + 150));
        ((data as { politician_id: string; supporter_count: number }[]) || []).forEach((row) =>
          next.set(row.politician_id, row.supporter_count || 0)
        );
      }
      if (live) setCounts(next);
    })();
    return () => {
      live = false;
    };
  }, [profileIds, supabase]);

  useEffect(() => {
    let live = true;
    getAnonymousSupportSettings(supabase).then(({ data }) => {
      if (live) setAnonymousSupportEnabled(!!data?.anonymous_support_enabled);
    });
    return () => {
      live = false;
    };
  }, [supabase]);

  // Which of these the viewer already supports.
  useEffect(() => {
    let live = true;
    if (profileIds.length === 0) return;
    (async () => {
      const found = new Set<string>();
      for (let i = 0; i < profileIds.length; i += 150) {
        const chunk = profileIds.slice(i, i + 150);
        if (user) {
          const { data } = await getMySupportedPoliticianIds(supabase, chunk, user.id);
          (data || []).forEach((id: string) => found.add(id));
        } else if (anonymousSupportEnabled && anonId) {
          const { data } = await getMyAnonymousSupportedPoliticianIds(supabase, chunk, anonId);
          (data || []).forEach((id: string) => found.add(id));
        }
      }
      if (live) setMine(found);
    })();
    return () => {
      live = false;
    };
  }, [profileIds, user, anonId, anonymousSupportEnabled, supabase]);

  // Same optimistic toggle as ElectionSeatPageClient.handleToggleSupport.
  const toggle = async (c: SupportCandidate) => {
    const politicianId = c.profileId;
    if (!politicianId) return;
    if (!user && (!anonymousSupportEnabled || !anonId)) {
      router.push("/auth");
      return;
    }
    const isSupporting = mine.has(politicianId);
    const apply = (delta: number, supporting: boolean) => {
      setMine((prev) => {
        const next = new Set(prev);
        if (supporting) next.add(politicianId);
        else next.delete(politicianId);
        return next;
      });
      setCounts((prev) => new Map(prev).set(politicianId, Math.max(0, (prev.get(politicianId) ?? 0) + delta)));
    };
    apply(isSupporting ? -1 : 1, !isSupporting);

    if (user) {
      if (isSupporting) await withdrawSupport(supabase, politicianId, user.id);
      else await addSupport(supabase, politicianId, user.id);
    } else if (anonId) {
      if (isSupporting) await withdrawAnonymousSupport(supabase, politicianId, anonId);
      else {
        const { error } = await addAnonymousSupport(supabase, politicianId, anonId);
        if (error) apply(-1, false); // rejected (feature off / rate limit): roll back
      }
    }
  };

  return { counts, mine, toggle };
}

export function SupportControl({ c, support }: { c: SupportCandidate; support: SupportApi }) {
  if (!c.profileId) return null;
  const isSupporting = support.mine.has(c.profileId);
  const count = support.counts.get(c.profileId) ?? 0;
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <Button
        type="button"
        variant={isSupporting ? "primary" : "outline"}
        size="sm"
        className={`gap-1.5 !px-2.5 !py-1 text-xs font-bold ${isSupporting ? "" : "!border-2"}`}
        style={
          isSupporting
            ? { backgroundColor: "var(--color-success)", color: "white", borderColor: "var(--color-success)" }
            : {
                borderColor: "var(--color-success)",
                color: "var(--color-success)",
                backgroundColor: "color-mix(in srgb, var(--color-success) 10%, transparent)",
              }
        }
        onClick={() => support.toggle(c)}
        title={isSupporting ? `Withdraw your support for ${c.name}` : `Cast your support for ${c.name}`}
        aria-pressed={isSupporting}
      >
        <Heart size={12} className={isSupporting ? "fill-current" : ""} />
        <span className="hidden lg:inline">{isSupporting ? "Supported" : "Support"}</span>
      </Button>
      <span
        className="flex items-center gap-0.5 text-xs tabular-nums text-text-muted"
        title={`${count} ${count === 1 ? "person supports" : "people support"} ${c.name}`}
      >
        <Heart size={10} /> {count}
      </span>
    </div>
  );
}
