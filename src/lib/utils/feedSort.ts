// Shared feed sorting utilities used across FeedPageClient, PoliticianWallClient,
// and CandidacyWall -- allows users to toggle between recency and engagement ordering.

export function sortByEngagement<T extends { likes_count?: number | null; comments?: unknown[] | null }>(
  list: T[]
): T[] {
  return [...list].sort((a, b) => {
    const scoreA = (a.likes_count ?? 0) + (a.comments?.length ?? 0);
    const scoreB = (b.likes_count ?? 0) + (b.comments?.length ?? 0);
    return scoreB - scoreA;
  });
}

// Role-based default: politicians default to engagement sort, everyone else
// to recency (matching historical behavior, now user-overridable).
export function defaultSortMode(role: string | null | undefined): "recency" | "engagement" {
  return role === "politician" ? "engagement" : "recency";
}
