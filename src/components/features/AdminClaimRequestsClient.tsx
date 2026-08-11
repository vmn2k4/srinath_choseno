"use client";

import React, { useState, useEffect, useMemo } from "react";
import AdminSubNav from "./AdminSubNav";
import { createClient } from "@/lib/supabase/client";
import {
  reviewCandidacyClaim,
} from "@/lib/services/elections";
import {
  Card,
  Button,
  Badge,
  Input,
  Select,
  Spinner,
  PageHeader,
  EmptyState,
  Alert,
} from "@/components/primitives";
import {
  CheckCircle2,
  XCircle,
  Mail,
  ShieldCheck,
  Search,
  ExternalLink,
  Calendar,
  UserCheck,
  Building,
} from "lucide-react";
import Link from "next/link";

interface ClaimRequestRow {
  id: string;
  candidate_id: string;
  requester_profile_id: string;
  motivation: string | null;
  contact_email: string | null;
  social_media_info: string | null;
  status: "pending" | "approved" | "rejected";
  submitted_at: string;
  reviewed_at: string | null;
  candidate?: {
    id: string;
    statement: string | null;
    seat_id: string | null;
    politician?: {
      id: string;
      full_name: string | null;
      current_ghost_id: string | null;
      politician_profiles?: {
        wall_slug?: string | null;
        political_target_role?: string | null;
        target_boundary_name?: string | null;
        photo_url?: string | null;
        avatar_url?: string | null;
      } | null;
    } | null;
    seat?: {
      id: string;
      role_title: string | null;
      map_shapes?: {
        name: string | null;
        boundary_type: string | null;
      } | null;
      elections?: {
        name: string | null;
      } | null;
    } | null;
  } | null;
}

