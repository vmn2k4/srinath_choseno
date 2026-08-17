import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

export async function signUp(supabase: Client, email: string, password: string, nextPath?: string) {
  const emailRedirectTo = nextPath
    ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
    : undefined;
  return supabase.auth.signUp({
    email,
    password,
    options: emailRedirectTo ? { emailRedirectTo } : undefined,
  });
}

export async function signInWithPassword(supabase: Client, email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signInWithGoogle(supabase: Client, nextPath?: string) {
  const redirectUrl = `${window.location.origin}/auth/callback${
    nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""
  }`;
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectUrl,
    },
  });
}

export async function signOut(supabase: Client) {
  return supabase.auth.signOut();
}

// Sends the "reset your password" email. Supabase deliberately returns
// success here even when no account exists for the email (unlike signUp's
// identities-array tell) -- there's no equivalent leak to work around, so
// the caller can always show the same "check your email" message.
// redirectTo goes through the same /auth/callback code-exchange route as
// signInWithGoogle/signUp above, with `next` pointed at the reset-password
// page -- landing there leaves the user in an authenticated "recovery"
// session, which is what updatePassword below requires.
export async function resetPasswordForEmail(supabase: Client, email: string, nextPath?: string) {
  const resetPasswordPath = `/auth/reset-password${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`;
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(resetPasswordPath)}`;
  return supabase.auth.resetPasswordForEmail(email, { redirectTo });
}

// Sets a new password for the currently-authenticated user. Used both for
// the recovery-link flow (ResetPasswordClient, where the "current session"
// is the short-lived recovery session created by the callback route) and
// would work equally for a logged-in user changing their password directly.
export async function updatePassword(supabase: Client, password: string) {
  return supabase.auth.updateUser({ password });
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
