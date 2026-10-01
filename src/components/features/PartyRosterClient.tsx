"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Swords, Flag, ArrowUpRight, Heart } from "lucide-react";
import { Card, Avatar, Badge, Button, Input, EmptyState } from "@/components/primitives";
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
import ShareMenu, { type ShareData } from "@/components/features/ShareMenu";
import { SITE_URL } from "@/lib/constants/site";
import { useAnonSupporterId } from "@/lib/utils/anonSupporter";
import { partyTone, UNAFFILIATED_LABEL, type ChipCandidate, type PartyRace, type PartyView } from "@/lib/utils/electionParties";

// ── Support (the existing Heart "Support" button) ───────────────────────
// Same button, same services and same optimistic update the Results poll on
// the seat page uses (ElectionSeatPageClient.handleToggleSupport) -- writes
// politician_supporters (or anonymous_supporters for logged-out visitors).
interface SupportApi {
  counts: Map<string, number>;
  mine: Set<string>;
  toggle: (c: ChipCandidate) => void;
}

function SupportControl({ c, support }: { c: ChipCandidate; support: SupportApi }) {
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

// One floating bio card for the whole page (fixed-positioned from the
// hovered chip's rect) -- rows use content-visibility, which would clip a
// per-chip absolutely-positioned popover.
interface HoverState {
  c: ChipCandidate;
  rect: DOMRect;
}

function BioHoverCard({ hover, support }: { hover: HoverState; support: SupportApi }) {
  const { c, rect } = hover;
  const tone = partyTone(c.partyName, c.partyId);
  const W = 320;
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - W - 8));
  const below = rect.bottom + 8 + 220 < window.innerHeight;
  const count = c.profileId ? support.counts.get(c.profileId) ?? 0 : 0;
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50"
      style={{ left, width: W, ...(below ? { top: rect.bottom + 8 } : { bottom: window.innerHeight - rect.top + 8 }) }}
    >
      {/* Opaque (!bg-surface) on purpose: this floats over dense rows, where the
          default translucent glass fill let the content underneath bleed through. */}
      <Card variant="hero" padding="sm" className={`!bg-surface border shadow-2xl ${tone.border}`}>
        <div className="flex items-center gap-3">
          <Avatar src={c.avatarUrl} name={c.name} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-text-main">{c.name}</p>
            <p className={`truncate text-xs font-semibold ${tone.text}`}>{c.partyName || UNAFFILIATED_LABEL}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-text-muted">
              <Heart size={11} /> {count} {count === 1 ? "supporter" : "supporters"}
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-text-secondary">
          {c.bio || "No bio has been added for this candidate yet."}
        </p>
      </Card>
    </div>
  );
}

interface ChipProps {
  c: ChipCandidate;
  size?: "sm" | "md";
  support: SupportApi;
  onHover: (h: HoverState | null) => void;
}

function CandidateChip({ c, size = "sm", support, onHover }: ChipProps) {
  const tone = partyTone(c.partyName, c.partyId);
  const show = (e: React.SyntheticEvent<HTMLElement>) => onHover({ c, rect: e.currentTarget.getBoundingClientRect() });
  return (
    <div className={`inline-flex max-w-full items-center gap-2 rounded-xl border bg-surface/40 py-1 pl-1 pr-2 ${tone.border}`}>
      <Link
        href={c.href}
        onMouseEnter={show}
        onFocus={show}
        onMouseLeave={() => onHover(null)}
        onBlur={() => onHover(null)}
        className="group/chip flex min-w-0 items-center gap-2 rounded-lg transition-colors hover:bg-surface-hover"
        aria-label={`${c.name}, ${c.partyName || UNAFFILIATED_LABEL}`}
      >
        <Avatar src={c.avatarUrl} name={c.name} size={size} />
        <span className="min-w-0 pr-1 leading-tight">
          <span className="block truncate text-sm font-semibold text-text-main">{c.name}</span>
          <span className={`block truncate text-[11px] font-medium ${tone.text}`}>{c.partyName || UNAFFILIATED_LABEL}</span>
        </span>
      </Link>
      <SupportControl c={c} support={support} />
    </div>
  );
}

