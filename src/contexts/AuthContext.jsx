import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const fetchProfile = async (userId) => {
      if (!userId) {
        if (active) setProfile(null);
        return;
      }
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (active) setProfile(data);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (active) {
        setSession(session);
        fetchProfile(session?.user?.id).then(() => {
          if (active) setLoading(false);
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setSession(session);
        if (session) {
          fetchProfile(session.user.id).then(() => {
            if (active) setLoading(false);
          });
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signOut = () => {
    setProfile(null);
    return supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (session?.user?.id) {
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      setProfile(data);
    }
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user, profile, loading, signOut, refreshProfile }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  return useContext(AuthContext);
};
