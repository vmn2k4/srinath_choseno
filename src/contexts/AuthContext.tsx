"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { getSession, onAuthStateChange, signOut as signOutService } from "@/lib/services/auth";
import { fetchOrHealProfile, getOwnProfile } from "@/lib/services/profile";
import type { Database } from "@/lib/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type AuthProfile = Profile & { politician_wall_slug?: string | null };

type AuthContextValue = {
  session: Session | null;
  user: Session["user"] | undefined;
  profile: AuthProfile | null;
  loading: boolean;
  signOut: () => Promise<{ error: unknown }>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Tracks whichever user id is currently applied, so the onAuthStateChange
  // handler below can tell "this event is about the same session" apart
  // from "this is actually a new sign-in" without a stale closure over
  // `session` state (this ref is mutated directly, not through React state).
  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    // Applies a session and (re)fetches its profile. Sets `loading` back to
    // true for the duration of that fetch -- a fresh sign-in fires this with
    // a new session while `loading` may already be false from an earlier
    // resolution, and the auth page navigates to /feed as soon as `session`
    // is truthy, well before this async fetch completes. Without re-arming
    // `loading`, a route guard would render with the *previous* (null)
    // profile and incorrectly redirect to /onboarding on every sign-in,
    // regardless of the account's actual onboarding_completed value.
    const applySession = async (newSession: Session | null) => {
      if (!active) return;
      setSession(newSession);
      currentUserIdRef.current = newSession?.user?.id ?? null;
      const userId = newSession?.user?.id;

      if (!userId) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const data = await fetchOrHealProfile(supabase, userId, newSession.user.email);
      if (active) {
        setProfile(data as AuthProfile | null);
        setLoading(false);
      }
    };

    getSession(supabase).then(({ data: { session } }) => applySession(session));

    const {
      data: { subscription },
    } = onAuthStateChange(supabase, async (event, newSession) => {
      // supabase-js re-validates the session whenever the tab regains focus
      // (visibilitychange). If the access token isn't near expiry yet, it
      // doesn't emit TOKEN_REFRESHED -- it re-emits SIGNED_IN with a fresh
      // copy of the *same* session read back from storage. Both cases are
      // the same user as before, just a redundant re-notification. Applying
      // either through applySession would re-arm `loading` (rendered as a
      // full-page spinner) and refetch the profile -- so every tab switch
      // looked like the whole app reloading. Only swap in the session (kept
      // referentially stable for `user` via the id-based useMemo below);
      // skip the loading/refetch cycle unless this is genuinely a different
      // user.
      const sameUser =
        newSession?.user?.id && newSession.user.id === currentUserIdRef.current;
      if ((event === "TOKEN_REFRESHED" || event === "SIGNED_IN") && sameUser) {
        setSession(newSession);
        return;
      }
      applySession(newSession);
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [supabase]);

  const signOut = () => {
    setProfile(null);
    return signOutService(supabase);
  };

  const refreshProfile = async () => {
    if (session?.user?.id) {
      const { data } = await getOwnProfile(supabase, session.user.id);
      setProfile(data as unknown as AuthProfile);
    }
  };

  // supabase-js hands back a brand-new `user` object on every session
  // refresh (same id, different reference) -- every page that keys a
  // useEffect on `[user]` would silently re-fetch and re-flash its own
  // loading spinner on every tab-focus token refresh otherwise. Keep the
  // reference stable across renders as long as the id hasn't changed, so
  // consumers only see a "new" user when it actually is one.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const user = useMemo(() => session?.user, [session?.user?.id]);

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
