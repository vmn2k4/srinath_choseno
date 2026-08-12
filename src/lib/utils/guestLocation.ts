"use client";

import { useState, useEffect } from "react";

export interface MatchedBoundary {
  id: number;
  name: string;
  country?: string;
  boundary_type?: string;
}

export interface GuestLocationData {
  lat?: number;
  lng?: number;
  boundaries: MatchedBoundary[];
  updatedAt: number;
}

export const GUEST_LOCATION_STORAGE_KEY = "choseno_guest_location";
export const GUEST_LOCATION_EVENT = "choseno_guest_location_changed";

export function getGuestLocation(): GuestLocationData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(GUEST_LOCATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.boundaries)) {
      return parsed as GuestLocationData;
    }
  } catch (err) {
    console.error("Error reading guest location from localStorage:", err);
  }
  return null;
}

export function setGuestLocation(data: {
  lat?: number;
  lng?: number;
  boundaries: MatchedBoundary[];
}): void {
  if (typeof window === "undefined") return;
  try {
    const payload: GuestLocationData = {
      lat: data.lat,
      lng: data.lng,
      boundaries: data.boundaries,
      updatedAt: Date.now(),
    };
    localStorage.setItem(GUEST_LOCATION_STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(
      new CustomEvent(GUEST_LOCATION_EVENT, { detail: payload })
    );
  } catch (err) {
    console.error("Error setting guest location in localStorage:", err);
  }
}

export function clearGuestLocation(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(GUEST_LOCATION_STORAGE_KEY);
    window.dispatchEvent(
      new CustomEvent(GUEST_LOCATION_EVENT, { detail: null })
    );
  } catch (err) {
    console.error("Error clearing guest location from localStorage:", err);
  }
}

export function useGuestLocation() {
  const [guestLocation, setGuestLocationState] = useState<GuestLocationData | null>(null);

  useEffect(() => {
    // Initial load on client mount
    setGuestLocationState(getGuestLocation());

    const handleStorage = (e: StorageEvent) => {
      if (e.key === GUEST_LOCATION_STORAGE_KEY || e.key === null) {
        setGuestLocationState(getGuestLocation());
      }
    };

    const handleCustomEvent = () => {
      setGuestLocationState(getGuestLocation());
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(GUEST_LOCATION_EVENT, handleCustomEvent);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(GUEST_LOCATION_EVENT, handleCustomEvent);
    };
  }, []);

  return guestLocation;
}
