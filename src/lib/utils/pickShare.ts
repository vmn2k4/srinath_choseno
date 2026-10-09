// Pure helpers for the "share my picks" feature (no I/O).

export interface PickRosterCandidate {
  id: string;
  name: string;
  avatarUrl: string | null;
  partyName: string | null;
  // politician profile id (for the Support button); null if unknown
  profileId?: string | null;
}

// Normalizes rows from getCandidatesBySeatIds (profiles is a to-one embed,
// politician_profiles / political_parties may come back as object or array).
export function toPickRoster(rows: any[]): PickRosterCandidate[] {
  const first = <T,>(v: T | T[] | null | undefined): T | undefined => (Array.isArray(v) ? v[0] : v ?? undefined);
  return (rows || []).map((c) => {
    const profile = first<any>(c.profiles);
    const pol = first<any>(profile?.politician_profiles);
    const party = first<any>(pol?.political_parties);
    return {
      id: c.id as string,
      name: (c.display_name || profile?.full_name || "Candidate") as string,
      avatarUrl: (pol?.avatar_url as string | null) || null,
      partyName: (c.party_name || party?.name || null) as string | null,
      profileId: (profile?.id as string | undefined) ?? null,
    };
  });
}

export interface PickedCandidate extends PickRosterCandidate {
  note: string | null;
}

// Picked candidates first (in the order the sharer chose, each carrying
// their own note), then the rest.
export function splitRoster(roster: PickRosterCandidate[], picks: { candidateId: string; note: string | null }[]) {
  const byId = new Map(roster.map((c) => [c.id, c]));
  const picked: PickedCandidate[] = [];
  for (const p of picks) {
    const c = byId.get(p.candidateId);
    if (c) picked.push({ ...c, note: p.note });
  }
  const pickedSet = new Set(picked.map((c) => c.id));
  const others = roster.filter((c) => !pickedSet.has(c.id));
  return { picked, others };
}

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] || "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export function pickSharePath(code: string): string {
  return `/p/${code}`;
}

// "2026-10-17" -> "Sat, Oct 17". Parses the parts directly (new Date("YYYY-MM-DD")
// is UTC and can shift a day).
export function formatElectionDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// ["2026-10-07","2026-10-10","2026-10-14"] -> "Oct 7, 10 & 14". Same-month days
// share one month label; different months are joined with " · ".
export function formatDateList(isoDates: string[]): string {
  const byMonth = new Map<string, number[]>();
  for (const iso of [...isoDates].sort()) {
    const [y, m, d] = iso.split("-").map(Number);
    const label = new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short" });
    byMonth.set(label, [...(byMonth.get(label) || []), d]);
  }
  return [...byMonth.entries()]
    .map(([month, days]) => {
      const list =
        days.length === 1 ? String(days[0]) : `${days.slice(0, -1).join(", ")} & ${days[days.length - 1]}`;
      return `${month} ${list}`;
    })
    .join(" · ");
}
