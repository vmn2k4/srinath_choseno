import { supabase } from './supabase';
import { fetchWithCache, invalidateCache } from '../utils/apiCache';

export async function getPoliticalParties({ country } = {}) {
  return fetchWithCache(`political_parties:${country || 'all'}`, () => {
    let q = supabase.from('political_parties').select('id, name').order('rank');
    if (country) q = q.eq('country', country);
    return q;
  });
}

// Admin listing — includes country + rank columns.
export async function listPoliticalPartiesAllCountries() {
  return fetchWithCache('political_parties:all_admin', () =>
    supabase.from('political_parties').select('id, country, name, rank').order('country', { ascending: true }).order('rank', { ascending: true })
  );
}

export async function createPoliticalParty({ country, name, rank }) {
  invalidateCache('political_parties');
  return supabase.from('political_parties').insert({ country, name, rank: rank ?? 999 });
}

export async function deletePoliticalParty(partyId) {
  invalidateCache('political_parties');
  return supabase.from('political_parties').delete().eq('id', partyId);
}
