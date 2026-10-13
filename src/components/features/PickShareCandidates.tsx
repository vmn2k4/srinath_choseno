"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Share2 } from "lucide-react";
import { Card, Avatar, Button } from "@/components/primitives";
import PickShareDialog from "./PickShareDialog";
import { SupportControl, useCandidateSupport } from "./CandidateSupport";
import { buildCandidateSlug } from "@/lib/utils/slugs";
import type { PickedCandidate, PickRosterCandidate } from "@/lib/utils/pickShare";

// The candidate cards on a shared-picks page: who the sharer supports, then
// "Who's your pick?" with every OTHER candidate in the race. Each candidate
// has the same Heart "Support" button used on the race page, and the
// visitor can start their own share (tap "Pick" on a candidate, or
// "Share your pick") without leaving the page.
export default function PickShareCandidates({
  seat,
  authorName,
  seatSlug,
  picked,
  others,
}: {
  seat: { id: string; role_title?: string | null; map_shapes?: { name?: string | null } | null };
  authorName: string;
  seatSlug: string;
  picked: PickedCandidate[];
  others: PickRosterCandidate[];
}) {
  const [open, setOpen] = useState(false);
  const [initialPicked, setInitialPicked] = useState<string[]>([]);
  const roster = useMemo(() => [...picked, ...others], [picked, others]);
  const profileIds = useMemo(
    () => roster.map((c) => c.profileId).filter((id): id is string => Boolean(id)),
    [roster]
  );
  const support = useCandidateSupport(profileIds);

  const profileHref = (c: PickRosterCandidate) =>
    `/elections/seat/${seatSlug}/candidate/${buildCandidateSlug({ id: c.id, profiles: { full_name: c.name } })}`;

  const start = (ids: string[]) => {
    setInitialPicked(ids);
    setOpen(true);
  };

  return (
    <>
      <Card padding="md" className="space-y-3">
        <h2 className="text-sm font-bold text-text-main">Candidates {authorName} supports</h2>
        <ul className="space-y-2">
          {picked.map((c) => (
            <li
              key={c.id}
              className="flex items-start gap-3 rounded-xl border border-primary/40 bg-primary/5 p-3"
            >
              <Link href={profileHref(c)} className="shrink-0">
                <Avatar src={c.avatarUrl} name={c.name} size="md" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={profileHref(c)} className="block font-bold text-text-main truncate hover:text-primary hover:underline">
                  {c.name}
                </Link>
                {c.partyName && <p className="text-xs text-text-muted truncate">{c.partyName}</p>}
                {c.note && <p className="mt-1 text-sm italic text-text-main">“{c.note}”</p>}
              </div>
              <SupportControl c={c} support={support} />
            </li>
          ))}
        </ul>
      </Card>

      <Card padding="md" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-bold text-text-main">Who&apos;s your pick?</p>
            <p className="text-xs text-text-muted">
              {others.length > 0
                ? "Support a candidate, or tap Pick to start sharing your own picks."
                : "Share your own picks from this race."}
            </p>
          </div>
          <Button type="button" className="gap-2 shrink-0" onClick={() => start([])}>
            <Share2 size={16} /> Share your pick
          </Button>
        </div>

        {others.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">
              Other candidates ({others.length})
            </h3>
            <ul className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
              {others.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-3 rounded-xl border border-border-light/40 bg-surface/20 p-2.5"
                >
                  <Link href={profileHref(c)} className="shrink-0">
                    <Avatar src={c.avatarUrl} name={c.name} size="sm" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={profileHref(c)} className="block text-sm font-bold text-text-main truncate hover:text-primary hover:underline">
                      {c.name}
                    </Link>
                    {c.partyName && <p className="text-xs text-text-muted truncate">{c.partyName}</p>}
                  </div>
                  <SupportControl c={c} support={support} />
                  <button
                    type="button"
                    onClick={() => start([c.id])}
                    className="shrink-0 text-xs font-semibold text-primary hover:text-primary-hover cursor-pointer"
                    title={`Pick ${c.name}`}
                  >
                    Pick
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {open && (
        <PickShareDialog
          seat={seat}
          roster={roster}
          initialPickedIds={initialPicked}
          onEngagementAdded={(r) => support.markSupported(r.supportedProfileIds)}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
