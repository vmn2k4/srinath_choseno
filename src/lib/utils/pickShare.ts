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
