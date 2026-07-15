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
      navigate('/profile', { replace: true });
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
    <div className="w-full max-w-md p-8 bg-surface-hover rounded-2xl border border-white/10 shadow-xl animate-fade-in mx-auto mt-10">
      <h2 className="text-2xl font-bold text-text-main mb-6 text-center">
        {isSignUp ? 'Create an Account' : 'Welcome Back'}
      </h2>
      <form onSubmit={handleAuth} className="flex flex-col gap-4">
        <div>
          <label className="block mb-2 text-sm font-medium text-text-tertiary">Email</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="block w-full p-3 text-sm text-text-main border border-slate-600 rounded-lg bg-surface focus:outline-none focus:border-accent"
            required
          />
        </div>
        <div>
          <label className="block mb-2 text-sm font-medium text-text-tertiary">Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="block w-full p-3 text-sm text-text-main border border-slate-600 rounded-lg bg-surface focus:outline-none focus:border-accent"
            required
          />
        </div>
        <button
          type="submit"
          className="mt-4 px-6 py-3 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover transition-colors focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Log In'}
        </button>
      </form>

      {message.text && (
        <div className={`mt-4 p-4 rounded-lg text-sm font-medium animate-fade-in ${message.type === 'error' ? 'bg-red-500/10 border border-red-500/30 text-red-400' : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'}`}>
          {message.text}
        </div>
      )}

      <div className="mt-6 text-center">
        <button
          className="text-sm text-text-muted hover:text-text-secondary transition-colors"
          onClick={() => setIsSignUp(!isSignUp)}
        >
          {isSignUp ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
        </button>
      </div>
    </div>
  );
}
