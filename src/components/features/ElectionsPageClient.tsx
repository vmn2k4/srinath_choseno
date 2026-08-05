"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Vote,
  MapPin,
  Users,
  ChevronRight,
  Check,
  Layers,
  Sparkles,
  RotateCcw,
  Search,
} from "lucide-react";
import {
  Card,
  Button,
  EmptyState,
  PageHeader,
  Badge,
  Spinner,
} from "@/components/primitives";
import InteractiveLocationPicker from "./InteractiveLocationPicker";
import { createClient } from "@/lib/supabase/client";
import { buildSeatSlug } from "@/lib/utils/slugs";
import { findBoundariesByPoint } from "@/lib/services/boundaries";
import {
  getActiveSeatsByShapeIds,
  getActiveSeats,
  getCandidatesBySeatIds,
} from "@/lib/services/elections";

export interface SeatWithCandidates {
  id: string;
  role_title: string;
  elections?: { id?: string; name: string; election_date: string } | null;
  map_shapes?: { name: string; boundary_type?: string } | null;
  candidates: unknown[];
}

export interface MatchedBoundary {
  id: number;
  name: string;
  boundary_type?: string;
  country?: string;
}

interface ElectionsPageClientProps {
  initialSeats: SeatWithCandidates[];
  initialRole?: string | null;
  initialBoundaries?: MatchedBoundary[];
}

