import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { fetchWithCache } from "@/lib/utils/apiCache";

type Client = SupabaseClient<Database>;

export interface VotingPlaceSchedule {
  voting_type: "advance" | "general" | "special";
  vote_date: string;
  opens_at: string | null;
  closes_at: string | null;
  notes: string | null;
}

export interface VotingPlace {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  source_url: string | null;
  last_checked_at: string;
  voting_place_schedules: VotingPlaceSchedule[];
}

// voting_places / voting_place_schedules — public-read tables, tagged by
// election_name + election_date, attached to a municipality via map_shape_id.
// Not in the generated types yet, so the table name is cast.
export async function getVotingPlacesForShape(
  supabase: Client,
  mapShapeId: number,
  electionDate: string
) {
  return fetchWithCache(`votingPlaces:${mapShapeId}:${electionDate}`, async () => {
    const res = await (supabase as any)
      .from("voting_places")
      .select(
        "id, name, address, lat, lng, notes, source_url, last_checked_at, voting_place_schedules(voting_type, vote_date, opens_at, closes_at, notes)"
      )
      .eq("map_shape_id", mapShapeId)
      .eq("election_date", electionDate)
      .order("name");
    return res as { data: VotingPlace[] | null; error: unknown };
  });
}

// Which of these boundaries have published voting places, and for which
// election date(s) — lets pages that only know a visitor's matched boundaries
// (e.g. Find My District) decide what to render without loading every place.
export async function getVotingPlaceDatesForShapes(supabase: Client, mapShapeIds: number[]) {
  if (mapShapeIds.length === 0) return { data: [] as { map_shape_id: number; election_date: string }[], error: null };
  const key = `votingPlaceDates:${[...mapShapeIds].sort((a, b) => a - b).join(",")}`;
  return fetchWithCache(key, async () => {
    const res = await (supabase as any)
      .from("voting_places")
      .select("map_shape_id, election_date")
      .in("map_shape_id", mapShapeIds)
      .gte("election_date", new Date().toISOString().slice(0, 10));
    const seen = new Set<string>();
    const rows = ((res.data as { map_shape_id: number; election_date: string }[]) || []).filter((r) => {
      const k = `${r.map_shape_id}|${r.election_date}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return { data: rows, error: res.error as unknown };
  });
}
