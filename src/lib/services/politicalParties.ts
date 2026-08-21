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

// A profile's saved political_party_id can belong to a different country than
// the party list the edit form otherwise shows (e.g. a boundary/officeholder
// data mismatch) -- in which case it's invisible in a country-filtered
// getPoliticalParties() list even though it's genuinely saved. Callers use
// this to look that specific party up by id so it can still be shown/selected
// rather than silently rendering as "no party chosen".
export async function getPoliticalPartyById(supabase: Client, partyId: number) {
  return supabase.from("political_parties").select("id, name, country").eq("id", partyId).maybeSingle();
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

// Resolves a party name to its id, creating the row if this country doesn't
// have one under that name yet -- e.g. for pre-filling a stub candidate's
// party from a search result's plain-text party_name (search_politicians_and_officeholders
// returns text, not an id, since it also matches office_holders rows that
// were never normalized against political_parties). Admin-only (the RPC
// itself enforces this), matching create_claim_invite's own posture.
export async function getOrCreatePoliticalParty(supabase: Client, country: string, name: string) {
  return supabase.rpc("get_or_create_political_party", { p_country: country, p_name: name });
}

export async function deletePoliticalParty(supabase: Client, partyId: number) {
  invalidateCache("political_parties");
  return supabase.from("political_parties").delete().eq("id", partyId);
}