export default function ElectionsPageClient({
  initialSeats = [],
  initialRole = null,
  initialBoundaries = [],
}: ElectionsPageClientProps) {
  const supabase = createClient();
  const [seats, setSeats] = useState<SeatWithCandidates[]>(initialSeats);
  const [loading, setLoading] = useState(false);

  const [currentLat, setCurrentLat] = useState<number | undefined>(undefined);
  const [currentLng, setCurrentLng] = useState<number | undefined>(undefined);
  const [matchedBoundaries, setMatchedBoundaries] =
    useState<MatchedBoundary[]>(initialBoundaries);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState("");
  const [hasCustomLocation, setHasCustomLocation] = useState(false);
  const [showPicker, setShowPicker] = useState(
    !initialRole || initialBoundaries.length === 0
  );

  const handleLocationSelect = async (lat: number, lng: number) => {
    setCurrentLat(lat);
    setCurrentLng(lng);
    setLocLoading(true);
    setLocError("");
    setLoading(true);

    try {
      const { data: boundaries, error: rpcError } = await findBoundariesByPoint(
        supabase,
        lat,
        lng
      );
      if (rpcError) throw rpcError;

      const matched = (boundaries as MatchedBoundary[]) || [];
      setMatchedBoundaries(matched);
      setHasCustomLocation(true);

      const shapeIds = matched.map((b) => b.id);
      if (shapeIds.length > 0) {
        const { data: seatRows } = await getActiveSeatsByShapeIds(
          supabase,
          shapeIds
        );
        const rows = (seatRows || []) as unknown as SeatWithCandidates[];
        const seatIds = rows.map((s) => s.id);

        const candidatesBySeat: Record<string, unknown[]> = {};
        if (seatIds.length > 0) {
          const { data: candidateRows } = await getCandidatesBySeatIds(
            supabase,
            seatIds
          );
          (candidateRows || []).forEach((c: { seat_id: string }) => {
            candidatesBySeat[c.seat_id] = candidatesBySeat[c.seat_id] || [];
            candidatesBySeat[c.seat_id].push(c);
          });
        }

        setSeats(
          rows.map((s) => ({
            ...s,
            candidates: candidatesBySeat[s.id] || [],
          }))
        );
      } else {
        setSeats([]);
      }
    } catch (err: any) {
      console.error(err);
      setLocError("Could not resolve location boundaries.");
    } finally {
      setLocLoading(false);
      setLoading(false);
    }
  };

  const handleResetLocation = async () => {
    setLoading(true);
    setHasCustomLocation(false);
    setMatchedBoundaries(initialBoundaries);
    setCurrentLat(undefined);
    setCurrentLng(undefined);

    try {
      let resSeats: SeatWithCandidates[] = [];
      const shapeIds = initialBoundaries.map((b) => b.id);

      if (shapeIds.length > 0) {
        const { data: seatRows } = await getActiveSeatsByShapeIds(
          supabase,
          shapeIds
        );
        resSeats = (seatRows || []) as unknown as SeatWithCandidates[];
      } else {
        const { data: seatRows } = await getActiveSeats(supabase);
        resSeats = (seatRows || []) as unknown as SeatWithCandidates[];
      }

      const seatIds = resSeats.map((s) => s.id);
      const candidatesBySeat: Record<string, unknown[]> = {};
      if (seatIds.length > 0) {
        const { data: candidateRows } = await getCandidatesBySeatIds(
          supabase,
          seatIds
        );
        (candidateRows || []).forEach((c: { seat_id: string }) => {
          candidatesBySeat[c.seat_id] = candidatesBySeat[c.seat_id] || [];
          candidatesBySeat[c.seat_id].push(c);
        });
      }

      setSeats(
        resSeats.map((s) => ({
          ...s,
          candidates: candidatesBySeat[s.id] || [],
        }))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 space-y-8">
      <PageHeader icon={Vote} title="Elections &amp; Races" />

      {initialRole === "normal" && (
        <Card
          padding="sm"
          className="flex items-center justify-between gap-4 flex-wrap"
        >
          <p className="text-sm text-text-secondary">
            Interested in serving your community? Switch to candidate mode to
            file your candidacy.
          </p>
          <Button as={Link} href="/profile" className="shrink-0">
            Run for Office
          </Button>
        </Card>
      )}

      {/* Location / Constituency Finder Widget */}
      <Card padding="md" className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap border-b border-border-light/20 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-accent/10 border border-accent/20 text-accent">
              <MapPin size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-main flex items-center gap-2">
                Find Elections in Your Constituency
              </h2>
              <p className="text-xs text-text-muted">
                Search your address, click on the map, or use Auto-Detect GPS to
                discover elections in your local electoral boundaries.
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPicker(!showPicker)}
            className="gap-1.5 text-xs shrink-0"
          >
            <Search size={14} />
            {showPicker ? "Hide Map & Location Search" : "Search Address / Map"}
          </Button>
        </div>

        {showPicker && (
          <InteractiveLocationPicker
            currentLat={currentLat}
            currentLng={currentLng}
            onLocationSelect={handleLocationSelect}
            loading={locLoading}
            error={locError}
          />
        )}

        {/* Matched Constituencies Badge Bar */}
        {matchedBoundaries.length > 0 && (
          <div className="p-3 bg-primary/10 border border-primary/30 rounded-xl space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs text-text-muted uppercase font-bold tracking-wider flex items-center gap-1.5">
                <Layers size={14} className="text-accent" /> Verified in{" "}
                {matchedBoundaries.length} electoral district
                {matchedBoundaries.length > 1 ? "s" : ""}
              </p>

              {hasCustomLocation && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetLocation}
                  className="text-xs gap-1 py-0.5 px-2"
                >
                  <RotateCcw size={12} /> Reset to Default
                </Button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {matchedBoundaries.map((b) => (
                <span
                  key={`mb-${b.id}`}
                  className="px-3 py-1 bg-surface-elevated border border-border-light/40 rounded-xl text-xs font-medium text-text-main flex items-center gap-1.5 shadow-sm"
                >
                  <Check size={12} className="text-accent" /> {b.name}
                  {b.boundary_type && (
                    <span className="text-[10px] text-text-muted font-normal">
                      ({b.boundary_type})
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Elections & Open Seats List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="md" />
        </div>
      ) : seats.length === 0 ? (
        <EmptyState
          icon={Vote}
          title="No Active Elections Found"
          description={
            matchedBoundaries.length > 0
              ? "There are no active elections or open seats currently running for your selected constituency boundaries."
              : "There are no active elections running right now."
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-text-muted px-1">
            <span>
              Showing {seats.length} active seat
              {seats.length !== 1 ? "s" : ""}
            </span>
          </div>

          {seats.map((seat) => (
            <Card
              key={seat.id}
              as={Link}
              href={`/elections/seat/${buildSeatSlug(seat)}`}
              interactive
              className="w-full text-left overflow-hidden flex items-center justify-between gap-4 group"
            >
              <div className="min-w-0">
                <p className="text-xs text-text-muted mb-1">
                  {seat.elections?.name} · {seat.elections?.election_date}
                </p>
                <h2 className="text-lg font-bold text-text-main flex items-center gap-2 flex-wrap">
                  {seat.role_title}
                  {seat.map_shapes?.name && (
                    <span className="text-sm font-normal text-text-muted flex items-center gap-1">
                      <MapPin size={13} className="text-accent" />{" "}
                      {seat.map_shapes.name}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-text-muted mt-1.5 flex items-center gap-1.5">
                  <Users size={12} />
                  {seat.candidates.length === 0
                    ? "No candidates yet"
                    : `${seat.candidates.length} candidate${
                        seat.candidates.length !== 1 ? "s" : ""
                      }`}
                </p>
              </div>
              <ChevronRight
                size={18}
                className="text-text-darker group-hover:text-primary-light transition-colors shrink-0"
              />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
