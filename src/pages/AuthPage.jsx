import React, { useState, useEffect } from 'react';
import { signUp, signInWithPassword } from '../services/auth';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, Input, Button } from '../components/ui';

export default function AuthPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
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
        const { error } = await signUp(email, password);
        if (error) throw error;
        setMessage({ type: 'success', text: 'Success! Please check your email for a confirmation link, or log in if auto-confirm is enabled.' });
      } else {
        const { error } = await signInWithPassword(email, password);
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
    <Card padding="lg" className="w-full max-w-md shadow-2xl animate-fade-in mx-auto mt-10 sm:mt-14">
      <h2 className="text-2xl font-bold text-text-main mb-6 text-center">
        {isSignUp ? 'Create an Account' : 'Welcome Back'}
      </h2>
      <form onSubmit={handleAuth} className="flex flex-col gap-4">
        <div>
          <label className="block mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">Email Address</label>
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">Password</label>
          <Input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" size="lg" disabled={loading} className="mt-2 w-full">
          {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Log In'}
        </Button>
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
    </Card>
  );
}
