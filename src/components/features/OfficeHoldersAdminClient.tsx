"use client";

import React, { useState, useEffect, useCallback } from "react";
import AdminSubNav from "./AdminSubNav";
import { getCountries, listBoundaryTypes, searchMapShapesByName } from "@/lib/services/boundaries";
import { getElectionRoleTypes, getOfficeHoldersForShape, upsertOfficeHolder, removeOfficeHolder, inviteOfficeholderToClaim, resendOfficeholderClaim, cancelOfficeholderClaim, getOfficeholderWallClaims, listRecentOfficeholderWallClaims, mergeOfficeholderWallClaim, reverseOfficeholderWallClaim, rejectOfficeholderWallClaim, previewOfficeholderWallClaim, listPendingSelfRequestedOfficeholderClaims } from "@/lib/services/elections";
import { getPoliticalParties } from "@/lib/services/politicalParties";
import { adminGetProfileById } from "@/lib/services/profile";
import { UserCheck, Search, Save, Trash2, X, Link2, Mail, Inbox } from "lucide-react";
import { Card, Button, Input, Textarea, Select, Spinner, PageHeader, ConfirmDialog, PromptDialog } from "@/components/primitives";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import Link from "next/link";
import { buildPoliticianWallSlug } from "@/lib/utils/slugs";
import { InvitationHistoryPanel } from "./InvitationHistoryPanel";
import { RecentOfficeholderInvitations, type RecentOfficeholderClaimRow } from "./RecentOfficeholderInvitations";

interface RoleType {
  id: string;
  role_key: string;
  region_override: string;
  role_title: string;
  description: string | null;
}

interface Holder {
  id: string;
  election_role_type_id: string;
  full_name: string;
  bio: string | null;
  source_url: string | null;
  holding_since: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  linked_profile_id: string | null;
  political_parties?: { name: string } | null;
}

interface ShapeOption {
  id: number;
  name: string;
  country: string;
  boundary_type: string;
}

type OfficeholderClaim = Database["public"]["Tables"]["office_holder_wall_claims"]["Row"];

const emptyForm = {
  fullName: "",
  politicalPartyId: "",
  bio: "",
  sourceUrl: "",
  holdingSince: "",
  contactEmail: "",
  contactPhone: "",
  linkedProfileId: "",
  linkedProfileName: "",
};

