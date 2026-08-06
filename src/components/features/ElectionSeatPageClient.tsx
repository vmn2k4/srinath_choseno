"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import CandidacyWall from "./CandidacyWall";
import CurrentOfficeHolderCard from "./CurrentOfficeHolderCard";
import {
  getSeatById,
  getCandidatesBySeatIds,
  getMyCandidacies,
  applyForSeat,
  getSeatAdminStatus,
  applyForElectionAdmin,
  addUnregisteredCandidate,
  inviteCandidateToClaim,
  getClaimRequestsForSeat,
  reviewCandidacyClaim,
} from "@/lib/services/elections";
import { getPoliticalParties } from "@/lib/services/politicalParties";
import { getProfileRole, uploadAvatarImage } from "@/lib/services/profile";
import {
  Vote,
  MapPin,
  Users,
  Calendar,
  CheckCircle2,
  ShieldCheck,
  Mail,
  Check,
  X,
  Camera,
  Plus,
  Share2,
} from "lucide-react";
import {
  Card,
  Button,
  Badge,
  Input,
  Textarea,
  Select,
  Spinner,
  EmptyState,
  Avatar,
} from "@/components/primitives";
import { createClient } from "@/lib/supabase/client";
import { buildSeatSlug, buildCandidateSlug, extractIdFromSlug } from "@/lib/utils/slugs";
import { trackElectionViewed } from "@/lib/analytics/events";

interface ElectionSeatPageClientProps {
  seatId: string;
  initialSeat?: unknown | null;
  initialCandidates?: unknown[];
  initialCandidateId?: string;
}

