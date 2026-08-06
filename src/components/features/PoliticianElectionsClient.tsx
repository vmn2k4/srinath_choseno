"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  getOpenSeatsNearShapeIds,
  getMyCandidacies,
  findOpenSeatsInContainer,
  applyForSeat,
  deleteCandidacy,
} from "@/lib/services/elections";
import {
  getCountries,
  listBoundaryTypes,
  getMapShapesByType,
  findBoundariesByPoint,
} from "@/lib/services/boundaries";
import InteractiveLocationPicker from "./InteractiveLocationPicker";
import { getUserBoundaryShapeIds } from "@/lib/services/profile";
import { buildSeatSlug } from "@/lib/utils/slugs";
import { Vote, MapPin, FileEdit, Search } from "lucide-react";
import {
  Card,
  Button,
  Badge,
  Select,
  Spinner,
  EmptyState,
  PageHeader,
  ConfirmDialog,
} from "@/components/primitives";
import { createClient } from "@/lib/supabase/client";

interface StatusConfig {
  label: string;
  tone: "amber" | "emerald" | "rose";
}

const STATUS_COPY: Record<string, StatusConfig> = {
  pending: { label: "Pending Review", tone: "amber" },
  approved: { label: "Approved", tone: "emerald" },
  rejected: { label: "Not Approved", tone: "rose" },
};

