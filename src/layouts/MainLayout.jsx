import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User as UserIcon } from 'lucide-react';
import { ChosenoLogo } from '../components/ui';

export default function MainLayout() {
  const { session, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const isActive = (path) => location.pathname === path;

  // Single source of truth for the nav pill's active/inactive look — was
  // previously copy-pasted independently at each Link below.
  const navLinkClass = (active) =>
    `px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
      active
        ? 'text-primary bg-primary/10 border border-primary/25 font-semibold'
        : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
    }`;

  return (
    <div className="flex flex-col min-h-screen">
      <nav className="sticky top-0 z-40 flex justify-between items-center px-5 lg:px-8 py-3 bg-background/70 elevation-2 border-b border-border">
        <Link to="/" className="hover:opacity-90 transition-opacity">
          <ChosenoLogo size="md" />
        </Link>
        <div className="flex gap-1 items-center">
          {session ? (
            <>
              <Link to="/feed" className={navLinkClass(isActive('/feed'))}>
                Local Feed
              </Link>
              {profile?.role !== 'admin' && (
                <Link
                  to={profile?.role === 'politician' ? '/politician/elections' : '/elections'}
                  className={navLinkClass(isActive('/elections') || isActive('/politician/elections'))}
                >
                  Elections &amp; Races
                </Link>
              )}
              {profile?.role === 'admin' && (
                <Link to="/admin" className={navLinkClass(isActive('/admin'))}>
                  Admin
                </Link>
              )}
              <Link to="/profile" className={`flex items-center gap-1.5 ${navLinkClass(isActive('/profile'))}`}>
                <UserIcon size={15} />
                Profile
              </Link>
              <span className="w-px h-5 bg-border mx-1.5" />
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-danger-light hover:text-danger-lighter hover:bg-danger/10 transition-colors duration-200"
                onClick={handleSignOut}
              >
                <LogOut size={15} />
                Sign Out
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                isActive('/auth')
                  ? 'text-text-main bg-success/20 border border-success/30'
                  : 'text-text-muted hover:text-text-main hover:bg-surface-hover border border-border'
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
