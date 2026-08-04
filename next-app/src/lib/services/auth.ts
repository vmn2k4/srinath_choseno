import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

export async function signUp(supabase: Client, email: string, password: string) {
  return supabase.auth.signUp({ email, password });
}

export async function signInWithPassword(supabase: Client, email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut(supabase: Client) {
  return supabase.auth.signOut();
}

export async function getSession(supabase: Client) {
  return supabase.auth.getSession();
}

export function onAuthStateChange(
  supabase: Client,
  callback: Parameters<Client["auth"]["onAuthStateChange"]>[0]
) {
  return supabase.auth.onAuthStateChange(callback);
}