export default function PoliticianElectionsClient() {
  const supabase = createClient();
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [openSeats, setOpenSeats] = useState<any[]>([]);
  const [myCandidacies, setMyCandidacies] = useState<any[]>([]);
  const [applyingSeatId, setApplyingSeatId] = useState<string | null>(null);
  const [withdrawCandidateId, setWithdrawCandidateId] = useState<string | null>(
    null
  );

  // Browse a different area
  const [browsing, setBrowsing] = useState(false);
  const [browseMode, setBrowseMode] = useState<"map" | "dropdown">("map");
  const [countries, setCountries] = useState<string[]>([]);
  const [browseCountry, setBrowseCountry] = useState("");
  const [containerTypes, setContainerTypes] = useState<string[]>([]);
  const [browseContainerType, setBrowseContainerType] = useState("");
  const [containers, setContainers] = useState<any[]>([]);
  const [browseContainerId, setBrowseContainerId] = useState("");
  const [browseSeats, setBrowseSeats] = useState<any[] | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseStatus, setBrowseStatus] = useState("");

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);

    const { data: memberships } = await getUserBoundaryShapeIds(
      supabase,
      user.id
    );
    const shapeIds = ((memberships || []) as Array<{ map_shape_id: number }>).map(
      (m) => m.map_shape_id
    );

    if (shapeIds.length > 0) {
      const { data: seats } = await getOpenSeatsNearShapeIds(supabase, shapeIds);
      setOpenSeats(seats || []);
    } else {
      setOpenSeats([]);
    }

    const { data: candidacies } = await getMyCandidacies(supabase, user.id);
    setMyCandidacies(candidacies || []);

    setLoading(false);
  };

  useEffect(() => {
    if (user) Promise.resolve().then(() => fetchAll());
    getCountries(supabase).then(({ data }) =>
      setCountries((data || []).map((c: any) => c.name))
    );
  }, [user, supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    Promise.resolve().then(() => {
      setBrowseContainerType("");
      setContainers([]);
      setBrowseContainerId("");
      setBrowseSeats(null);
      if (!browseCountry) {
        setContainerTypes([]);
        return;
      }
      listBoundaryTypes(supabase, {
        country: browseCountry,
        isContainer: true,
        columns: "type_name",
      }).then(({ data }) =>
        setContainerTypes((data || []).map((t: any) => t.type_name))
      );
    });
  }, [browseCountry, supabase]);

  useEffect(() => {
    Promise.resolve().then(() => {
      setBrowseContainerId("");
      setBrowseSeats(null);
      if (!browseCountry || !browseContainerType) {
        setContainers([]);
        return;
      }
      getMapShapesByType(supabase, {
        country: browseCountry,
        boundaryType: browseContainerType,
        columns: "id, name",
        orderBy: "name",
      }).then(({ data }) => setContainers(data || []));
    });
  }, [browseCountry, browseContainerType, supabase]);

  const searchContainer = async () => {
    if (!browseContainerId) return;
    setBrowseLoading(true);
    setBrowseStatus("");
    const { data, error } = await findOpenSeatsInContainer(
      supabase,
      Number(browseContainerId)
    );
    setBrowseLoading(false);
    if (error) {
      setBrowseStatus("Error: " + error.message);
      return;
    }
    setBrowseSeats(data || []);
    if ((data || []).length === 0) {
      setBrowseStatus("No open seats found there.");
    }
  };

  const handleMapLocationSelect = async (lat: number, lng: number) => {
    setBrowseLoading(true);
    setBrowseStatus("Searching for electoral boundaries at selected map location...");
    setBrowseSeats(null);

    const { data: bData, error: bErr } = await findBoundariesByPoint(supabase, lat, lng);
    if (bErr || !bData || bData.length === 0) {
      setBrowseLoading(false);
      setBrowseStatus("No mapped electoral boundaries found for that map location yet.");
      return;
    }

    const shapeIds = (bData as any[]).map((b) => b.id);
    const { data: seatsData, error: seatsErr } = await getOpenSeatsNearShapeIds(supabase, shapeIds);
    setBrowseLoading(false);

    if (seatsErr) {
      setBrowseStatus("Error searching seats: " + seatsErr.message);
      return;
    }

    const seatsList = (seatsData || []).map((s: any) => ({
      seat_id: s.id,
      role_title: s.role_title,
      shape_name: s.map_shapes?.name || s.shape_name,
      election_name: s.elections?.name,
      election_date: s.elections?.election_date,
    }));

    setBrowseSeats(seatsList);

    if (seatsList.length === 0) {
      const boundaryNames = (bData as any[]).map((b) => b.name).filter(Boolean).join(", ");
      setBrowseStatus(
        `Electoral boundaries found (${boundaryNames}), but no active open election seats exist for them right now.`
      );
    } else {
      setBrowseStatus(
        `Found ${seatsList.length} open seat(s) for location (${lat.toFixed(4)}, ${lng.toFixed(4)}).`
      );
    }
  };

  const myCandidacySeatIds = new Set(myCandidacies.map((c) => c.seat_id));

  const startApplying = async (seatId: string) => {
    setApplyingSeatId(seatId);
    const { data, error } = await applyForSeat(supabase, seatId);
    setApplyingSeatId(null);
    if (error) {
      alert("Error: " + error.message);
      return;
    }
    router.push(`/apply/${data.id}`);
  };

  const handleWithdrawConfirm = async () => {
    if (!withdrawCandidateId) return;
    await deleteCandidacy(supabase, withdrawCandidateId);
    setWithdrawCandidateId(null);
    await fetchAll();
  };

  if (loading) return <Spinner fullPage />;

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 space-y-10">
      <PageHeader icon={Vote} title="My Elections" />

      {/* Candidacies */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-text-muted uppercase tracking-wider">
          My Candidacies ({myCandidacies.length})
        </h2>

        {myCandidacies.length === 0 ? (
          <Card padding="md" className="text-center py-8">
            <p className="text-xs text-text-muted">
              You have not applied for any election seats yet. Check open seats below to run!
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myCandidacies.map((cand) => {
              const statusCfg = STATUS_COPY[cand.status] || STATUS_COPY.pending;
              return (
                <Card
                  key={cand.id}
                  padding="md"
                  interactive
                  className="space-y-3 cursor-pointer"
                  onClick={() =>
                    router.push(
                      `/elections/seat/${buildSeatSlug({ id: cand.seat_id, ...cand.election_seats })}`
                    )
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-text-main text-base">
                        {cand.election_seats?.role_title}
                      </h3>
                      <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                        <MapPin size={12} className="text-accent" />{" "}
                        {cand.election_seats?.map_shapes?.name}
                      </p>
                    </div>
                    <Badge tone={statusCfg.tone}>{statusCfg.label}</Badge>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border-light/20 text-xs">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/apply/${cand.id}`);
                      }}
                      className="gap-1.5"
                    >
                      <FileEdit size={13} /> Edit Application
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setWithdrawCandidateId(cand.id);
                      }}
                      className="text-danger hover:text-danger"
                    >
                      Withdraw
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Open Seats Near You */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-sm font-bold text-text-muted uppercase tracking-wider">
            Open Seats Near You ({openSeats.length})
          </h2>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setBrowsing(!browsing)}
            className="text-xs gap-1"
          >
            <Search size={13} /> Browse Different Area
          </Button>
        </div>

        {/* Browse different area container selector & interactive map */}
        {browsing && (
          <Card padding="md" className="space-y-4 bg-surface/40 animate-fade-in">
            <div className="flex items-center justify-between gap-4 flex-wrap border-b border-border-light/20 pb-3">
              <h3 className="text-xs font-bold text-text-main uppercase tracking-wider">
                Browse Seats in Another Area
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBrowseMode("map")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    browseMode === "map"
                      ? "bg-primary text-text-on-primary shadow-sm"
                      : "bg-surface-hover/80 text-text-muted hover:text-text-main"
                  }`}
                >
                  📍 Point on Map / Search Address
                </button>
                <button
                  type="button"
                  onClick={() => setBrowseMode("dropdown")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    browseMode === "dropdown"
                      ? "bg-primary text-text-on-primary shadow-sm"
                      : "bg-surface-hover/80 text-text-muted hover:text-text-main"
                  }`}
                >
                  🔍 Jurisdiction Dropdowns
                </button>
              </div>
            </div>

            {browseMode === "map" ? (
              <div className="space-y-3">
                <p className="text-xs text-text-muted">
                  Click/point anywhere on the map or search an address to discover active election seats in that location:
                </p>
                <InteractiveLocationPicker
                  onLocationSelect={handleMapLocationSelect}
                  loading={browseLoading}
                  error={browseStatus.startsWith("Error") ? browseStatus : ""}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <Select
                    value={browseCountry}
                    onChange={(e) => setBrowseCountry(e.target.value)}
                  >
                    <option value="">Select Country...</option>
                    {countries.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>

                  <Select
                    value={browseContainerType}
                    onChange={(e) => setBrowseContainerType(e.target.value)}
                    disabled={!browseCountry}
                  >
                    <option value="">Select Region Type...</option>
                    {containerTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>

                  <Select
                    value={browseContainerId}
                    onChange={(e) => setBrowseContainerId(e.target.value)}
                    disabled={!browseContainerType}
                  >
                    <option value="">Select Region...</option>
                    {containers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <Button
                  size="sm"
                  onClick={searchContainer}
                  disabled={!browseContainerId || browseLoading}
                >
                  {browseLoading ? "Searching..." : "Find Open Seats"}
                </Button>
              </div>
            )}

            {browseStatus && (
              <p className={`text-xs ${browseStatus.startsWith("Error") ? "text-danger font-semibold" : "text-text-muted"}`}>
                {browseStatus}
              </p>
            )}

            {browseSeats && browseSeats.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-border-light/20">
                {browseSeats.map((seat: any) => {
                  const sId = seat.seat_id || seat.id;
                  const shapeName = seat.shape_name || seat.map_shapes?.name || "";
                  const isApplied = myCandidacySeatIds.has(sId);

                  return (
                    <div
                      key={sId}
                      className="flex items-center justify-between gap-4 p-3 bg-surface-elevated rounded-xl border border-border-light/30 text-xs"
                    >
                      <div>
                        <span className="font-bold text-text-main">
                          {seat.role_title}
                        </span>
                        {shapeName && (
                          <span className="text-text-muted ml-2">
                            ({shapeName})
                          </span>
                        )}
                      </div>

                      <Button
                        size="sm"
                        onClick={() => startApplying(sId)}
                        disabled={isApplied || applyingSeatId === sId}
                      >
                        {isApplied ? "Applied" : "Apply to Run"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        {/* Nearby seats list */}
        {openSeats.length === 0 ? (
          <EmptyState
            icon={Vote}
            title="No Open Seats Found"
            description="There are currently no nominating seats open in your immediate boundary memberships."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {openSeats.map((seat) => {
              const alreadyApplied = myCandidacySeatIds.has(seat.id);
              return (
                <Card
                  key={seat.id}
                  padding="md"
                  interactive
                  className="space-y-3 cursor-pointer"
                  onClick={() => router.push(`/elections/seat/${buildSeatSlug(seat)}`)}
                >
                  <div>
                    <p className="text-[11px] text-text-muted mb-1">
                      {seat.elections?.name} · {seat.elections?.election_date}
                    </p>
                    <h3 className="font-bold text-text-main text-base">
                      {seat.role_title}
                    </h3>
                    <p className="text-xs text-text-muted flex items-center gap-1 mt-1">
                      <MapPin size={12} className="text-accent" />{" "}
                      {seat.map_shapes?.name}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border-light/20 text-xs">
                    <span className="text-text-muted">
                      {seat.candidate_count || 0} candidates
                    </span>

                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        startApplying(seat.id);
                      }}
                      disabled={alreadyApplied || applyingSeatId === seat.id}
                    >
                      {alreadyApplied
                        ? "Applied"
                        : applyingSeatId === seat.id
                        ? "Starting..."
                        : "Nominate Yourself"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {withdrawCandidateId && (
        <ConfirmDialog
          open={!!withdrawCandidateId}
          title="Withdraw Candidacy?"
          message="Are you sure you want to withdraw your candidacy for this seat? This will remove your application."
          confirmLabel="Withdraw"
          tone="danger"
          onConfirm={handleWithdrawConfirm}
          onCancel={() => setWithdrawCandidateId(null)}
        />
      )}
    </div>
  );
}
