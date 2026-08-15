// Shared by PoliticianWallClient and CandidacyWall: merges a wall owner's
// own authored/wall posts with posts where they were only @mentioned by
// someone else (getWallPosts/getCandidacyWallPosts + getMentionedWallPosts
// are two independently-fetched sections, same pattern as the 3-way feed
// fetch in FeedPageClient), deduped by id (a mention could double as an
// owner post if they tagged themselves) and re-sorted newest-first.
export function mergeWallPosts<T extends { id: string; created_at?: string | null }>(
  authored: T[],
  mentioned: T[]
): { merged: T[]; mentionOnlyIds: Set<string> } {
  const byId = new Map<string, T>();
  for (const p of authored) byId.set(p.id, p);
  const mentionOnlyIds = new Set<string>();
  for (const p of mentioned) {
    if (!byId.has(p.id)) {
      byId.set(p.id, p);
      mentionOnlyIds.add(p.id);
    }
  }
  const merged = [...byId.values()].sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );
  return { merged, mentionOnlyIds };
}
