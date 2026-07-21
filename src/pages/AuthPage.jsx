import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEffect } from 'react';

export default function AuthPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (session) {
      navigate('/feed', { replace: true });
    }
  }, [session, navigate]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage({ type: 'success', text: 'Success! Please check your email for a confirmation link, or log in if auto-confirm is enabled.' });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        // Navigation will be handled by the useEffect watching session
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.error_description || error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 bg-surface/30 backdrop-blur-md rounded-2xl border border-border-light/45 shadow-2xl animate-fade-in mx-auto mt-14">
      <h2 className="text-2xl font-bold text-text-main mb-6 text-center">
        {isSignUp ? 'Create an Account' : 'Welcome Back'}
      </h2>
      <form onSubmit={handleAuth} className="flex flex-col gap-4">
        <div>
          <label className="block mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">Email Address</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="block w-full p-3 bg-surface/40 border border-border-light text-sm text-text-main rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
            required
          />
        </div>
        <div>
          <label className="block mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="block w-full p-3 bg-surface/40 border border-border-light text-sm text-text-main rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
            required
          />
        </div>
        <button
          type="submit"
          className="mt-4 px-6 py-3 bg-primary hover:bg-primary-hover text-slate-950 font-bold rounded-xl transition-all duration-200 focus:ring-4 focus:ring-primary/10 disabled:opacity-50 shadow-[0_4px_14px_rgba(233,235,158,0.15)]"
          disabled={loading}
        >
          {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Log In'}
        </button>
      </form>

      {message.text && (
        <div className={`mt-4 p-4 rounded-xl text-sm font-medium animate-fade-in ${message.type === 'error' ? 'bg-danger/10 border border-danger/25 text-danger' : 'bg-accent/15 border border-accent/25 text-accent'}`}>
          {message.text}
        </div>
      )}

      <div className="mt-6 text-center">
        <button
          className="text-xs text-text-muted hover:text-text-secondary transition-colors font-medium"
          onClick={() => setIsSignUp(!isSignUp)}
        >
          {isSignUp ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
        </button>
      </div>
    </div>
  );
}
