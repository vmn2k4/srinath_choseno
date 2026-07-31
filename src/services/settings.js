import { supabase } from './supabase';

// site_settings — single-row table holding the active site-wide color theme.
export async function getSiteTheme() {
  return supabase.from('site_settings').select('theme').eq('id', 1).single();
}

export async function updateSiteTheme(theme) {
  return supabase.from('site_settings').update({ theme, updated_at: new Date().toISOString() }).eq('id', 1);
}
