import { supabase } from './supabase';
import { fetchWithCache, invalidateCache } from '../utils/apiCache';

// site_settings — single-row table holding the active site-wide color theme.
export async function getSiteTheme() {
  return fetchWithCache('site_settings:theme', () =>
    supabase.from('site_settings').select('theme').eq('id', 1).single()
  );
}

export async function updateSiteTheme(theme) {
  invalidateCache('site_settings:theme');
  return supabase.from('site_settings').update({ theme, updated_at: new Date().toISOString() }).eq('id', 1);
}