export default function ElectionSeatPageClient({
  seatId,
  initialSeat = null,
  initialCandidates = [],
  initialCandidateId,
}: ElectionSeatPageClientProps) {
  const supabase = createClient();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(!initialSeat);
  const [seat, setSeat] = useState<any>(initialSeat);
  const [candidates, setCandidates] = useState<any[]>(initialCandidates as any[]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(() => {
    if (initialCandidateId) return initialCandidateId;
    if (typeof window !== "undefined") {
      const pathname = window.location.pathname;
      const matchCandidateInPath = pathname.match(/\/candidate\/([^\/]+)/);
      const candParam = matchCandidateInPath ? matchCandidateInPath[1] : new URLSearchParams(window.location.search).get("candidate");
      if (candParam) {
        const match = (initialCandidates as any[]).find(
          (c) => c.id === candParam || extractIdFromSlug(candParam) === c.id || buildCandidateSlug(c) === candParam
        );
        if (match) return match.id;
      }
    }
    return (initialCandidates as any[])[0]?.id || null;
  });
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  const handleSelectCandidate = (candidate: any) => {
    const candidateId = candidate.id;
    setSelectedCandidateId(candidateId);
    if (typeof window !== "undefined") {
      const candSlug = buildCandidateSlug(candidate);
      const seatSlug = seat ? buildSeatSlug(seat) : seatId;
      const newUrl = `/elections/seat/${seatSlug}/candidate/${candSlug}`;
      window.history.replaceState(null, "", newUrl);
    }
  };

  const handleCopyShareLink = () => {
    if (typeof window !== "undefined" && selectedCandidateId) {
      const activeCand = candidates.find((c) => c.id === selectedCandidateId);
      const candSlug = activeCand ? buildCandidateSlug(activeCand) : selectedCandidateId;
      const seatSlug = seat ? buildSeatSlug(seat) : seatId;
      const shareUrl = `${window.location.origin}/elections/seat/${seatSlug}/candidate/${candSlug}`;
      navigator.clipboard.writeText(shareUrl);
      setCopiedShareLink(true);
      setTimeout(() => setCopiedShareLink(false), 2500);
    }
  };
  const [role, setRole] = useState<string | null>(null);
  const [myCandidacies, setMyCandidacies] = useState<any[]>([]);
  const [applying, setApplying] = useState(false);
  const [status, setStatus] = useState("");

  // Election administrator application state
  const [adminStatus, setAdminStatus] = useState<any>(null);
  const [showAdminApplyForm, setShowAdminApplyForm] = useState(false);
  const [adminMotivation, setAdminMotivation] = useState("");
  const [adminSocialMedia, setAdminSocialMedia] = useState("");
  const [adminContactEmail, setAdminContactEmail] = useState("");
  const [submittingAdminApp, setSubmittingAdminApp] = useState(false);
  const [adminAppStatus, setAdminAppStatus] = useState("");

  // Add unregistered candidate (approved seat admins / superadmins)
  const [showAddCandidateForm, setShowAddCandidateForm] = useState(false);
  const [parties, setParties] = useState<any[]>([]);
  const [newCandidateName, setNewCandidateName] = useState("");
  const [newCandidateParty, setNewCandidateParty] = useState("");
  const [newCandidateEducation, setNewCandidateEducation] = useState("");
  const [newCandidateHometown, setNewCandidateHometown] = useState("");
  const [newCandidateBio, setNewCandidateBio] = useState("");
  const [newCandidateAvatarUrl, setNewCandidateAvatarUrl] = useState("");
  const [uploadingCandidateAvatar, setUploadingCandidateAvatar] = useState(false);
  const [candidateAvatarError, setCandidateAvatarError] = useState("");
  const [addingCandidate, setAddingCandidate] = useState(false);
  const [addCandidateStatus, setAddCandidateStatus] = useState("");

  // Claim invites & review claim requests
  const [inviteEmails, setInviteEmails] = useState<Record<string, string>>({});
  const [invitingCandidateId, setInvitingCandidateId] = useState<string | null>(null);
  const [inviteStatusByCandidate, setInviteStatusByCandidate] = useState<Record<string, string>>({});
  const [claimRequests, setClaimRequests] = useState<any[]>([]);
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null);

  const fetchAll = async () => {
    if (!seatId) return;
    if (!seat) setLoading(true);

    const { data: seatRow } = await getSeatById(supabase, seatId);
    setSeat(seatRow || null);

    const { data: candidateRows } = await getCandidatesBySeatIds(supabase, [seatId]);
    const candItems = (candidateRows as any[]) || [];
    setCandidates(candItems);

    const candParam = typeof window !== "undefined"
      ? (window.location.pathname.match(/\/candidate\/([^\/]+)/)?.[1] || new URLSearchParams(window.location.search).get("candidate"))
      : null;

    if (candParam) {
      const match = candItems.find(
        (c) => c.id === candParam || extractIdFromSlug(candParam) === c.id || buildCandidateSlug(c) === candParam
      );
      if (match) {
        setSelectedCandidateId(match.id);
      } else if (candItems.length > 0 && !selectedCandidateId) {
        setSelectedCandidateId(candItems[0].id);
      }
    } else if (candItems.length > 0 && !selectedCandidateId) {
      setSelectedCandidateId(candItems[0].id);
    }

    if (user) {
      const { data: myProfile } = await getProfileRole(supabase, user.id);
      setRole(myProfile?.role || null);

      const { data: candidacies } = await getMyCandidacies(supabase, user.id);
      setMyCandidacies(candidacies || []);

      const { data: seatAdminStatus } = await getSeatAdminStatus(supabase, seatId);
      setAdminStatus(seatAdminStatus);

      if (myProfile?.role === "admin" || seatAdminStatus?.my_application_status === "approved") {
        const { data: requests } = await getClaimRequestsForSeat(supabase, seatId);
        setClaimRequests(requests || []);
      } else {
        setClaimRequests([]);
      }
    } else {
      setRole(null);
      setMyCandidacies([]);
      setAdminStatus(null);
      setClaimRequests([]);
    }

    if (seatRow?.map_shapes?.country) {
      const { data: partyRows } = await getPoliticalParties(supabase, { country: seatRow.map_shapes.country });
      setParties(partyRows || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && seatId) Promise.resolve().then(() => fetchAll());
  }, [user?.id, authLoading, seatId]); // eslint-disable-line react-hooks/exhaustive-deps

  const trackedSeatViewRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!seat || trackedSeatViewRef.current === seatId) return;
    trackedSeatViewRef.current = seatId;
    trackElectionViewed({ seatId, roleTitle: seat.role_title, electionName: seat.elections?.name });
  }, [seat, seatId]);

  const startApplying = async () => {
    setApplying(true);
    setStatus("");
    const { data, error } = await applyForSeat(supabase, seatId);
    setApplying(false);
    if (error) {
      setStatus("Error: " + error.message);
      return;
    }
    router.push(`/apply/${data.id}`);
  };

  const submitElectionAdminApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingAdminApp(true);
    setAdminAppStatus("");
    const { error } = await applyForElectionAdmin(supabase, seatId, {
      motivation: adminMotivation,
      socialMediaInfo: adminSocialMedia,
      contactEmail: adminContactEmail,
    });
    setSubmittingAdminApp(false);
    if (error) {
      setAdminAppStatus("Error: " + error.message);
      return;
    }
    setShowAdminApplyForm(false);
    fetchAll();
  };

  const handleCandidateAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) return setCandidateAvatarError("Image must be less than 5MB");

    setCandidateAvatarError("");
    setUploadingCandidateAvatar(true);
    const { publicUrl, error: uploadError } = await uploadAvatarImage(supabase, file, user.id);
    setUploadingCandidateAvatar(false);

    if (uploadError) {
      setCandidateAvatarError("Failed to upload image. Please try again.");
      return;
    }

    setNewCandidateAvatarUrl(publicUrl);
  };

  const submitUnregisteredCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingCandidate(true);
    setAddCandidateStatus("");
    const { error } = await addUnregisteredCandidate(supabase, seatId, {
      fullName: newCandidateName,
      partyId: newCandidateParty ? parseInt(newCandidateParty) : null,
      education: newCandidateEducation,
      hometown: newCandidateHometown,
      bio: newCandidateBio,
      avatarUrl: newCandidateAvatarUrl,
    });
    setAddingCandidate(false);
    if (error) {
      setAddCandidateStatus("Error: " + error.message);
      return;
    }
    setNewCandidateName("");
    setNewCandidateParty("");
    setNewCandidateEducation("");
    setNewCandidateHometown("");
    setNewCandidateBio("");
    setNewCandidateAvatarUrl("");
    setCandidateAvatarError("");
    setShowAddCandidateForm(false);
    fetchAll();
  };

  const sendClaimInvite = async (candidateId: string) => {
    const email = inviteEmails[candidateId];
    if (!email) return;
    setInvitingCandidateId(candidateId);
    setInviteStatusByCandidate((prev) => ({ ...prev, [candidateId]: "" }));
    const { error } = await inviteCandidateToClaim(supabase, candidateId, email);
    setInvitingCandidateId(null);
    setInviteStatusByCandidate((prev) => ({
      ...prev,
      [candidateId]: error ? "Error: " + error.message : "Invite sent.",
    }));
    if (!error) setInviteEmails((prev) => ({ ...prev, [candidateId]: "" }));
  };

  const handleReviewClaim = async (requestId: string, approve: boolean) => {
    setReviewingRequestId(requestId);
    const { error } = await reviewCandidacyClaim(supabase, requestId, approve);
    setReviewingRequestId(null);
    if (error) {
      setStatus("Error: " + error.message);
      return;
    }
    fetchAll();
  };

  if (loading) return <Spinner fullPage />;

  if (!seat) {
    return (
      <div className="w-full px-4 lg:px-8">
        <Card className="text-center py-12">
          <p className="text-text-muted">Election seat not found.</p>
          <Button onClick={() => router.push("/elections")} className="mt-4">
            Back to Elections
          </Button>
        </Card>
      </div>
    );
  }

  const alreadyApplied = myCandidacies.some((c) => c.seat_id === seatId);
  const isSeatAdmin = role === "admin" || adminStatus?.my_application_status === "approved";
  const hasSidebar = role === "normal" || role === "politician" || adminStatus || !user;

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8">
      <div className="w-full min-w-0 flex flex-col lg:flex-row gap-6 items-start">
        {/* Main Candidate Column */}
        <div className="flex-1 min-w-0 w-full">
          {/* Header Card */}
          <Card padding="md" className="mb-6 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
              <Badge tone="amber" shape="pill" icon={<Vote size={12} />}>
                {seat.elections?.status?.replace("_", " ") || "Active"}
              </Badge>
              <h1 className="text-lg font-bold text-text-main tracking-tight truncate">
                {seat.role_title}
              </h1>
              <span className="text-xs text-text-muted truncate">
                {seat.elections?.name}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap text-xs text-text-muted shrink-0">
              <span className="flex items-center gap-1" title={seat.map_shapes?.name}>
                <MapPin size={13} className="text-accent" /> {seat.map_shapes?.name}
              </span>
              <span className="flex items-center gap-1" title={seat.elections?.election_date}>
                <Calendar size={13} className="text-accent" /> {seat.elections?.election_date}
              </span>
              <span
                className="flex items-center gap-1"
                title={`${candidates.length} candidate${candidates.length !== 1 ? "s" : ""}`}
              >
                <Users size={13} className="text-accent" /> {candidates.length}
              </span>
            </div>
          </Card>

          {status && <p className="text-danger text-xs mb-4">{status}</p>}

          {/* Current Office Holder */}
          {seat?.map_shape_id && (
            <CurrentOfficeHolderCard
              mapShapeId={seat.map_shape_id}
              roleTitle={seat.role_title}
              className="mb-8"
            />
          )}

          {/* Candidate Switcher Roster */}
          {candidates.length === 0 ? (
            <EmptyState
              icon={Vote}
              title="No Candidates Approved Yet"
              description="Nobody has been approved for this seat yet — declare your candidacy or volunteer as administrator to add candidates."
              className="mb-8"
            />
          ) : (
            <div className="space-y-6">
              <div
                className="flex gap-3 overflow-x-auto pb-2 mb-6"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {candidates.map((c) => {
                  const name =
                    c.display_name ||
                    c.profiles?.full_name ||
                    "Candidate";
                  const isSelected = c.id === selectedCandidateId;
                  const pol = c.profiles?.politician_profiles;
                  const avatarUrl = Array.isArray(pol) ? pol[0]?.avatar_url : pol?.avatar_url;
                  const hasPhoto = Boolean(avatarUrl);

                  return (
                    <button
                      key={c.id}
                      onClick={() => handleSelectCandidate(c)}
                      className={`flex items-center gap-3 shrink-0 pl-2.5 pr-4 py-2 rounded-2xl border-2 transition-all cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-[0_0_0_3px_rgba(233,235,158,0.12)]"
                          : "border-border-light bg-surface-hover/40 hover:border-primary/40 hover:bg-surface-hover"
                      }`}
                    >
                      <div className="relative shrink-0">
                        <Avatar src={avatarUrl} name={name} size="md" />
                        {hasPhoto && (
                          <span
                            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-success text-white border-2 border-background flex items-center justify-center shadow-sm"
                            title="Profile photo uploaded"
                          >
                            <Camera size={9} />
                          </span>
                        )}
                      </div>

                      <span
                        className={`text-sm font-semibold whitespace-nowrap ${
                          isSelected ? "text-primary-light" : "text-text-secondary"
                        }`}
                      >
                        {name}
                      </span>
                      {hasPhoto && (
                        <span
                          className="text-[10px] bg-success/15 text-success-light border border-success/30 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-1 shrink-0"
                          title="Candidate has profile photo"
                        >
                          <Camera size={10} /> Photo
                        </span>
                      )}
                      {c.nomination_filed && (
                        <CheckCircle2
                          size={14}
                          className="text-success shrink-0"
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedCandidateId && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3 px-1">
                    <span className="text-xs font-semibold text-text-muted">
                      Candidate {candidates.findIndex((c) => c.id === selectedCandidateId) + 1} of {candidates.length}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyShareLink}
                      className="gap-1.5 text-xs border-primary/30 text-primary-light hover:bg-primary/10"
                    >
                      {copiedShareLink ? <Check size={13} className="text-success" /> : <Share2 size={13} />}
                      {copiedShareLink ? "Direct Link Copied!" : "Share Candidate Link"}
                    </Button>
                  </div>
                  <CandidacyWall candidateId={selectedCandidateId} embedded />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Sidebar: Visitor Actions & Seat Administrator Panel */}
        {hasSidebar && (
          <div className="w-full lg:w-72 shrink-0 space-y-4 lg:sticky lg:top-6">
            {!user ? (
              <Card padding="sm" className="bg-primary/10 border-primary/25 text-center">
                <p className="text-xs text-text-secondary mb-3">
                  Sign in to nominate yourself, run for this seat, or volunteer as seat administrator.
                </p>
                <Button size="sm" onClick={() => router.push("/auth")} className="w-full">
                  Sign In to Participate
                </Button>
              </Card>
            ) : null}

            {role === "normal" && user && (
              <Card padding="sm" className="bg-primary/10 border-primary/25">
                <p className="text-sm text-text-secondary mb-3">
                  Interested in running for this seat? Switch to candidate mode to declare your candidacy.
                </p>
                <Button onClick={() => router.push("/profile")} className="w-full">
                  Run for Office
                </Button>
              </Card>
            )}

            {role === "politician" && user && (
              <Card padding="sm" className="bg-primary/10 border-primary/25">
                <p className="text-sm text-text-secondary mb-3">
                  {alreadyApplied
                    ? "You have filed your candidacy for this seat."
                    : "Declare your candidacy for this seat."}
                </p>
                {alreadyApplied ? (
                  <div className="flex items-center gap-2 text-xs font-bold text-accent">
                    <CheckCircle2 size={16} /> Candidacy Filed
                  </div>
                ) : (
                  <Button onClick={startApplying} disabled={applying} className="w-full">
                    {applying ? "Starting..." : "Nominate Yourself"}
                  </Button>
                )}
              </Card>
            )}

            {/* Seat Administrator Panel */}
            {user && (
              <Card padding="sm">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck size={18} className="text-primary" />
                  <h2 className="text-sm font-bold text-text-main">Seat Administrator</h2>
                </div>

                {isSeatAdmin ? (
                  <div className="space-y-4">
                    <p className="text-xs text-success-light font-semibold flex items-center gap-1">
                      <CheckCircle2 size={13} /> You are the approved Administrator for this seat.
                    </p>

                    {/* Add Candidate Directly */}
                    {!showAddCandidateForm ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowAddCandidateForm(true)}
                        className="w-full gap-1.5"
                      >
                        <Plus size={14} /> Add Candidate Directly
                      </Button>
                    ) : (
                      <form onSubmit={submitUnregisteredCandidate} className="space-y-3 pt-2 border-t border-border-light/35">
                        <p className="text-xs font-bold text-text-main">Add Candidate Stub</p>
                        <Input
                          type="text"
                          required
                          placeholder="Candidate full name *"
                          value={newCandidateName}
                          onChange={(e) => setNewCandidateName(e.target.value)}
                        />

                        {parties.length > 0 && (
                          <Select
                            value={newCandidateParty}
                            onChange={(e) => setNewCandidateParty(e.target.value)}
                          >
                            <option value="">-- Select Political Party --</option>
                            {parties.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.abbreviation})
                              </option>
                            ))}
                          </Select>
                        )}

                        <Input
                          type="text"
                          placeholder="Education (optional)"
                          value={newCandidateEducation}
                          onChange={(e) => setNewCandidateEducation(e.target.value)}
                        />
                        <Input
                          type="text"
                          placeholder="Hometown (optional)"
                          value={newCandidateHometown}
                          onChange={(e) => setNewCandidateHometown(e.target.value)}
                        />
                        <Textarea
                          placeholder="Short bio (optional)"
                          value={newCandidateBio}
                          rows={2}
                          onChange={(e) => setNewCandidateBio(e.target.value)}
                        />

                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-text-muted">
                            Candidate Photo (optional):
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleCandidateAvatarSelect}
                            className="text-xs text-text-muted"
                          />
                          {uploadingCandidateAvatar && (
                            <p className="text-[11px] text-primary">Uploading photo...</p>
                          )}
                          {candidateAvatarError && (
                            <p className="text-[11px] text-danger">{candidateAvatarError}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                          <Button type="submit" size="sm" disabled={addingCandidate}>
                            {addingCandidate ? "Adding..." : "Save Candidate"}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAddCandidateForm(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                        {addCandidateStatus && (
                          <p className="text-danger text-xs">{addCandidateStatus}</p>
                        )}
                      </form>
                    )}

                    {/* Invite Candidates to Claim */}
                    {candidates.some((c) => c.added_by_election_admin_id && !c.claimed_at) && (
                      <div className="pt-3 border-t border-border-light/35 space-y-3">
                        <p className="text-xs font-bold text-text-secondary uppercase tracking-wide">
                          Invite Candidates to Claim
                        </p>
                        {candidates
                          .filter((c) => c.added_by_election_admin_id && !c.claimed_at)
                          .map((c) => {
                            const name =
                              c.profiles?.full_name ||
                              c.display_name ||
                              "Unclaimed Candidate";
                            return (
                              <div key={c.id} className="space-y-1.5">
                                <p className="text-xs text-text-muted truncate font-semibold">
                                  {name}
                                </p>
                                <div className="flex items-center gap-1.5">
                                  <Input
                                    type="email"
                                    size="sm"
                                    placeholder="Candidate's email"
                                    value={inviteEmails[c.id] || ""}
                                    onChange={(e) =>
                                      setInviteEmails((prev) => ({
                                        ...prev,
                                        [c.id]: e.target.value,
                                      }))
                                    }
                                    className="flex-1"
                                  />
                                  <Button
                                    size="sm"
                                    onClick={() => sendClaimInvite(c.id)}
                                    disabled={
                                      invitingCandidateId === c.id ||
                                      !inviteEmails[c.id]
                                    }
                                    title="Send Claim Invite"
                                  >
                                    <Mail size={14} />
                                  </Button>
                                </div>
                                {inviteStatusByCandidate[c.id] && (
                                  <p
                                    className={`text-[11px] ${
                                      inviteStatusByCandidate[c.id].startsWith("Error")
                                        ? "text-danger"
                                        : "text-success-light font-semibold"
                                    }`}
                                  >
                                    {inviteStatusByCandidate[c.id]}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    )}

                    {/* Pending Claim Requests */}
                    {claimRequests.length > 0 && (
                      <div className="pt-3 border-t border-border-light/35 space-y-3">
                        <p className="text-xs font-bold text-text-secondary uppercase tracking-wide">
                          Pending Claim Requests ({claimRequests.length})
                        </p>
                        {claimRequests.map((r) => (
                          <div
                            key={r.id}
                            className="p-2.5 bg-surface-elevated rounded-xl border border-border-light/30 space-y-1.5"
                          >
                            <p className="text-xs font-bold text-text-main truncate">
                              {r.election_candidates?.profiles?.full_name ||
                                "Unclaimed candidate"}
                            </p>
                            <p className="text-[11px] text-text-muted line-clamp-3">
                              {r.motivation}
                            </p>
                            <p className="text-[11px] text-text-muted">{r.contact_email}</p>
                            {r.social_media_info && (
                              <p className="text-[11px] text-text-muted truncate">
                                {r.social_media_info}
                              </p>
                            )}
                            <div className="flex items-center gap-2 pt-1">
                              <Button
                                size="sm"
                                onClick={() => handleReviewClaim(r.id, true)}
                                disabled={reviewingRequestId === r.id}
                                className="bg-success hover:bg-success/85 text-white"
                              >
                                <Check size={14} /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReviewClaim(r.id, false)}
                                disabled={reviewingRequestId === r.id}
                                className="text-danger border-danger/40"
                              >
                                <X size={14} /> Reject
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : adminStatus?.my_application_status === "pending" ? (
                  <p className="text-xs text-warning-light font-semibold mt-2">
                    Your application to administer this seat is under review.
                  </p>
                ) : adminStatus?.my_application_status === "rejected" ? (
                  <p className="text-xs text-danger font-semibold mt-2">
                    Your application to administer this seat was not approved.
                  </p>
                ) : adminStatus?.has_approved_admin ? (
                  <p className="text-xs text-text-muted mt-2">
                    This seat already has an assigned election administrator.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-text-muted mt-1 mb-3">
                      Volunteer to moderate this seat and help add candidates who are missing from the platform.
                    </p>
                    {!showAdminApplyForm ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowAdminApplyForm(true)}
                        className="w-full"
                      >
                        Volunteer to Administer This Seat
                      </Button>
                    ) : (
                      <form onSubmit={submitElectionAdminApplication} className="space-y-3">
                        <Textarea
                          required
                          placeholder="Tell us about yourself and why you're interested..."
                          value={adminMotivation}
                          rows={3}
                          onChange={(e) => setAdminMotivation(e.target.value)}
                        />
                        <Input
                          type="text"
                          placeholder="Social media or community links (optional)"
                          value={adminSocialMedia}
                          onChange={(e) => setAdminSocialMedia(e.target.value)}
                        />
                        <Input
                          type="email"
                          required
                          placeholder="Contact email *"
                          value={adminContactEmail}
                          onChange={(e) => setAdminContactEmail(e.target.value)}
                        />
                        <div className="flex items-center gap-2">
                          <Button type="submit" size="sm" disabled={submittingAdminApp}>
                            {submittingAdminApp ? "Submitting..." : "Submit Application"}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAdminApplyForm(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                        {adminAppStatus && (
                          <p className="text-danger text-xs">{adminAppStatus}</p>
                        )}
                      </form>
                    )}
                  </>
                )}
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
