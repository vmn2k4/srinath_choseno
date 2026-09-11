"use client";

import { useState, useEffect } from "react";

// Anonymous "Support" identity for logged-out visitors -- a random id
// minted once and persisted in BOTH localStorage and a long-lived cookie,
// so either surviving alone (a visitor clears cookies but not site data, or
// vice versa) repopulates the other instead of silently starting over.
// Mirrors the guest-identity style already used in guestLocation.ts (window
// guards, try/catch, a hook).

export const ANON_SUPPORTER_STORAGE_KEY = "choseno_anon_supporter_id";
export const ANON_SUPPORTER_COOKIE_NAME = "choseno_anon_id";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 2; // 2 years

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

// Mints (once) or reads back the anon_id. Not a strong identity -- clearing
// both storage mechanisms, or using a second browser/device, starts a new
// one. That's a deliberate tradeoff for zero-friction anonymous support;
// see the anonymous_supporters migration for the server-side rate limit
// that backstops casual abuse instead.
export function getOrCreateAnonSupporterId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const fromStorage = localStorage.getItem(ANON_SUPPORTER_STORAGE_KEY);
    const fromCookie = readCookie(ANON_SUPPORTER_COOKIE_NAME);
    const id = fromStorage || fromCookie || crypto.randomUUID();

    if (fromStorage !== id) localStorage.setItem(ANON_SUPPORTER_STORAGE_KEY, id);
    if (fromCookie !== id) writeCookie(ANON_SUPPORTER_COOKIE_NAME, id);

    return id;
  } catch (err) {
    console.error("Error reading/writing anon supporter id:", err);
    return null;
  }
}

// Client-only: null on first render (SSR-safe), populated after mount.
export function useAnonSupporterId(): string | null {
  const [anonId, setAnonId] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnonId(getOrCreateAnonSupporterId());
  }, []);

  return anonId;
}
