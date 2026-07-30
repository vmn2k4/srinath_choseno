import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getSession, onAuthStateChange, signOut as signOutService } from '../services/auth';
import { fetchOrHealProfile, getOwnProfile } from '../services/profile';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

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
      // TOKEN_REFRESHED fires on a timer and whenever the tab regains focus
      // (supabase-js revalidates the session on visibility change) -- same
      // user, just a rotated token. Applying it through applySession would
      // re-arm `loading`, which ProtectedRoute renders as a full-page
      // spinner -- so every tab switch looked like the whole app reloading.
      // Just swap in the refreshed session and skip the profile refetch.
      if (event === 'TOKEN_REFRESHED') {
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
