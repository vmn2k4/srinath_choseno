import { supabase } from './supabase';

export async function getPoliticalParties({ country } = {}) {
  let q = supabase.from('political_parties').select('id, name').order('rank');
  if (country) q = q.eq('country', country);
  return q;
}

// Admin listing — includes country + rank columns.
export async function listPoliticalPartiesAllCountries() {
  return supabase.from('political_parties').select('id, country, name, rank').order('country', { ascending: true }).order('rank', { ascending: true });
}

export async function createPoliticalParty({ country, name, rank }) {
  return supabase.from('political_parties').insert({ country, name, rank: rank ?? 999 });
}

export async function deletePoliticalParty(partyId) {
  return supabase.from('political_parties').delete().eq('id', partyId);
}
