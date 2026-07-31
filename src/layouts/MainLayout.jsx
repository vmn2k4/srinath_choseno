import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User as UserIcon } from 'lucide-react';

export default function MainLayout() {
  const { session, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  // Single source of truth for the nav pill's active/inactive look — was
  // previously copy-pasted independently at each Link below.
  const navLinkClass = (active) =>
    `px-4 py-2 rounded-lg text-base font-medium transition-all duration-300 ${
      active
        ? 'text-text-main bg-primary/20 border border-primary/30 shadow-[0_0_15px_rgba(233,235,158,0.15)]'
        : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
    }`;

  return (
    <div className="flex flex-col min-h-screen">
      <nav className="flex justify-between items-center px-8 py-6 bg-surface/80 backdrop-blur-md border-b border-white/10">
        <Link to="/" className="font-display font-extrabold text-2xl text-primary hover:text-accent transition-colors">
          Choseno
        </Link>
        <div className="flex gap-4 items-center">
          {session ? (
            <>
              <Link to="/feed" className={navLinkClass(isActive('/feed'))}>
                Feed
              </Link>
              {profile?.role !== 'admin' && (
                <Link
                  to={profile?.role === 'politician' ? '/politician/elections' : '/elections'}
                  className={navLinkClass(isActive('/elections') || isActive('/politician/elections'))}
                >
                  Elections
                </Link>
              )}
              {profile?.role === 'admin' && (
                <Link to="/admin" className={navLinkClass(isActive('/admin'))}>
                  Admin
                </Link>
              )}
              <Link to="/profile" className={`flex items-center gap-2 ${navLinkClass(isActive('/profile'))}`}>
                <UserIcon size={18} />
                Profile
              </Link>
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-base font-medium text-danger-light hover:text-danger-lighter hover:bg-danger/10 transition-all duration-300"
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
                  ? 'text-text-main bg-success/20 border border-success/30'
                  : 'text-text-muted hover:text-text-main hover:bg-white/5 border border-border'
              }`}
            >
              Log In / Sign Up
            </Link>
          )}
        </div>
      </nav>

      <main className={isActive('/') ? 'flex-1 w-full' : 'flex-1 w-full p-8 flex flex-col items-center'}>
        <Outlet />
      </main>
    </div>
  );
}
