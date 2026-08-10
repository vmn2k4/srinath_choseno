"use client";

import React, { useState } from "react";
import Link from "next/link";
import { MapPin, ArrowRight, Layers } from "lucide-react";
import InteractiveLocationPicker from "./InteractiveLocationPicker";
import { findBoundariesByPoint } from "@/lib/services/boundaries";
import { buildBoundarySlug } from "@/lib/utils/slugs";
import { Card, Spinner } from "@/components/primitives";
import { createClient } from "@/lib/supabase/client";
import { trackFindDistrictCompleted } from "@/lib/analytics/events";

interface MatchedBoundary {
  id: number;
  name: string;
  country: string;
  boundary_type: string;
}

export default function FindMyDistrictClient() {
  const supabase = createClient();
  const [boundaries, setBoundaries] = useState<MatchedBoundary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedLat, setSelectedLat] = useState<number | undefined>(undefined);
  const [selectedLng, setSelectedLng] = useState<number | undefined>(undefined);

  const handleLocationSelect = async (lat: number, lng: number) => {
    setSelectedLat(lat);
    setSelectedLng(lng);
    setLoading(true);
    setError("");
    const { data, error: rpcError } = await findBoundariesByPoint(supabase, lat, lng);
    setLoading(false);
    if (rpcError) {
      setError("Couldn't look up boundaries for that location. Please try again.");
      return;
    }
    const matched = (data as MatchedBoundary[] | null) || [];
    trackFindDistrictCompleted({ found: matched.length > 0, boundaryCount: matched.length });
    setBoundaries(matched);
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-12 space-y-8">
      <div className="text-center space-y-3">
        <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight">
          Find your district
        </h1>
        <p className="text-text-muted max-w-xl mx-auto">
          Search your address or drop a pin to see every electoral boundary you belong
          to — from your polling district up to federal — and what&apos;s happening in
          each one.
        </p>
      </div>

      <InteractiveLocationPicker
        currentLat={selectedLat}
        currentLng={selectedLng}
        onLocationSelect={handleLocationSelect}
        loading={loading}
        error={error}
      />

      {loading && (
        <div className="flex justify-center">
          <Spinner />
        </div>
      )}

      {!loading && boundaries && (
        <div className="space-y-3">
          {boundaries.length === 0 ? (
            <Card padding="md" className="text-center text-sm text-text-muted">
              No mapped boundaries found for that location yet. Coverage expands as new
              regions are added.
            </Card>
          ) : (
            boundaries.map((b) => (
              <Link
                key={b.id}
                href={`/elections/${buildBoundarySlug(b)}`}
                className="group flex items-center justify-between gap-4 px-5 py-4 rounded-2xl border border-border-light/40 bg-surface-elevated/70 hover:border-primary/40 hover:bg-surface-hover/40 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-surface/80 border border-border-light/40 flex items-center justify-center shrink-0">
                    <Layers size={18} className="text-primary" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-text-main truncate">{b.name}</p>
                    <p className="text-xs text-text-muted flex items-center gap-1">
                      <MapPin size={11} /> {b.boundary_type} · {b.country}
                    </p>
                  </div>
                </div>
                <ArrowRight
                  size={18}
                  className="text-text-muted shrink-0 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-primary"
                  aria-hidden="true"
                />
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
