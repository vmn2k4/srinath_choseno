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
