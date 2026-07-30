import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getSession, onAuthStateChange, signOut as signOutService } from '../services/auth';
import { fetchOrHealProfile, getOwnProfile } from '../services/profile';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Tracks whichever user id is currently applied, so the onAuthStateChange
  // handler below can tell "this event is about the same session" apart
  // from "this is actually a new sign-in" without a stale closure over
  // `session` state (this ref is mutated directly, not through React state).
  const currentUserIdRef = useRef(null);

  useEffect(() => {
    let active = true;

    // Applies a session and (re)fetches its profile. Sets `loading` back to
    // true for the duration of that fetch -- a fresh sign-in fires this with
    // a new session while `loading` may already be false from an earlier
    // resolution, and AuthPage navigates to /feed as soon as `session` is
    // truthy, well before this async fetch completes. Without re-arming
    // `loading`, ProtectedRoute would render with the *previous* (null)
    // profile and incorrectly redirect to /onboarding on every sign-in,
    // regardless of the account's actual onboarding_completed value.
    const applySession = async (newSession) => {
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
      const data = await fetchOrHealProfile(userId, newSession.user.email);
      if (active) {
        setProfile(data);
        setLoading(false);
      }
    };

    getSession().then(({ data: { session } }) => applySession(session));

    const { data: { subscription } } = onAuthStateChange((event, newSession) => {
      // supabase-js re-validates the session whenever the tab regains focus
      // (visibilitychange). If the access token isn't near expiry yet, it
      // doesn't emit TOKEN_REFRESHED -- it re-emits SIGNED_IN with a fresh
      // copy of the *same* session read back from storage (auth-js
      // GoTrueClient#_recoverAndRefresh's non-expiring branch). Both cases
      // are the same user as before, just a redundant re-notification.
      // Applying either through applySession would re-arm `loading` (which
      // ProtectedRoute renders as a full-page spinner) and refetch the
      // profile -- so every tab switch looked like the whole app reloading,
      // and any page effect keyed on `[..., authLoading, ...]` would refire
      // too. Only swap in the session (fresh token, kept referentially
      // stable for `user` via the id-based useMemo below); skip the
      // loading/refetch cycle unless this is genuinely a different user.
      const sameUser = newSession?.user?.id && newSession.user.id === currentUserIdRef.current;
      if ((event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') && sameUser) {
        setSession(newSession);
        return;
      }
      applySession(newSession);
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signOut = () => {
    setProfile(null);
    return signOutService();
  };

  const refreshProfile = async () => {
    if (session?.user?.id) {
      const { data } = await getOwnProfile(session.user.id);
      setProfile(data);
    }
  };

  // supabase-js hands back a brand-new `user` object on every session
  // refresh (same id, different reference) -- every page that keys a
  // useEffect on `[user]` would silently re-fetch and re-flash its own
  // loading spinner on every tab-focus token refresh otherwise. Keep the
  // reference stable across renders as long as the id hasn't changed, so
  // consumers only see a "new" user when it actually is one.
  const user = useMemo(() => session?.user, [session?.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  return useContext(AuthContext);
};
