"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, User as UserIcon, Palette, Check, Menu, X, Newspaper, Rss, Vote, Shield, Sparkles, MapPin, Home, Heart } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme, THEMES, ThemeKey } from "@/contexts/ThemeContext";
import ChosenoLogo from "@/components/primitives/ChosenoLogo";
import { trackLogout } from "@/lib/analytics/events";
import { buildPoliticianWallSlug } from "@/lib/utils/slugs";

export default function NavBar() {
  const { session, profile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [themeOpen, setThemeOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
    setThemeOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    trackLogout();
    await signOut();
    setMobileMenuOpen(false);
    router.push("/auth");
  };

  const isActive = (path: string) => pathname === path;

  const navLinkClass = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
      active
        ? "text-primary bg-primary/10 border border-primary/25 font-semibold"
        : "text-text-muted hover:text-text-main hover:bg-surface-hover"
    }`;

  const mobileNavLinkClass = (active: boolean) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
      active
        ? "text-primary bg-primary/15 border-l-4 border-primary font-semibold shadow-sm"
        : "text-text-main hover:bg-surface-hover hover:text-primary"
    }`;

  return (
    <nav className="sticky top-0 z-40 bg-background/80 backdrop-blur-md elevation-2 border-b border-border w-full">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
        <Link href="/" className="hover:opacity-90 transition-opacity">
          <ChosenoLogo size="md" />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex gap-1.5 items-center">
          <Link
            href={session && profile?.role !== "admin" ? "/feed" : "/"}
            className={`flex items-center gap-1.5 ${navLinkClass(
              isActive("/") || isActive("/feed")
            )}`}
          >
            <Home size={15} />
            Home
          </Link>

          {session ? (
            <>
              {profile?.role === "politician" && profile?.current_ghost_id && (
                <Link
                  href={`/wall/${profile.politician_wall_slug || buildPoliticianWallSlug(profile.full_name, profile.designation)}`}
                  className={`flex items-center gap-1.5 ${navLinkClass(
                    pathname?.startsWith("/wall") ?? false
                  )}`}
                >
                  <Sparkles size={15} />
                  My Wall
                </Link>
              )}
              {profile?.role !== "admin" && (
                <Link
                  href={
                    profile?.role === "politician"
                      ? "/politician/elections"
                      : "/elections"
                  }
                  className={`flex items-center gap-1.5 ${navLinkClass(
                    isActive("/elections") || isActive("/politician/elections")
                  )}`}
                >
                  <Vote size={15} />
                  Elections &amp; Races
                </Link>
              )}
              {profile?.role === "admin" && (
                <Link
                  href="/admin"
                  className={`flex items-center gap-1.5 ${navLinkClass(isActive("/admin"))}`}
                >
                  <Shield size={15} />
                  Admin
                </Link>
              )}
            </>
          ) : null}

          <Link
            href="/find-my-district"
            className={`flex items-center gap-1.5 ${navLinkClass(
              isActive("/find-my-district")
            )}`}
          >
            <MapPin size={15} />
            Find District
          </Link>

          <Link
            href="/news"
            className={`flex items-center gap-1.5 ${navLinkClass(pathname?.startsWith("/news") ?? false)}`}
          >
            <Newspaper size={15} />
            News
          </Link>

          <Link
            href="/about"
            className={`flex items-center gap-1.5 ${navLinkClass(isActive("/about"))}`}
          >
            About
          </Link>

          {session ? (
            <>
              <Link
                href="/profile"
                className={`flex items-center gap-1.5 ${navLinkClass(
                  isActive("/profile")
                )}`}
              >
                <UserIcon size={15} />
                Profile
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/elections"
                className={navLinkClass(isActive("/elections"))}
              >
                Elections
              </Link>
              <Link
                href="/auth"
                className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  isActive("/auth")
                    ? "text-text-main bg-primary/20 border border-primary/40 shadow-sm"
                    : "text-text-on-primary bg-primary hover:bg-primary-hover shadow-sm"
                }`}
              >
                Log In / Sign Up
              </Link>
            </>
          )}

          {/* Theme Picker Dropdown - Admin Only */}
          {profile?.role === "admin" && (
          <div className="relative ml-1">
            <button
              onClick={() => setThemeOpen(!themeOpen)}
              className="p-2 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
              title="Change Theme"
              aria-label="Change Theme"
            >
              <Palette size={18} />
            </button>

            {themeOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setThemeOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-56 py-2 bg-surface-elevated border border-border-light/40 rounded-xl shadow-xl z-50 animate-fade-in max-h-80 overflow-y-auto">
                  <div className="px-3 py-1.5 text-xs font-bold text-text-muted uppercase tracking-wider border-b border-border-light/20">
                    Select Theme
                  </div>
                  {THEMES.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => {
                        setTheme(t.key as ThemeKey);
                        setThemeOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-left transition-colors ${
                        theme === t.key
                          ? "text-primary bg-primary/10 font-bold"
                          : "text-text-main hover:bg-surface-hover"
                      }`}
                    >
                      <span>
                        {t.label}{" "}
                        <span className="text-[10px] text-text-muted">
                          ({t.mode})
                        </span>
                      </span>
                      {theme === t.key && <Check size={14} className="text-primary" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          )}

          {session && (
            <>
              <span className="w-px h-5 bg-border mx-1" />
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-danger-light hover:text-danger-lighter hover:bg-danger/10 transition-colors duration-200"
                onClick={handleSignOut}
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            </>
          )}
        </div>

        {/* Mobile / Tablet Controls */}
        <div className="flex lg:hidden items-center gap-2">
          {/* Theme Button for Mobile - Admin Only */}
          {profile?.role === "admin" && (
          <div className="relative">
            <button
              onClick={() => setThemeOpen(!themeOpen)}
              className="p-2 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
              aria-label="Change Theme"
            >
              <Palette size={20} />
            </button>

            {themeOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setThemeOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-56 py-2 bg-surface-elevated border border-border-light/40 rounded-xl shadow-2xl z-50 animate-fade-in max-h-80 overflow-y-auto">
                  <div className="px-3 py-1.5 text-xs font-bold text-text-muted uppercase tracking-wider border-b border-border-light/20">
                    Select Theme
                  </div>
                  {THEMES.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => {
                        setTheme(t.key as ThemeKey);
                        setThemeOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-left transition-colors ${
                        theme === t.key
                          ? "text-primary bg-primary/10 font-bold"
                          : "text-text-main hover:bg-surface-hover"
                      }`}
                    >
                      <span>
                        {t.label}{" "}
                        <span className="text-[10px] text-text-muted">
                          ({t.mode})
                        </span>
                      </span>
                      {theme === t.key && <Check size={14} className="text-primary" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          )}

          {/* Hamburger Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2.5 rounded-xl text-text-main hover:bg-surface-hover transition-colors border border-border/40 focus:outline-none"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Panel */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed left-0 right-0 top-[57px] z-50 bg-surface/95 backdrop-blur-xl border-b border-border shadow-2xl animate-fade-in max-h-[calc(100vh-60px)] overflow-y-auto p-4 flex flex-col gap-2">
          <Link
            href={session && profile?.role !== "admin" ? "/feed" : "/"}
            className={mobileNavLinkClass(isActive("/") || isActive("/feed"))}
          >
            <Home size={18} />
            Home
          </Link>

          {session ? (
            <>
              {profile?.role === "politician" && profile?.current_ghost_id && (
                <Link
                  href={`/wall/${profile.politician_wall_slug || buildPoliticianWallSlug(profile.full_name, profile.designation)}`}
                  className={mobileNavLinkClass(pathname?.startsWith("/wall") ?? false)}
                >
                  <Sparkles size={18} />
                  My Wall
                </Link>
              )}

              {profile?.role !== "admin" && (
                <Link
                  href={
                    profile?.role === "politician"
                      ? "/politician/elections"
                      : "/elections"
                  }
                  className={mobileNavLinkClass(
                    isActive("/elections") || isActive("/politician/elections")
                  )}
                >
                  <Vote size={18} />
                  Elections &amp; Races
                </Link>
              )}

              {profile?.role === "admin" && (
                <Link
                  href="/admin"
                  className={mobileNavLinkClass(isActive("/admin"))}
                >
                  <Shield size={18} />
                  Admin
                </Link>
              )}
            </>
          ) : null}

          <Link
            href="/find-my-district"
            className={mobileNavLinkClass(isActive("/find-my-district"))}
          >
            <MapPin size={18} />
            Find District
          </Link>

          <Link
            href="/news"
            className={mobileNavLinkClass(pathname?.startsWith("/news") ?? false)}
          >
            <Newspaper size={18} />
            News
          </Link>

          <Link
            href="/about"
            className={mobileNavLinkClass(isActive("/about"))}
          >
            <Heart size={18} />
            About Us
          </Link>

          {session ? (
            <>
              <Link
                href="/profile"
                className={mobileNavLinkClass(isActive("/profile"))}
              >
                <UserIcon size={18} />
                Profile
              </Link>

              <div className="pt-3 mt-1 border-t border-border-light/20">
                <button
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-base font-semibold text-danger-light bg-danger/10 hover:bg-danger/20 transition-colors"
                  onClick={handleSignOut}
                >
                  <LogOut size={18} />
                  Sign Out
                </button>
              </div>
            </>
          ) : (
            <>
              <Link
                href="/elections"
                className={mobileNavLinkClass(isActive("/elections"))}
              >
                <Vote size={18} />
                Elections
              </Link>

              <div className="pt-3 mt-1 border-t border-border-light/20">
                <Link
                  href="/auth"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-base font-bold text-text-on-primary bg-primary hover:bg-primary-hover shadow-md transition-colors"
                >
                  Log In / Sign Up
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
