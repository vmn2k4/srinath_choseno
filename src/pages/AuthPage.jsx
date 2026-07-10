import React, { useState } from 'react';
import { supabase } from '../services/supabase';

export default function AuthPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

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
        // User will be redirected/updated via onAuthStateChange in App.jsx
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.error_description || error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 bg-slate-800 rounded-2xl border border-white/10 shadow-xl animate-fade-in mx-auto mt-10">
      <h2 className="text-2xl font-bold text-slate-50 mb-6 text-center">
        {isSignUp ? 'Create an Account' : 'Welcome Back'}
      </h2>
      <form onSubmit={handleAuth} className="flex flex-col gap-4">
        <div>
          <label className="block mb-2 text-sm font-medium text-slate-300">Email</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="block w-full p-3 text-sm text-slate-50 border border-slate-600 rounded-lg bg-slate-900 focus:outline-none focus:border-blue-500"
            required
          />
        </div>
        <div>
          <label className="block mb-2 text-sm font-medium text-slate-300">Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="block w-full p-3 text-sm text-slate-50 border border-slate-600 rounded-lg bg-slate-900 focus:outline-none focus:border-blue-500"
            required
          />
        </div>
        <button
          type="submit"
          className="mt-4 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50"
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
          className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
          onClick={() => setIsSignUp(!isSignUp)}
        >
          {isSignUp ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
        </button>
      </div>
    </div>
  );
}
