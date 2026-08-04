import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { fetchWithCache, invalidateCache } from "@/lib/utils/apiCache";

type Client = SupabaseClient<Database>;

export async function getPoliticalParties(supabase: Client, { country }: { country?: string } = {}) {
  return fetchWithCache(`political_parties:${country || "all"}`, () => {
    let q = supabase.from("political_parties").select("id, name").order("rank");
    if (country) q = q.eq("country", country);
    return q;
  });
}

// Admin listing — includes country + rank columns.
export async function listPoliticalPartiesAllCountries(supabase: Client) {
  return fetchWithCache("political_parties:all_admin", () =>
    supabase
      .from("political_parties")
      .select("id, country, name, rank")
      .order("country", { ascending: true })
      .order("rank", { ascending: true })
  );
}

export async function createPoliticalParty(
  supabase: Client,
  { country, name, rank }: { country: string; name: string; rank?: number }
) {
  invalidateCache("political_parties");
  return supabase.from("political_parties").insert({ country, name, rank: rank ?? 999 });
}

export async function deletePoliticalParty(supabase: Client, partyId: number) {
  invalidateCache("political_parties");
  return supabase.from("political_parties").delete().eq("id", partyId);
}
