"use client";

import React, { useState, useEffect, useMemo } from "react";
import AdminSubNav from "./AdminSubNav";
import { createClient } from "@/lib/supabase/client";
import { reviewCandidacyClaim } from "@/lib/services/elections";
import {
  Card,
  Button,
  Badge,
  Input,
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
  User,
  Phone,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";

interface ClaimRequestRow {
  id: string;
  candidate_id: string;
  requester_profile_id: string | null;
  requester_name: string | null;
  motivation: string | null;
  contact_email: string | null;
  social_media_info: string | null;
  status: "pending" | "approved" | "rejected";
  submitted_at: string;
  reviewed_at: string | null;
  // Resolved candidate info
  politicianName: string;
  roleTitle: string;
  boundaryName: string;
  wallSlug: string | null;
  // Resolved requester profile info
  requesterAccountName?: string | null;
  requesterAccountEmail?: string | null;
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
      // 1. Fetch raw claim requests with joined requester profiles
      const { data: rawRequests, error: reqError } = await supabase
        .from("candidacy_claim_requests")
        .select(`
          *,
          requester_profile:profiles!candidacy_claim_requests_requester_profile_id_fkey ( id, full_name, email )
        `)
        .order("submitted_at", { ascending: false });

      if (reqError) {
        console.error("Error fetching candidacy claim requests:", reqError);
        // Fallback simple query
        const { data: simpleReqs } = await supabase
          .from("candidacy_claim_requests")
          .select("*")
          .order("submitted_at", { ascending: false });
        if (!simpleReqs || simpleReqs.length === 0) {
          setRequests([]);
          setLoading(false);
          return;
        }
        await processAndSetRequests(simpleReqs);
        return;
      }

      await processAndSetRequests(rawRequests || []);
    } catch (err) {
      console.error("Error loading claim requests:", err);
    } finally {
      setLoading(false);
    }
  };

  const processAndSetRequests = async (rawRequests: any[]) => {
    if (!rawRequests || rawRequests.length === 0) {
      setRequests([]);
      return;
    }

    const candidateIds = Array.from(new Set(rawRequests.map((r: any) => r.candidate_id)));

    // 2. Resolve via election_candidates
    const { data: candidateRows } = await supabase
      .from("election_candidates")
      .select(`
        id,
        seat_id,
        profiles!election_candidates_politician_id_fkey (
          id, full_name, current_ghost_id,
          politician_profiles ( wall_slug, political_target_role, target_boundary_name )
        ),
        election_seats (
          id, role_title,
          map_shapes ( name )
        )
      `)
      .in("id", candidateIds);

    const candidateMap = new Map<string, any>();
    (candidateRows || []).forEach((c: any) => {
      candidateMap.set(c.id, c);
    });

    // 3. Also resolve directly via profiles (for politician wall claims)
    const { data: profileRows } = await supabase
      .from("profiles")
      .select(`
        id, full_name, current_ghost_id,
        politician_profiles ( wall_slug, political_target_role, target_boundary_name )
      `)
      .in("id", candidateIds);

    const profileMap = new Map<string, any>();
    (profileRows || []).forEach((p: any) => {
      profileMap.set(p.id, p);
    });

    // 4. Map records
    const formatted: ClaimRequestRow[] = rawRequests.map((req: any) => {
      let politicianName = "Unknown Candidate";
      let roleTitle = "Representative";
      let boundaryName = "Local District";
      let wallSlug: string | null = null;

      const cand = candidateMap.get(req.candidate_id);
      if (cand) {
        const prof = cand.profiles;
        const polProf = Array.isArray(prof?.politician_profiles) ? prof.politician_profiles[0] : prof?.politician_profiles;
        const seat = cand.election_seats;
        const shape = Array.isArray(seat?.map_shapes) ? seat.map_shapes[0] : seat?.map_shapes;

        politicianName = prof?.full_name || politicianName;
        roleTitle = seat?.role_title || polProf?.political_target_role || roleTitle;
        boundaryName = shape?.name || polProf?.target_boundary_name || boundaryName;
        wallSlug = polProf?.wall_slug || prof?.current_ghost_id || null;
      } else {
        const prof = profileMap.get(req.candidate_id);
        if (prof) {
          const polProf = Array.isArray(prof.politician_profiles) ? prof.politician_profiles[0] : prof.politician_profiles;
          politicianName = prof.full_name || politicianName;
          roleTitle = polProf?.political_target_role || roleTitle;
          boundaryName = polProf?.target_boundary_name || boundaryName;
          wallSlug = polProf?.wall_slug || prof.current_ghost_id || null;
        }
      }

      return {
        id: req.id,
        candidate_id: req.candidate_id,
        requester_profile_id: req.requester_profile_id || null,
        requester_name: req.requester_name || req.requester_profile?.full_name || null,
        motivation: req.motivation || null,
        contact_email: req.contact_email || null,
        social_media_info: req.social_media_info || null,
        status: req.status,
        submitted_at: req.submitted_at,
        reviewed_at: req.reviewed_at,
        politicianName,
        roleTitle,
        boundaryName,
        wallSlug,
        requesterAccountName: req.requester_profile?.full_name || null,
        requesterAccountEmail: req.requester_profile?.email || null,
      };
    });

    setRequests(formatted);
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
      // Fallback update directly
      const { error: directErr } = await supabase
        .from("candidacy_claim_requests")
        .update({
          status: approve ? "approved" : "rejected",
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (directErr) {
        setActionStatus((prev) => ({
          ...prev,
          [requestId]: "Error: " + directErr.message,
        }));
      } else {
        setActionStatus((prev) => ({
          ...prev,
          [requestId]: approve ? "Approved claim request" : "Rejected claim request",
        }));
        fetchClaimRequests();
      }
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
        const candidateName = req.politicianName.toLowerCase();
        const reqName = (req.requester_name || "").toLowerCase();
        const email = (req.contact_email || "").toLowerCase();
        const social = (req.social_media_info || "").toLowerCase();
        const motivation = (req.motivation || "").toLowerCase();
        const boundary = req.boundaryName.toLowerCase();
        const role = req.roleTitle.toLowerCase();

        return (
          candidateName.includes(q) ||
          reqName.includes(q) ||
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
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 space-y-6">
      <PageHeader
        icon={ShieldCheck}
        title="Profile & Candidacy Claim Requests"
        subtitle="Review, approve, reject, or manage incoming candidate and politician profile claim requests."
      />

      <AdminSubNav active="claim_requests" />

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card padding="sm" className="space-y-1">
          <p className="text-xs text-text-muted font-medium">Pending Review</p>
          <p className="text-2xl font-bold text-warning-light">{pendingCount}</p>
        </Card>
        <Card padding="sm" className="space-y-1">
          <p className="text-xs text-text-muted font-medium">Approved Claims</p>
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
            const isPending = req.status === "pending";

            return (
              <Card key={req.id} padding="md" className="space-y-4 border border-border/60 hover:border-primary/30 transition-colors">
                {/* Header Row */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border-light/20 pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-base text-text-main flex items-center gap-1.5">
                        <UserCheck size={18} className="text-primary" />
                        {req.politicianName}
                      </h3>
                      <Badge tone="primary">
                        {req.roleTitle}
                      </Badge>
                      <span className="text-xs text-text-muted flex items-center gap-1">
                        <Building size={12} />
                        {req.boundaryName}
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

                    {req.wallSlug && (
                      <Link
                        href={`/wall/${req.wallSlug}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline px-2.5 py-1 rounded-lg bg-primary/10"
                      >
                        <ExternalLink size={13} /> View Wall
                      </Link>
                    )}
                  </div>
                </div>

                {/* Submitter Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-surface/30 p-3.5 rounded-xl border border-border-light/20 text-xs">
                  <div>
                    <span className="font-semibold text-text-muted flex items-center gap-1 mb-1">
                      <User size={13} /> Submitter Name
                    </span>
                    <span className="text-text-main font-bold">
                      {req.requester_name || req.requesterAccountName || "Not provided"}
                    </span>
                  </div>

                  <div>
                    <span className="font-semibold text-text-muted flex items-center gap-1 mb-1">
                      <Mail size={13} /> Contact Email
                    </span>
                    {req.contact_email ? (
                      <a
                        href={`mailto:${req.contact_email}?subject=Choseno Profile Claim for ${req.politicianName}`}
                        className="text-primary hover:underline font-medium inline-flex items-center gap-1"
                      >
                        {req.contact_email}
                      </a>
                    ) : (
                      <span className="text-text-muted italic">Not provided</span>
                    )}
                  </div>

                  <div>
                    <span className="font-semibold text-text-muted flex items-center gap-1 mb-1">
                      <Phone size={13} /> Phone / Social Link
                    </span>
                    <span className="text-text-main font-medium">
                      {req.social_media_info || "Not provided"}
                    </span>
                  </div>

                  <div>
                    <span className="font-semibold text-text-muted flex items-center gap-1 mb-1">
                      <ShieldCheck size={13} /> User Account ID
                    </span>
                    {req.requester_profile_id ? (
                      <span className="text-text-muted font-mono text-[11px] truncate block" title={req.requester_profile_id}>
                        {req.requester_profile_id.slice(0, 16)}...
                      </span>
                    ) : (
                      <span className="text-text-muted italic font-sans text-[11px]">Guest Submitter</span>
                    )}
                  </div>
                </div>

                {/* Verification Motivation / Note */}
                {req.motivation && (
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-text-muted flex items-center gap-1">
                      <MessageSquare size={13} /> Verification Note / Message:
                    </span>
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
                        href={`mailto:${req.contact_email}?subject=Choseno Profile Claim Verification - ${req.politicianName}`}
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