// Share payload for one race -- same ShareMenu and same post conventions as
// the seat page's "Share This Race" (ElectionResultsPanel): no emojis,
// candidate names as inline hashtags, and the real seat-page URL.
function buildRaceShareData(race: PartyRace): ShareData {
  const url = `${SITE_URL}${race.seatHref}`;
  const area = race.areaName || race.roleTitle;
  const cleanTag = (t: string) => t.replace(/[^a-zA-Z0-9]/g, "");
  const everyone = [...race.mine, ...race.rivals];
  const listed = everyone.slice(0, 6);
  const hidden = everyone.length - listed.length;
  const basePostText =
    `Choseno — ${race.roleTitle} | ${area}\n\n` +
    (everyone.length > 0
      ? `On the ballot: ${listed.map((c) => `#${cleanTag(c.name)}`).join(", ")}${hidden > 0 ? ` & ${hidden} more` : ""}\n\n`
      : "") +
    "See the candidates, show your support and join the conversation:";
  const hashtags = Array.from(new Set([cleanTag(race.roleTitle) || "Election", cleanTag(area), "Election", "Choseno"].filter(Boolean)));
  const hashtagList = hashtags.map((t) => `#${t}`).join(" ");
  return {
    url,
    basePostText,
    hashtagList,
    shareText: `${basePostText}\n\n${hashtagList}\n${url}`,
    hashtags,
    twitterUrl: `https://twitter.com/intent/tweet?text=${encodeURIComponent(basePostText)}&url=${encodeURIComponent(url)}&hashtags=${encodeURIComponent(hashtags.join(","))}`,
  };
}