export default function OfficeHoldersAdminClient() {
  const supabase = createClient();
  const { user } = useAuth();

  const [countries, setCountries] = useState<{ name: string }[]>([]);
  const [country, setCountry] = useState("");
  const [boundaryTypes, setBoundaryTypes] = useState<{ type_name: string }[]>([]);
  const [boundaryType, setBoundaryType] = useState("");
  const [nameQuery, setNameQuery] = useState("");
  const [shapeOptions, setShapeOptions] = useState<ShapeOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedShape, setSelectedShape] = useState<ShapeOption | null>(null);

  const [roleTypes, setRoleTypes] = useState<RoleType[]>([]);
  const [holders, setHolders] = useState<Record<string, Holder>>({});
  const [claims, setClaims] = useState<Record<string, OfficeholderClaim[]>>({});
  const [loadingRoles, setLoadingRoles] = useState(false);

  const [parties, setParties] = useState<{ id: number; name: string }[]>([]);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [inviting, setInviting] = useState(false);
  const [wallInviteUrl, setWallInviteUrl] = useState("");
  const [wallInviteEmail, setWallInviteEmail] = useState("");
  const [wallInviting, setWallInviting] = useState(false);
  const [selectedWall, setSelectedWall] = useState<{
    slug: string;
    name: string;
    officeholderId: string;
  } | null>(null);
  const [wallClaims, setWallClaims] = useState<OfficeholderClaim[]>([]);
  const [loadingWallClaims, setLoadingWallClaims] = useState(false);

  // Self-requested claims (get_wall_claim_eligibility -> request_officeholder_wall_claim,
  // migration 20260811170000) land in pending_review the same as an invited/
  // redeemed claim, but nothing about them is visible unless an admin has
  // already navigated to that specific officeholder's wall lookup above.
  // This lists them globally so they're actually discoverable.
  type SelfRequestedClaim = {
    claim_id: string;
    office_holder_id: string;
    office_holder_name: string | null;
    role_title: string | null;
    boundary_name: string | null;
    target_profile_id: string | null;
    target_wall_slug: string | null;
    requester_name: string | null;
    contact_email: string | null;
    note: string | null;
    claimed_at: string | null;
  };
  const [selfRequests, setSelfRequests] = useState<SelfRequestedClaim[]>([]);
  const [loadingSelfRequests, setLoadingSelfRequests] = useState(false);

  const loadSelfRequests = useCallback(async () => {
    setLoadingSelfRequests(true);
    const { data } = await listPendingSelfRequestedOfficeholderClaims(supabase);
    setSelfRequests((data as SelfRequestedClaim[] | null) || []);
    setLoadingSelfRequests(false);
  }, [supabase]);

  // Cross-wall invitation feed — loaded on every mount (not gated behind
  // `selectedWall`) so "which wall did we invite, and what's its status"
  // survives a page refresh. See RecentOfficeholderInvitations.
  const [recentClaims, setRecentClaims] = useState<RecentOfficeholderClaimRow[]>([]);
  const [loadingRecentClaims, setLoadingRecentClaims] = useState(false);
  const [recentResendingId, setRecentResendingId] = useState<string | null>(null);
  const [recentCancellingId, setRecentCancellingId] = useState<string | null>(null);
  const [recentMergingId, setRecentMergingId] = useState<string | null>(null);
  const [recentReversingId, setRecentReversingId] = useState<string | null>(null);
  const [recentActionError, setRecentActionError] = useState<string | null>(null);

  const loadRecentClaims = useCallback(async () => {
    setLoadingRecentClaims(true);
    const { data } = await listRecentOfficeholderWallClaims(supabase);
    setRecentClaims((data as RecentOfficeholderClaimRow[] | null) || []);
    setLoadingRecentClaims(false);
  }, [supabase]);

  useEffect(() => {
    async function initialLoad() {
      await Promise.all([loadSelfRequests(), loadRecentClaims()]);
    }
    initialLoad();
  }, [loadSelfRequests, loadRecentClaims]);

  const handleRecentResend = async (claim: RecentOfficeholderClaimRow) => {
    const email = (claim.contact_email || "").trim();
    if (!email) {
      setRecentActionError("This claim has no contact email on file.");
      return;
    }
    setRecentActionError(null);
    setRecentResendingId(claim.claim_id);
    const { error } = await resendOfficeholderClaim(supabase, claim.claim_id, email);
    setRecentResendingId(null);
    if (error) {
      setRecentActionError(`Resend error: ${error.message}`);
    } else {
      loadRecentClaims();
    }
  };

  // window.confirm()/window.prompt() are unusable here — no mobile-app
  // equivalent, can't be themed, and in some embedded preview runtimes they
  // throw outright ("prompt() is not supported") instead of just looking
  // out of place. Each of these "resolves" via one of the ConfirmDialog /
  // PromptDialog instances rendered near the end of this component, rather
  // than blocking synchronously.
  const [pendingRecentCancel, setPendingRecentCancel] = useState<RecentOfficeholderClaimRow | null>(null);
  const [pendingRecentMerge, setPendingRecentMerge] = useState<{ claim: RecentOfficeholderClaimRow; summary: string } | null>(null);
  const [pendingRecentReverse, setPendingRecentReverse] = useState<RecentOfficeholderClaimRow | null>(null);

  const handleRecentCancel = (claim: RecentOfficeholderClaimRow) => setPendingRecentCancel(claim);

  const confirmRecentCancel = async () => {
    const claim = pendingRecentCancel;
    if (!claim) return;
    setRecentActionError(null);
    setRecentCancellingId(claim.claim_id);
    const { error } = await cancelOfficeholderClaim(supabase, claim.claim_id);
    setRecentCancellingId(null);
    setPendingRecentCancel(null);
    if (error) {
      setRecentActionError(`Cancel error: ${error.message}`);
    } else {
      loadRecentClaims();
    }
  };

  const handleRecentMerge = async (claim: RecentOfficeholderClaimRow) => {
    setRecentActionError(null);
    setRecentMergingId(claim.claim_id);
    const { data: preview, error: previewError } = await previewOfficeholderWallClaim(supabase, claim.claim_id);
    if (previewError) {
      setRecentMergingId(null);
      setRecentActionError(`Couldn't load merge preview: ${previewError.message}`);
      return;
    }
    const p = preview as {
      posts?: number; comments?: number; supporters?: number;
      ratings?: number; news_tags?: number; election_candidates?: number;
    } | null;
    const summary = p
      ? `This will merge the imported wall into the claiming profile:\n\n` +
        `• ${p.posts ?? 0} post(s)\n` +
        `• ${p.comments ?? 0} comment(s)\n` +
        `• ${p.supporters ?? 0} supporter(s)\n` +
        `• ${p.ratings ?? 0} rating(s)\n` +
        `• ${p.news_tags ?? 0} news tag(s)\n` +
        `• ${p.election_candidates ?? 0} election candidacy record(s)\n\n` +
        `The old wall URL will keep working (it redirects here). An admin can reverse this later.`
      : "No preview data was returned.";
    setRecentMergingId(null);
    setPendingRecentMerge({ claim, summary });
  };

  const confirmRecentMerge = async () => {
    const pending = pendingRecentMerge;
    if (!pending) return;
    setRecentMergingId(pending.claim.claim_id);
    const { error } = await mergeOfficeholderWallClaim(supabase, pending.claim.claim_id);
    setRecentMergingId(null);
    setPendingRecentMerge(null);
    if (error) {
      setRecentActionError(`Merge error: ${error.message}`);
    } else {
      loadRecentClaims();
    }
  };

  const handleRecentReverse = (claim: RecentOfficeholderClaimRow) => setPendingRecentReverse(claim);

  const confirmRecentReverse = async (reason: string) => {
    const claim = pendingRecentReverse;
    if (!claim) return;
    setRecentActionError(null);
    setRecentReversingId(claim.claim_id);
    const { error } = await reverseOfficeholderWallClaim(supabase, claim.claim_id, reason);
    setRecentReversingId(null);
    setPendingRecentReverse(null);
    if (error) {
      setRecentActionError(`Reversal error: ${error.message}`);
    } else {
      loadRecentClaims();
    }
  };

  const reviewSelfRequest = (req: SelfRequestedClaim) => {
    setSelectedWall({
      slug: req.target_wall_slug || "",
      name: req.office_holder_name || "Unnamed Officeholder",
      officeholderId: req.office_holder_id,
    });
    setWallInviteEmail(req.contact_email || "");
    setLoadingWallClaims(true);
    getOfficeholderWallClaims(supabase, req.office_holder_id).then(({ data }) => {
      setWallClaims((data as OfficeholderClaim[] | null) || []);
      setLoadingWallClaims(false);
    });
  };

  useEffect(() => {
    getCountries(supabase).then(({ data }) => setCountries(data || []));
  }, [supabase]);

  useEffect(() => {
    if (!country) return;
    listBoundaryTypes(supabase, { country, columns: "type_name" }).then(({ data }) =>
      setBoundaryTypes((data as { type_name: string }[] | null) || [])
    );
    getPoliticalParties(supabase, { country }).then(({ data }) => setParties(data || []));
  }, [supabase, country]);

  const handleCountryChange = (value: string) => {
    setCountry(value);
    setSelectedShape(null);
    setRoleTypes([]);
    if (!value) {
      setBoundaryTypes([]);
      setBoundaryType("");
    }
  };

  const runSearch = useCallback(async () => {
    if (!country || !boundaryType || nameQuery.trim().length < 2) {
      setShapeOptions([]);
      return;
    }
    setSearching(true);
    const { data } = await searchMapShapesByName(supabase, nameQuery, { country, boundaryType });
    setShapeOptions((data as ShapeOption[] | null) || []);
    setSearching(false);
  }, [supabase, country, boundaryType, nameQuery]);

  useEffect(() => {
    const id = setTimeout(runSearch, 300);
    return () => clearTimeout(id);
  }, [runSearch]);

  const selectShape = async (shape: ShapeOption) => {
    setSelectedShape(shape);
    setShapeOptions([]);
    setNameQuery(shape.name);
    setLoadingRoles(true);
    const [{ data: roles }, { data: existingHolders }] = await Promise.all([
      getElectionRoleTypes(supabase, shape.country, shape.boundary_type),
      getOfficeHoldersForShape(supabase, shape.id),
    ]);
    setRoleTypes((roles as RoleType[] | null) || []);
    const byRole: Record<string, Holder> = {};
    ((existingHolders as Holder[] | null) || []).forEach((h) => {
      byRole[h.election_role_type_id] = h;
    });
    setHolders(byRole);
    const claimEntries = await Promise.all(
      Object.values(byRole).map(async (holder) => {
        const { data } = await getOfficeholderWallClaims(supabase, holder.id);
        return [holder.id, (data as OfficeholderClaim[] | null) || []] as const;
      })
    );
    setClaims(Object.fromEntries(claimEntries));
    setLoadingRoles(false);
  };

  const startEdit = (role: RoleType) => {
    const existing = holders[role.id];
    setForm(
      existing
        ? {
            fullName: existing.full_name,
            politicalPartyId: "",
            bio: existing.bio || "",
            sourceUrl: existing.source_url || "",
            holdingSince: existing.holding_since || "",
            contactEmail: existing.contact_email || "",
            contactPhone: existing.contact_phone || "",
            linkedProfileId: existing.linked_profile_id || "",
            linkedProfileName: "",
          }
        : emptyForm
    );
    setEditingRoleId(role.id);
    setStatus("");

    if (existing?.linked_profile_id) {
      adminGetProfileById(supabase, existing.linked_profile_id).then(({ data }) => {
        if (data) setForm((f) => ({ ...f, linkedProfileName: data.full_name || "Unnamed profile" }));
      });
    }
  };

  const saveHolder = async (role: RoleType) => {
    if (!selectedShape || !user || !form.fullName.trim()) return;
    const existing = holders[role.id];
    if (form.linkedProfileId && form.linkedProfileId !== existing?.linked_profile_id) {
      setStatus("Direct profile linking is disabled. Use the claim invitation so the merge is verified and reversible.");
      return;
    }
    setSaving(true);
    setStatus("");
    const { data, error } = await upsertOfficeHolder(
      supabase,
      {
        mapShapeId: selectedShape.id,
        electionRoleTypeId: role.id,
        fullName: form.fullName.trim(),
        politicalPartyId: form.politicalPartyId ? Number(form.politicalPartyId) : null,
        bio: form.bio.trim() || null,
        sourceUrl: form.sourceUrl.trim() || null,
        holdingSince: form.holdingSince || null,
        contactEmail: form.contactEmail.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
        linkedProfileId: form.linkedProfileId || null,
      },
      user.id
    );
    setSaving(false);
    if (error) {
      setStatus("Error: " + error.message);
      return;
    }
    setHolders((prev) => ({ ...prev, [role.id]: (data as unknown) as Holder }));
    setEditingRoleId(null);
  };

  const inviteHolder = async (holder: Holder) => {
    const latestClaim = claims[holder.id]?.[0];
    const email = (holder.contact_email || latestClaim?.contact_email || "").trim();
    if (!email) {
      setStatus("Add an official email before sending a claim invitation.");
      return;
    }
    setInviting(true);
    setStatus("");
    const { error } = await sendClaimInvitation(holder.id, email);
    setInviting(false);
    setStatus(error ? `Invitation error: ${error.message}` : `Claim invitation sent to ${email}.`);
  };

  const sendClaimInvitation = async (officeHolderId: string, email: string) => {
    const { data: existingClaims, error: claimsError } = await getOfficeholderWallClaims(supabase, officeHolderId);
    if (claimsError) return { error: claimsError };
    const latest = (existingClaims || [])[0] as OfficeholderClaim | undefined;
    if (latest?.status === "invited" || latest?.status === "expired") {
      return resendOfficeholderClaim(supabase, latest.id, email);
    }
    if (latest?.status === "pending_review" || latest?.status === "approved") {
      return { error: new Error(`This wall already has a ${latest.status.replace("_", " ")} claim.`) };
    }
    return inviteOfficeholderToClaim(supabase, officeHolderId, email);
  };

  const inviteExistingWall = async () => {
    const email = wallInviteEmail.trim().toLowerCase();
    let wallSlug = "";
    try {
      const parsed = new URL(wallInviteUrl.trim(), window.location.origin);
      const match = parsed.pathname.match(/^\/wall\/([^/]+)\/?$/);
      if (!match) throw new Error("Use a wall URL such as https://www.choseno.com/wall/donald-j-trump-president");
      wallSlug = decodeURIComponent(match[1]);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Enter a valid Choseno wall URL.");
      return;
    }
    if (!email || !email.includes("@")) {
      setStatus("Enter the politician's email address.");
      return;
    }

    // Clear any previously-loaded wall so a failed/slow lookup can't leave the
    // panel showing a different wall's invitation history while this one resolves.
    setSelectedWall(null);
    setWallClaims([]);
    setWallInviting(true);
    setStatus("");
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, current_ghost_id, politician_profiles!inner(wall_slug)")
      .eq("politician_profiles.wall_slug", wallSlug)
      .maybeSingle();

    if (profileError || !profile) {
      setWallInviting(false);
      setStatus(profileError?.message || "No wall was found for that URL.");
      return;
    }

    const { data: officeHolder, error: holderError } = await supabase
      .from("office_holders")
      .select("id, full_name")
      .eq("linked_profile_id", profile.id)
      .maybeSingle();

    if (holderError || !officeHolder) {
      setWallInviting(false);
      setStatus(holderError?.message || `No officeholder record is linked to ${profile.full_name || "that wall"}.`);
      return;
    }

    // Set selected wall info so the panel renders while the invite is in flight.
    setSelectedWall({
      slug: wallSlug,
      name: profile.full_name || "Unnamed Politician",
      officeholderId: officeHolder.id,
    });

    const { error: inviteError } = await sendClaimInvitation(officeHolder.id, email);

    // Always reload claims after attempting the invite — a resend can succeed
    // in the database even when the caller's UI has a stale claims list, and
    // the panel must reflect the claim that was actually just touched.
    setLoadingWallClaims(true);
    const { data: claimsData } = await getOfficeholderWallClaims(supabase, officeHolder.id);
    setWallClaims((claimsData as OfficeholderClaim[] | null) || []);
    setLoadingWallClaims(false);

    setWallInviting(false);
    setStatus(
      inviteError
        ? `Invitation error: ${inviteError.message}`
        : `Claim invitation sent to ${email} for ${profile.full_name || "the wall"}.`,
    );
    // Refresh the persistent cross-wall feed too, so the invite just sent
    // shows up there immediately (and stays visible after a page refresh,
    // unlike the selectedWall panel above which is transient client state).
    loadRecentClaims();
  };

  const mergeClaim = async (holder: Holder, claim: OfficeholderClaim) => {
    setSaving(true);
    const { error } = await mergeOfficeholderWallClaim(supabase, claim.id);
    setSaving(false);
    setStatus(error ? `Merge error: ${error.message}` : "Claim merged successfully. The old wall URL now redirects.");
    if (!error) {
      const { data } = await getOfficeholderWallClaims(supabase, holder.id);
      setClaims((prev) => ({ ...prev, [holder.id]: (data as OfficeholderClaim[] | null) || [] }));
      if (selectedShape) await selectShape(selectedShape);
    }
  };

  const [pendingReject, setPendingReject] = useState<{ holder: Holder; claim: OfficeholderClaim } | null>(null);
  const [pendingReverse, setPendingReverse] = useState<{ holder: Holder; claim: OfficeholderClaim } | null>(null);

  const rejectClaim = (holder: Holder, claim: OfficeholderClaim) => setPendingReject({ holder, claim });

  const confirmRejectClaim = async (reason: string) => {
    const pending = pendingReject;
    if (!pending) return;
    const { holder, claim } = pending;
    setSaving(true);
    const { error } = await rejectOfficeholderWallClaim(supabase, claim.id, reason);
    setSaving(false);
    setPendingReject(null);
    setStatus(error ? `Rejection error: ${error.message}` : "Claim rejected. The claimant's profile no longer shows this officeholder's details.");
    if (!error) {
      const { data } = await getOfficeholderWallClaims(supabase, holder.id);
      setClaims((prev) => ({ ...prev, [holder.id]: (data as OfficeholderClaim[] | null) || [] }));
      if (selectedShape) await selectShape(selectedShape);
    }
  };

  const reverseClaim = (holder: Holder, claim: OfficeholderClaim) => setPendingReverse({ holder, claim });

  const confirmReverseClaim = async (reason: string) => {
    const pending = pendingReverse;
    if (!pending) return;
    const { holder, claim } = pending;
    setSaving(true);
    const { error } = await reverseOfficeholderWallClaim(supabase, claim.id, reason);
    setSaving(false);
    setPendingReverse(null);
    setStatus(error ? `Reversal error: ${error.message}` : "Claim reversed and original wall ownership restored.");
    if (!error) {
      const { data } = await getOfficeholderWallClaims(supabase, holder.id);
      setClaims((prev) => ({ ...prev, [holder.id]: (data as OfficeholderClaim[] | null) || [] }));
      if (selectedShape) await selectShape(selectedShape);
    }
  };

  const deleteHolder = async (role: RoleType) => {
    const existing = holders[role.id];
    if (!existing) return;
    setSaving(true);
    const { error } = await removeOfficeHolder(supabase, existing.id);
    setSaving(false);
    if (error) {
      setStatus("Error: " + error.message);
      return;
    }
    setHolders((prev) => {
      const next = { ...prev };
      delete next[role.id];
      return next;
    });
    setEditingRoleId(null);
  };

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 space-y-6">
      <PageHeader
        icon={UserCheck}
        title="Office Holders"
        subtitle="Set the current officeholder shown on each boundary's public directory page."
      />

      <AdminSubNav active="office-holders" />

      {selfRequests.length > 0 && (
        <Card padding="md" className="space-y-3 border-warning/30 bg-warning/5">
          <h2 className="font-bold text-text-main flex items-center gap-2">
            <Inbox size={17} className="text-warning" />
            Pending self-requested claims ({selfRequests.length})
          </h2>
          <p className="text-xs text-text-muted -mt-2">
            Submitted directly by a logged-in citizen from the wall itself (no invite sent) — review the same way as any other claim.
          </p>
          <div className="space-y-2">
            {selfRequests.map((req) => (
              <div
                key={req.claim_id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-border-light/30 bg-surface/50 text-sm"
              >
                <div>
                  <div className="font-semibold text-text-main">
                    {req.office_holder_name} <span className="text-text-muted font-normal">— {req.role_title}{req.boundary_name ? `, ${req.boundary_name}` : ""}</span>
                  </div>
                  <div className="text-xs text-text-muted mt-0.5">
                    Requested by <strong>{req.requester_name || "an unnamed profile"}</strong> · {req.contact_email}
                    {req.note && <> · &ldquo;{req.note}&rdquo;</>}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => reviewSelfRequest(req)} className="shrink-0">
                  Review
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
      {loadingSelfRequests && selfRequests.length === 0 && <p className="text-xs text-text-muted">Checking for pending claim requests…</p>}

      <Card padding="md" className="space-y-4 border-primary/20 bg-primary/5">
        <div>
          <h2 className="font-bold text-text-main flex items-center gap-2">
            <Mail size={17} className="text-primary" />
            Invite a politician to claim an existing wall
          </h2>
          <p className="text-xs text-text-muted mt-1 max-w-2xl">
            Paste the public wall URL and the politician&apos;s email. We&apos;ll send a one-time claim link; ownership changes only after the recipient registers and confirms it.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr_auto] gap-2.5 items-end">
          <label className="text-xs font-semibold text-text-muted">
            Wall URL
            <Input
              className="mt-1"
              placeholder="https://www.choseno.com/wall/donald-j-trump-president"
              value={wallInviteUrl}
              onChange={(e) => setWallInviteUrl(e.target.value)}
            />
          </label>
          <label className="text-xs font-semibold text-text-muted">
            Politician email
            <Input
              className="mt-1"
              type="email"
              placeholder="politician@example.com"
              value={wallInviteEmail}
              onChange={(e) => setWallInviteEmail(e.target.value)}
            />
          </label>
          <Button
            onClick={inviteExistingWall}
            disabled={wallInviting || !wallInviteUrl.trim() || !wallInviteEmail.trim()}
            className="gap-1"
          >
            <Mail size={14} /> {wallInviting ? "Sending…" : "Send claim invite"}
          </Button>
        </div>
        {status && <p className="text-sm text-text-muted">{status}</p>}
      </Card>

      {recentActionError && (
        <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
          {recentActionError}
        </div>
      )}
      <RecentOfficeholderInvitations
        claims={recentClaims}
        loading={loadingRecentClaims && recentClaims.length === 0}
        resendingId={recentResendingId}
        cancellingId={recentCancellingId}
        mergingId={recentMergingId}
        reversingId={recentReversingId}
        onResend={handleRecentResend}
        onCancel={handleRecentCancel}
        onMerge={handleRecentMerge}
        onReverse={handleRecentReverse}
      />

      {selectedWall && (
        <InvitationHistoryPanel
          wallUrl={`${window.location.origin}/wall/${selectedWall.slug}`}
          wallSlug={selectedWall.slug}
          politicianName={selectedWall.name}
          politicianEmail={wallInviteEmail}
          officeholderId={selectedWall.officeholderId}
          claims={wallClaims}
          onStatusChange={async () => {
            const { data: claimsData } = await getOfficeholderWallClaims(supabase, selectedWall.officeholderId);
            setWallClaims((claimsData as OfficeholderClaim[] | null) || []);
            loadSelfRequests();
            loadRecentClaims();
          }}
        />
      )}

      <Card padding="md" className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select value={country} onChange={(e) => handleCountryChange(e.target.value)}>
            <option value="">Select country</option>
            {countries.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </Select>

          <Select
            value={boundaryType}
            onChange={(e) => {
              setBoundaryType(e.target.value);
              setSelectedShape(null);
              setRoleTypes([]);
            }}
            disabled={!country}
          >
            <option value="">Select boundary type</option>
            {boundaryTypes.map((t) => (
              <option key={t.type_name} value={t.type_name}>
                {t.type_name}
              </option>
            ))}
          </Select>
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input
            className="pl-9"
            placeholder="Search boundary by name (e.g. Surrey)"
            value={nameQuery}
            onChange={(e) => {
              setNameQuery(e.target.value);
              setSelectedShape(null);
            }}
            disabled={!boundaryType}
          />
          {searching && <Spinner size="sm" className="absolute right-3 top-1/2 -translate-y-1/2" />}
        </div>

        {shapeOptions.length > 0 && (
          <div className="border border-border-light/40 rounded-xl divide-y divide-border-light/30 overflow-hidden">
            {shapeOptions.map((s) => (
              <button
                key={s.id}
                onClick={() => selectShape(s)}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface-hover transition-colors cursor-pointer"
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </Card>

      {selectedShape && (
        <Card padding="md" className="space-y-4">
          <h3 className="font-bold text-text-main text-lg">{selectedShape.name}</h3>

          {loadingRoles ? (
            <Spinner />
          ) : roleTypes.length === 0 ? (
            <p className="text-sm text-text-muted">
              No roles are defined for {selectedShape.country}/{selectedShape.boundary_type} yet.
            </p>
          ) : (
            <div className="space-y-3">
              {roleTypes.map((role) => {
                const existing = holders[role.id];
                const latestClaim = existing ? claims[existing.id]?.[0] : undefined;
                const isEditing = editingRoleId === role.id;
                return (
                  <div key={role.id} className="p-4 bg-surface/30 border border-border-light/30 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-bold text-sm text-text-main">{role.role_title}</p>
                        {role.description && (
                          <p className="text-xs text-text-muted mt-0.5 max-w-md">{role.description}</p>
                        )}
                      </div>
                      {!isEditing && (
                        <div className="flex items-center gap-2">
                          {existing ? (
                            <>
                              <span className="text-xs font-semibold text-text-secondary flex items-center gap-1">
                                {existing.full_name}
                                {existing.political_parties?.name ? ` (${existing.political_parties.name})` : ""}
                                {existing.linked_profile_id && <Link2 size={12} className="text-accent" />}
                              </span>
                              <Button size="sm" variant="outline" onClick={() => startEdit(role)}>
                                Edit
                              </Button>
                              {latestClaim && <span className="text-[11px] text-text-muted">Claim: {latestClaim.status}</span>}
                            </>
                          ) : (
                            <Button size="sm" onClick={() => startEdit(role)}>
                              Set officeholder
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    {isEditing && (
                      <div className="space-y-2.5 pt-2 border-t border-border-light/20">
                        <Input
                          placeholder="Full name"
                          value={form.fullName}
                          onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                        />
                        <Select
                          value={form.politicalPartyId}
                          onChange={(e) => setForm((f) => ({ ...f, politicalPartyId: e.target.value }))}
                        >
                          <option value="">No party listed</option>
                          {parties.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </Select>
                        <Textarea
                          placeholder="Short bio (optional)"
                          value={form.bio}
                          onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                          rows={2}
                        />
                        <Input
                          placeholder="Official source URL (optional)"
                          value={form.sourceUrl}
                          onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))}
                        />
                        <Input
                          type="date"
                          placeholder="Holding office since"
                          value={form.holdingSince}
                          onChange={(e) => setForm((f) => ({ ...f, holdingSince: e.target.value }))}
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <Input
                            type="email"
                            placeholder="Contact email (optional)"
                            value={form.contactEmail}
                            onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                          />
                          <Input
                            type="tel"
                            placeholder="Contact phone (optional)"
                            value={form.contactPhone}
                            onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
                          />
                        </div>

                        <div className="pt-1">
                          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                            Profile ownership
                          </p>
                          {form.linkedProfileId ? (
                            <div className="flex items-center gap-2 text-xs bg-accent/10 text-accent font-semibold px-3 py-1.5 rounded-xl w-fit">
                              <Link2 size={13} />
                              {form.linkedProfileName || "Linked profile"}
                              <button
                                onClick={() =>
                                  setForm((f) => ({ ...f, linkedProfileId: "", linkedProfileName: "" }))
                                }
                                className="hover:text-danger cursor-pointer"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ) : <p className="text-xs text-text-muted">No linked account. Use the official email above to send a verified claim invitation.</p>}
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <Button size="sm" onClick={() => saveHolder(role)} disabled={saving || !form.fullName.trim()} className="gap-1">
                            <Save size={14} /> Save
                          </Button>
                          {existing && (
                            <Button size="sm" variant="outline" onClick={() => deleteHolder(role)} disabled={saving} className="gap-1 text-danger border-danger/40">
                              <Trash2 size={14} /> Remove
                            </Button>
                          )}
                          {existing && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => inviteHolder(existing)}
                                disabled={saving || inviting || (!form.contactEmail.trim() && !claims[existing.id]?.[0]?.contact_email)}
                                className="gap-1"
                              >
                              <Mail size={14} /> {inviting ? "Sending…" : "Send claim invite"}
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => setEditingRoleId(null)} className="gap-1">
                            <X size={14} /> Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                    {!isEditing && existing && latestClaim?.status === "pending_review" && (
                      <div className="flex items-center gap-2 pt-2 border-t border-border-light/20">
                        <span className="text-xs text-text-secondary">Verified claim is awaiting admin merge.</span>
                        <Button size="sm" onClick={() => mergeClaim(existing, latestClaim)} disabled={saving}>Merge wall</Button>
                        <Button size="sm" variant="outline" onClick={() => rejectClaim(existing, latestClaim)} disabled={saving}>Reject claim</Button>
                      </div>
                    )}
                    {!isEditing && existing && latestClaim && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 border-t border-border-light/20 text-xs text-text-muted">
                        <span className="font-semibold text-text-secondary">
                          Invite: {latestClaim.contact_email || "email unavailable"}
                        </span>
                        <span>({latestClaim.status.replace("_", " ")})</span>
                        <Link
                          href={`/wall/${buildPoliticianWallSlug(existing.full_name, role.role_title)}`}
                          target="_blank"
                          className="text-primary hover:underline"
                        >
                          View wall
                        </Link>
                        {(latestClaim.status === "invited" || latestClaim.status === "expired") && (
                          <Button size="sm" variant="outline" onClick={() => inviteHolder(existing)} disabled={inviting} className="gap-1">
                            <Mail size={13} /> {inviting ? "Resending…" : "Resend invite"}
                          </Button>
                        )}
                      </div>
                    )}
                    {!isEditing && existing && latestClaim?.status === "approved" && (
                      <div className="flex items-center gap-2 pt-2 border-t border-border-light/20">
                        <span className="text-xs text-text-secondary">Wall merged; reverse if the claim was fraudulent.</span>
                        <Button size="sm" variant="outline" onClick={() => reverseClaim(existing, latestClaim)} disabled={saving}>Reverse claim</Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {status && <p className="text-danger text-xs">{status}</p>}
        </Card>
      )}

      <ConfirmDialog
        open={!!pendingRecentCancel}
        title="Cancel this invitation?"
        message={`Cancel the invite to ${pendingRecentCancel?.contact_email || "this recipient"}? This can't be undone.`}
        confirmLabel="Cancel invite"
        cancelLabel="Keep invite"
        loading={!!pendingRecentCancel && recentCancellingId === pendingRecentCancel.claim_id}
        onConfirm={confirmRecentCancel}
        onCancel={() => setPendingRecentCancel(null)}
      />
      <ConfirmDialog
        open={!!pendingRecentMerge}
        title="Merge this wall?"
        message={<span className="whitespace-pre-line">{pendingRecentMerge?.summary}</span>}
        confirmLabel="Merge wall"
        loading={!!pendingRecentMerge && recentMergingId === pendingRecentMerge.claim.claim_id}
        onConfirm={confirmRecentMerge}
        onCancel={() => setPendingRecentMerge(null)}
      />
      <PromptDialog
        open={!!pendingRecentReverse}
        title="Reverse this claim?"
        message="This restores the original wall owner and moves all content back. Give a reason for the audit trail."
        placeholder="Reason for reversing this claim…"
        confirmLabel="Reverse claim"
        loading={!!pendingRecentReverse && recentReversingId === pendingRecentReverse.claim_id}
        onConfirm={confirmRecentReverse}
        onCancel={() => setPendingRecentReverse(null)}
      />
      <PromptDialog
        open={!!pendingReject}
        title="Reject this claim?"
        message="The claimant's profile will no longer show this officeholder's details. Give a reason for the audit trail."
        placeholder="Reason for rejecting this claim…"
        confirmLabel="Reject claim"
        loading={saving && !!pendingReject}
        onConfirm={confirmRejectClaim}
        onCancel={() => setPendingReject(null)}
      />
      <PromptDialog
        open={!!pendingReverse}
        title="Reverse this claim?"
        message="This restores the original wall owner and moves all content back. Give a reason for the audit trail."
        placeholder="Reason for reversing this claim…"
        confirmLabel="Reverse claim"
        loading={saving && !!pendingReverse}
        onConfirm={confirmReverseClaim}
        onCancel={() => setPendingReverse(null)}
      />
    </div>
  );
}