export default function AdminClaimRequestsClient() {
  const supabase = createClient();
  const [requests, setRequests] = useState<ClaimRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionStatus, setActionStatus] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const fetchClaimRequests = async () => {
    setLoading(true);

    try {
      // Query candidacy_claim_requests
      const { data, error } = await supabase
        .from("candidacy_claim_requests")
        .select(`
          id, candidate_id, requester_profile_id, motivation, contact_email, social_media_info, status, submitted_at, reviewed_at,
          election_candidates (
            id, statement, seat_id,
            profiles!election_candidates_politician_id_fkey (
              id, full_name, current_ghost_id,
              politician_profiles ( wall_slug, political_target_role, target_boundary_name, photo_url, avatar_url )
            ),
            election_seats (
              id, role_title,
              map_shapes ( name, boundary_type ),
              elections ( name )
            )
          )
        `)
        .order("submitted_at", { ascending: false });

      if (error) {
        console.error("Error fetching claim requests:", error);
      } else {
        const formatted: ClaimRequestRow[] = (data || []).map((row: any) => ({
          id: row.id,
          candidate_id: row.candidate_id,
          requester_profile_id: row.requester_profile_id,
          motivation: row.motivation,
          contact_email: row.contact_email,
          social_media_info: row.social_media_info,
          status: row.status,
          submitted_at: row.submitted_at,
          reviewed_at: row.reviewed_at,
          candidate: row.election_candidates
            ? {
                id: row.election_candidates.id,
                statement: row.election_candidates.statement,
                seat_id: row.election_candidates.seat_id,
                politician: row.election_candidates.profiles
                  ? {
                      id: row.election_candidates.profiles.id,
                      full_name: row.election_candidates.profiles.full_name,
                      current_ghost_id: row.election_candidates.profiles.current_ghost_id,
                      politician_profiles: Array.isArray(row.election_candidates.profiles.politician_profiles)
                        ? row.election_candidates.profiles.politician_profiles[0]
                        : row.election_candidates.profiles.politician_profiles,
                    }
                  : null,
                seat: row.election_candidates.election_seats
                  ? {
                      id: row.election_candidates.election_seats.id,
                      role_title: row.election_candidates.election_seats.role_title,
                      map_shapes: Array.isArray(row.election_candidates.election_seats.map_shapes)
                        ? row.election_candidates.election_seats.map_shapes[0]
                        : row.election_candidates.election_seats.map_shapes,
                      elections: Array.isArray(row.election_candidates.election_seats.elections)
                        ? row.election_candidates.election_seats.elections[0]
                        : row.election_candidates.election_seats.elections,
                    }
                  : null,
              }
            : null,
        }));
        setRequests(formatted);
      }
    } catch (err) {
      console.error("Error loading claim requests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaimRequests();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReview = async (requestId: string, approve: boolean) => {
    setActionLoading((prev) => ({ ...prev, [requestId]: true }));
    setActionStatus((prev) => ({ ...prev, [requestId]: "" }));

    const { error } = await reviewCandidacyClaim(supabase, requestId, approve);

    setActionLoading((prev) => ({ ...prev, [requestId]: false }));
    if (error) {
      setActionStatus((prev) => ({
        ...prev,
        [requestId]: "Error: " + error.message,
      }));
    } else {
      setActionStatus((prev) => ({
        ...prev,
        [requestId]: approve ? "Approved successfully" : "Rejected request",
      }));
      fetchClaimRequests();
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      // Status filter
      if (statusFilter !== "all" && req.status !== statusFilter) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const candidateName = req.candidate?.politician?.full_name?.toLowerCase() || "";
        const email = req.contact_email?.toLowerCase() || "";
        const social = req.social_media_info?.toLowerCase() || "";
        const motivation = req.motivation?.toLowerCase() || "";
        const boundary = req.candidate?.seat?.map_shapes?.name?.toLowerCase() || "";
        const role = req.candidate?.seat?.role_title?.toLowerCase() || "";

        return (
          candidateName.includes(q) ||
          email.includes(q) ||
          social.includes(q) ||
          motivation.includes(q) ||
          boundary.includes(q) ||
          role.includes(q)
        );
      }

      return true;
    });
  }, [requests, statusFilter, searchQuery]);

  const pendingCount = useMemo(() => requests.filter((r) => r.status === "pending").length, [requests]);
  const approvedCount = useMemo(() => requests.filter((r) => r.status === "approved").length, [requests]);
  const rejectedCount = useMemo(() => requests.filter((r) => r.status === "rejected").length, [requests]);

  return (
    <div className="w-full space-y-6">
      <AdminSubNav active="claim_requests" />

      <PageHeader
        title="Profile & Candidacy Claim Requests"
        subtitle="Review, approve, or reject incoming profile verification & candidate wall claim requests."
      />

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card padding="sm" className="space-y-1">
          <p className="text-xs text-text-muted font-medium">Pending Review</p>
          <p className="text-2xl font-bold text-warning-light">{pendingCount}</p>
        </Card>
        <Card padding="sm" className="space-y-1">
          <p className="text-xs text-text-muted font-medium font-medium">Approved Claims</p>
          <p className="text-2xl font-bold text-success-light">{approvedCount}</p>
        </Card>
        <Card padding="sm" className="space-y-1">
          <p className="text-xs text-text-muted font-medium">Rejected Claims</p>
          <p className="text-2xl font-bold text-danger-light">{rejectedCount}</p>
        </Card>
        <Card padding="sm" className="space-y-1">
          <p className="text-xs text-text-muted font-medium">Total Requests</p>
          <p className="text-2xl font-bold text-text-main">{requests.length}</p>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <Card padding="md" className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={statusFilter === "pending" ? "primary" : "outline"}
              onClick={() => setStatusFilter("pending")}
            >
              Pending ({pendingCount})
            </Button>
            <Button
              size="sm"
              variant={statusFilter === "approved" ? "primary" : "outline"}
              onClick={() => setStatusFilter("approved")}
            >
              Approved ({approvedCount})
            </Button>
            <Button
              size="sm"
              variant={statusFilter === "rejected" ? "primary" : "outline"}
              onClick={() => setStatusFilter("rejected")}
            >
              Rejected ({rejectedCount})
            </Button>
            <Button
              size="sm"
              variant={statusFilter === "all" ? "primary" : "outline"}
              onClick={() => setStatusFilter("all")}
            >
              All ({requests.length})
            </Button>
          </div>

          <div className="relative w-full sm:w-72">
            <Input
              placeholder="Search candidate name, email, city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          </div>
        </div>
      </Card>

      {/* Requests List */}
      {loading ? (
        <Card padding="lg" className="text-center py-12">
          <Spinner size="md" />
          <p className="text-xs text-text-muted mt-3">Loading claim requests...</p>
        </Card>
      ) : filteredRequests.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={ShieldCheck}
            title="No Claim Requests Found"
            description={
              statusFilter === "pending"
                ? "There are currently no pending profile claim requests waiting for approval."
                : "No claim requests match your current search and filter settings."
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((req) => {
            const politicianName = req.candidate?.politician?.full_name || "Unknown Candidate";
            const roleTitle = req.candidate?.seat?.role_title || req.candidate?.politician?.politician_profiles?.political_target_role || "Representative";
            const boundaryName = req.candidate?.seat?.map_shapes?.name || req.candidate?.politician?.politician_profiles?.target_boundary_name || "Local District";
            const wallSlug = req.candidate?.politician?.politician_profiles?.wall_slug;
            const isPending = req.status === "pending";

            return (
              <Card key={req.id} padding="md" className="space-y-4 border border-border/60 hover:border-primary/30 transition-colors">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border-light/20 pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-base text-text-main flex items-center gap-1.5">
                        <UserCheck size={18} className="text-primary" />
                        {politicianName}
                      </h3>
                      <Badge tone="primary">
                        {roleTitle}
                      </Badge>
                      <span className="text-xs text-text-muted flex items-center gap-1">
                        <Building size={12} />
                        {boundaryName}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted flex items-center gap-2">
                      <Calendar size={12} />
                      Submitted: {new Date(req.submitted_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      tone={
                        req.status === "approved"
                          ? "emerald"
                          : req.status === "rejected"
                          ? "rose"
                          : "amber"
                      }
                      className="capitalize"
                    >
                      {req.status}
                    </Badge>

                    {wallSlug && (
                      <Link
                        href={`/wall/${wallSlug}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline px-2.5 py-1 rounded-lg bg-primary/10"
                      >
                        <ExternalLink size={13} /> View Wall
                      </Link>
                    )}
                  </div>
                </div>

                {/* Requester Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-surface/30 p-3 rounded-xl border border-border-light/20 text-xs">
                  <div>
                    <span className="font-semibold text-text-muted block mb-0.5">Contact Email</span>
                    {req.contact_email ? (
                      <a
                        href={`mailto:${req.contact_email}?subject=Choseno Profile Claim for ${politicianName}`}
                        className="text-primary hover:underline font-medium inline-flex items-center gap-1"
                      >
                        <Mail size={13} /> {req.contact_email}
                      </a>
                    ) : (
                      <span className="text-text-muted italic">Not provided</span>
                    )}
                  </div>

                  <div>
                    <span className="font-semibold text-text-muted block mb-0.5">Phone / Social Link</span>
                    <span className="text-text-main font-medium">
                      {req.social_media_info || "Not provided"}
                    </span>
                  </div>

                  <div>
                    <span className="font-semibold text-text-muted block mb-0.5">Requester Profile ID</span>
                    <span className="text-text-muted font-mono text-[11px] truncate block">
                      {req.requester_profile_id || "Guest / Unauthenticated"}
                    </span>
                  </div>
                </div>

                {/* Verification Motivation / Note */}
                {req.motivation && (
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-text-muted block">Verification Note / Message:</span>
                    <p className="text-xs text-text-main bg-background p-3 rounded-xl border border-border-light/30 italic">
                      &quot;{req.motivation}&quot;
                    </p>
                  </div>
                )}

                {/* Action Feedback */}
                {actionStatus[req.id] && (
                  <Alert tone={actionStatus[req.id].startsWith("Error") ? "danger" : "success"}>
                    {actionStatus[req.id]}
                  </Alert>
                )}

                {/* Action Buttons */}
                {isPending && (
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-border-light/20">
                    {req.contact_email && (
                      <a
                        href={`mailto:${req.contact_email}?subject=Choseno Profile Claim Verification - ${politicianName}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text-main bg-surface-hover hover:bg-surface-elevated rounded-xl border border-border-light/40 transition-colors"
                      >
                        <Mail size={14} /> Email Requester
                      </a>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionLoading[req.id]}
                      onClick={() => handleReview(req.id, false)}
                      className="gap-1.5 text-danger border-danger/30 hover:bg-danger/10"
                    >
                      <XCircle size={14} /> Reject Request
                    </Button>

                    <Button
                      size="sm"
                      disabled={actionLoading[req.id]}
                      onClick={() => handleReview(req.id, true)}
                      className="gap-1.5 bg-success hover:bg-success-dark text-white font-bold"
                    >
                      {actionLoading[req.id] ? (
                        <Spinner size="sm" />
                      ) : (
                        <>
                          <CheckCircle2 size={14} /> Approve &amp; Link Profile
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