function RaceRow({
  race,
  partyName,
  partyId,
  support,
  onHover,
}: {
  race: PartyRace;
  partyName: string;
  partyId: number | null;
  support: SupportApi;
  onHover: (h: HoverState | null) => void;
}) {
  const tone = partyTone(partyName, partyId);
  return (
    <Card
      variant="row"
      padding="none"
      // Off-screen rows skip layout/paint -- every race is in the HTML for
      // crawlers, but a 500-row party page still scrolls smoothly.
      className="overflow-hidden [content-visibility:auto] [contain-intrinsic-size:auto_150px]"
    >
      <div className="flex">
        <div className={`w-1 shrink-0 ${tone.bar}`} aria-hidden />
        <div className="min-w-0 flex-1 p-4">
          {/* Heading row: race name + share button, role underneath */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-border-light/30 pb-3">
            <Link
              href={race.seatHref}
              className="group/seat inline-flex min-w-0 items-center gap-1 text-lg font-bold text-text-main hover:text-primary"
            >
              <span className="truncate">{race.areaName || race.roleTitle}</span>
              <ArrowUpRight size={15} className="shrink-0 opacity-0 transition-opacity group-hover/seat:opacity-100" />
            </Link>
            <ShareMenu
              articleId={race.seatId}
              shareData={buildRaceShareData(race)}
              triggerTitle={`Share the ${race.areaName || race.roleTitle} race`}
              shareTitle={`${race.roleTitle} — ${race.areaName || race.roleTitle}`}
              iconSize={15}
              className="flex cursor-pointer items-center rounded-lg p-1.5 text-text-muted transition-colors hover:bg-primary/10 hover:text-primary"
            />
            <span className="text-xs text-text-muted sm:ml-auto">{race.roleTitle}</span>
          </div>

          {/* Body: this party's candidate on the left, who they face on the right */}
          <div className="grid gap-4 pt-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] md:items-start">
            <div className="min-w-0">
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                <Flag size={12} /> Running
              </p>
              <div className="flex flex-wrap gap-2">
                {race.mine.map((c) => (
                  <CandidateChip key={c.id} c={c} size="md" support={support} onHover={onHover} />
                ))}
              </div>
            </div>

            <div className="min-w-0">
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                <Swords size={12} /> Facing
              </p>
              {race.rivals.length === 0 ? (
                <p className="text-sm text-text-muted">No other candidates yet</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {race.rivals.map((c) => (
                    <CandidateChip key={c.id} c={c} support={support} onHover={onHover} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function PartyRosterClient({
  partyName,
  partyId,
  view,
  rivalHrefs,
}: {
  partyName: string;
  partyId: number | null;
  view: PartyView;
  /** party slug -> that party's page in this election, for the rival chips */
  rivalHrefs: Record<string, string>;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { user } = useAuth();
  const router = useRouter();
  const anonId = useAnonSupporterId();
  const [anonymousSupportEnabled, setAnonymousSupportEnabled] = useState(false);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<HoverState | null>(null);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  // Every politician shown on the page (this party's candidates + rivals).
  const profileIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of view.races) for (const c of [...r.mine, ...r.rivals]) if (c.profileId) ids.add(c.profileId);
    return [...ids];
  }, [view.races]);

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
  const toggle = async (c: ChipCandidate) => {
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

  const support: SupportApi = { counts, mine, toggle };

  // Every race and every open riding is server-rendered into the HTML (so
  // crawlers see all of it); search only toggles which ones are shown.
  const visibleRace = useMemo(() => {
    const set = new Set<string>();
    for (const r of view.races) {
      if (
        !q ||
        r.areaName.toLowerCase().includes(q) ||
        r.mine.some((c) => c.name.toLowerCase().includes(q)) ||
        r.rivals.some((c) => c.name.toLowerCase().includes(q) || (c.partyName || "").toLowerCase().includes(q))
      )
        set.add(r.seatId);
    }
    return set;
  }, [view.races, q]);
  const visibleOpen = useMemo(
    () => new Set(view.uncontested.filter((s) => !q || s.areaName.toLowerCase().includes(q)).map((s) => s.seatId)),
    [view.uncontested, q]
  );

  return (
    <div className="space-y-8">
      {hover && <BioHoverCard hover={hover} support={support} />}
      {view.rivals.length > 0 && (
        <section aria-label="Main competitors">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">Most often facing</h2>
          <div className="flex flex-wrap gap-2">
            {view.rivals.slice(0, 8).map((r) => {
              const tone = partyTone(r.name, r.id);
              return (
                <Link
                  key={r.slug}
                  href={rivalHrefs[r.slug] || "#"}
                  className={`inline-flex items-center gap-2 rounded-full border bg-surface/40 px-3 py-1.5 text-sm transition-colors hover:bg-surface-hover ${tone.border}`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${tone.bar}`} aria-hidden />
                  <span className="font-semibold text-text-main">{r.name}</span>
                  <Badge size="2xs" uppercase={false}>
                    {r.races} {r.races === 1 ? "race" : "races"}
                  </Badge>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <div className="relative w-full sm:max-w-sm">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <Input
          size="sm"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search riding, candidate or rival party"
          aria-label="Search races"
          className="pl-9"
        />
      </div>

      <section aria-labelledby="races-heading" className="space-y-3">
        <h2 id="races-heading" className="text-xl font-bold text-text-main">
          Where {partyName} is running <span className="text-text-muted">({view.races.length})</span>
        </h2>
        {q && visibleRace.size === 0 && (
          <EmptyState icon={Search} title="No races match" description="Try a different riding, candidate or party name." />
        )}
        {view.races.map((r) => (
          <div key={r.seatId} hidden={!visibleRace.has(r.seatId)}>
            <RaceRow race={r} partyName={partyName} partyId={partyId} support={support} onHover={setHover} />
          </div>
        ))}
      </section>

      {view.uncontested.length > 0 && (
        <section aria-labelledby="open-heading" className="space-y-3">
          <h2 id="open-heading" className="text-xl font-bold text-text-main">
            No {partyName} candidate yet <span className="text-text-muted">({view.uncontested.length})</span>
          </h2>
          <Card padding="sm">
            <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
              {view.uncontested.map((s) => (
                <li key={s.seatId} hidden={!visibleOpen.has(s.seatId)}>
                  <Link
                    href={s.seatHref}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-main"
                  >
                    <span className="truncate">{s.areaName || s.roleTitle}</span>
                    <ArrowUpRight size={14} className="shrink-0 text-text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </div>
  );
}
