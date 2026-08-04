"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, User as UserIcon, Palette, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme, THEMES, ThemeKey } from "@/contexts/ThemeContext";
import ChosenoLogo from "@/components/primitives/ChosenoLogo";

export default function NavBar() {
  const { session, profile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [themeOpen, setThemeOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push("/auth");
  };

  const isActive = (path: string) => pathname === path;

  const navLinkClass = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
      active
        ? "text-primary bg-primary/10 border border-primary/25 font-semibold"
        : "text-text-muted hover:text-text-main hover:bg-surface-hover"
    }`;

  return (
    <nav className="sticky top-0 z-40 flex justify-between items-center px-5 lg:px-8 py-3 bg-background/80 backdrop-blur-md elevation-2 border-b border-border">
      <Link href="/" className="hover:opacity-90 transition-opacity">
        <ChosenoLogo size="md" />
      </Link>

      <div className="flex gap-1.5 items-center">
        <Link
          href="/news"
          className={navLinkClass(pathname?.startsWith("/news") ?? false)}
        >
          News
        </Link>

        {session ? (
          <>
            <Link href="/feed" className={navLinkClass(isActive("/feed"))}>
              Local Feed
            </Link>
            {profile?.role !== "admin" && (
              <Link
                href={
                  profile?.role === "politician"
                    ? "/politician/elections"
                    : "/elections"
                }
                className={navLinkClass(
                  isActive("/elections") || isActive("/politician/elections")
                )}
              >
                Elections &amp; Races
              </Link>
            )}
            {profile?.role === "admin" && (
              <Link href="/admin" className={navLinkClass(isActive("/admin"))}>
                Admin
              </Link>
            )}
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

        {/* Theme Picker Dropdown */}
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

        {session && (
          <>
            <span className="w-px h-5 bg-border mx-1" />
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-danger-light hover:text-danger-lighter hover:bg-danger/10 transition-colors duration-200"
              onClick={handleSignOut}
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
