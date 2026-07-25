import React, { createContext, useContext, useEffect, useState } from 'react';
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

    const { data: { subscription } } = onAuthStateChange((_event, session) => {
      applySession(session);
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

  return (
    <AuthContext.Provider value={{ session, user: session?.user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  return useContext(AuthContext);
};
