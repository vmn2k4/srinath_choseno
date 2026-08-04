"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, User as UserIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import ChosenoLogo from "@/components/primitives/ChosenoLogo";

// Ported from src/layouts/MainLayout.jsx. News (built fresh in Phase 5) is
// added to both branches — unlike Elections, which is public-but-unlinked
// for signed-out visitors today, News needs to be discoverable without an
// account for the SEO goal this whole migration exists for.
export default function NavBar() {
  const { session, profile, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

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
    <nav className="sticky top-0 z-40 flex justify-between items-center px-5 lg:px-8 py-3 bg-background/70 elevation-2 border-b border-border">
      <Link href="/" className="hover:opacity-90 transition-opacity">
        <ChosenoLogo size="md" />
      </Link>
      <div className="flex gap-1 items-center">
        <Link href="/news" className={navLinkClass(pathname?.startsWith("/news") ?? false)}>
          News
        </Link>
        {session ? (
          <>
            <Link href="/feed" className={navLinkClass(isActive("/feed"))}>
              Local Feed
            </Link>
            {profile?.role !== "admin" && (
              <Link
                href={profile?.role === "politician" ? "/politician/elections" : "/elections"}
                className={navLinkClass(isActive("/elections") || isActive("/politician/elections"))}
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
              className={`flex items-center gap-1.5 ${navLinkClass(isActive("/profile"))}`}
            >
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
            href="/auth"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
              isActive("/auth")
                ? "text-text-main bg-success/20 border border-success/30"
                : "text-text-muted hover:text-text-main hover:bg-surface-hover border border-border"
            }`}
          >
            Log In / Sign Up
          </Link>
        )}
      </div>
    </nav>
  );
}
