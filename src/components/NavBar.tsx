"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, LogIn, User as UserIcon, Palette, Check, Menu, X, Newspaper, Vote, Shield, Sparkles, MapPin, Home, Heart } from "lucide-react";
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

  // Same destinations as the hamburger drawer below, surfaced as an
  // always-visible icon strip so the common ones don't require opening the
  // drawer at all. Sign Out and the theme picker stay drawer/menu-only since
  // they're settings, not places you navigate to.
  const mobileIconNavItems: { href: string; label: string; icon: typeof Home; active: boolean }[] = [
    {
      href: session && profile?.role !== "admin" ? "/feed" : "/",
      label: "Home",
      icon: Home,
      active: isActive("/") || isActive("/feed"),
    },
    ...(session && profile?.role === "politician" && profile?.current_ghost_id
      ? [
          {
            href: `/wall/${profile.politician_wall_slug || buildPoliticianWallSlug(profile.full_name, profile.designation)}`,
            label: "My Wall",
            icon: Sparkles,
            active: pathname?.startsWith("/wall") ?? false,
          },
        ]
      : []),
    ...(session && profile?.role !== "admin"
      ? [
          {
            href: profile?.role === "politician" ? "/politician/elections" : "/elections",
            label: "Elections",
            icon: Vote,
            active: isActive("/elections") || isActive("/politician/elections"),
          },
        ]
      : []),
    ...(!session
      ? [
          {
            href: "/elections",
            label: "Elections",
            icon: Vote,
            active: isActive("/elections"),
          },
        ]
      : []),
    ...(session && profile?.role === "admin"
      ? [{ href: "/admin", label: "Admin", icon: Shield, active: isActive("/admin") }]
      : []),
    {
      href: "/find-my-district",
      label: "Find District",
      icon: MapPin,
      active: isActive("/find-my-district"),
    },
    {
      href: "/news",
      label: "News",
      icon: Newspaper,
      active: pathname?.startsWith("/news") ?? false,
    },
    { href: "/about", label: "About", icon: Heart, active: isActive("/about") },
    session
      ? { href: "/profile", label: "Profile", icon: UserIcon, active: isActive("/profile") }
      : { href: "/auth", label: "Log In", icon: LogIn, active: isActive("/auth") },
  ];

  return (
    <>
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
        /* absolute + top-full (relative to the sticky <nav>, which
           establishes a containing block for non-static descendants) so
           this sits right below however tall the nav actually is —
           including the icon strip above — instead of a fixed pixel
           offset that assumed a single-row app bar. */
        <div className="lg:hidden absolute left-0 right-0 top-full z-50 bg-surface/95 backdrop-blur-xl border-b border-border shadow-2xl animate-fade-in max-h-[calc(100vh-60px)] overflow-y-auto p-4 flex flex-col gap-2">
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

    {/* Mobile Bottom Nav Bar — same destinations as the hamburger drawer,
        always visible as a fixed bottom tab bar so common navigation never
        needs the drawer at all. Desktop/tablet (lg+) keep the normal top
        tabs above and never render this. env(safe-area-inset-bottom)
        padding clears the home-indicator area on notched iPhones. */}
    <div
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border elevation-2 overflow-x-auto no-scrollbar"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* min-w-max + shrink-0 items instead of evenly-distributed flex-1 —
          with up to 8 possible destinations (role-dependent), splitting the
          width evenly would squeeze labels like "Find District" past
          readability. Fixed-width items that scroll keep every label
          legible; the row still fits 5-6 items on one screen unscrolled. */}
      <div className="flex items-stretch justify-around min-w-max px-1 py-1">
        {mobileIconNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href + item.label}
              href={item.href}
              className={`shrink-0 flex flex-col items-center justify-center gap-0.5 min-w-[64px] px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                item.active
                  ? "text-primary bg-primary/10"
                  : "text-text-muted hover:text-text-main hover:bg-surface-hover"
              }`}
            >
              <Icon size={18} />
              <span className="whitespace-nowrap">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
    </>
  );
}
