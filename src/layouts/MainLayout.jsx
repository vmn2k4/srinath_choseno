import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User as UserIcon } from 'lucide-react';

export default function MainLayout() {
  const { session, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <div className="flex flex-col min-h-screen">
      <nav className="flex justify-between items-center px-8 py-6 bg-slate-900/80 backdrop-blur-md border-b border-white/10">
        <Link to="/" className="font-bold text-2xl bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent hover:opacity-80 transition-opacity">
          GeoTracker
        </Link>
        <div className="flex gap-4 items-center">
          <Link 
            to="/"
            className={`px-4 py-2 rounded-lg text-base font-medium transition-all duration-300 ${
              isActive('/') 
                ? 'text-slate-50 bg-blue-500/20 border border-blue-500/30' 
                : 'text-slate-400 hover:text-slate-50 hover:bg-white/5'
            }`}
          >
            Boundary Finder
          </Link>
          {session ? (
            <>
              <Link 
                to="/admin"
                className={`px-4 py-2 rounded-lg text-base font-medium transition-all duration-300 ${
                  isActive('/admin') 
                    ? 'text-slate-50 bg-blue-500/20 border border-blue-500/30' 
                    : 'text-slate-400 hover:text-slate-50 hover:bg-white/5'
                }`}
              >
                Admin
              </Link>
              <Link 
                to="/profile"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-base font-medium transition-all duration-300 ${
                  isActive('/profile') 
                    ? 'text-slate-50 bg-indigo-500/20 border border-indigo-500/30' 
                    : 'text-slate-400 hover:text-slate-50 hover:bg-white/5'
                }`}
              >
                <UserIcon size={18} />
                Profile
              </Link>
              <button 
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-base font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all duration-300"
                onClick={handleSignOut}
              >
                <LogOut size={18} />
                Sign Out
              </button>
            </>
          ) : (
            <Link 
              to="/auth"
              className={`px-4 py-2 rounded-lg text-base font-medium transition-all duration-300 ${
                isActive('/auth') 
                  ? 'text-slate-50 bg-emerald-500/20 border border-emerald-500/30' 
                  : 'text-slate-400 hover:text-slate-50 hover:bg-white/5 border border-slate-600'
              }`}
            >
              Log In / Sign Up
            </Link>
          )}
        </div>
      </nav>

      <main className="flex-1 flex justify-center items-start p-8">
        <Outlet />
      </main>
    </div>
  );
}
