"use client";

import React, { useState, useEffect, useCallback } from "react";
import AdminSubNav from "./AdminSubNav";
import { getCountries, listBoundaryTypes, searchMapShapesByName } from "@/lib/services/boundaries";
import { getElectionRoleTypes, getOfficeHoldersForShape, upsertOfficeHolder, removeOfficeHolder, inviteOfficeholderToClaim, resendOfficeholderClaim, getOfficeholderWallClaims, mergeOfficeholderWallClaim, reverseOfficeholderWallClaim } from "@/lib/services/elections";
import { getPoliticalParties } from "@/lib/services/politicalParties";
import { adminGetProfileById } from "@/lib/services/profile";
import { UserCheck, Search, Save, Trash2, X, Link2, Mail } from "lucide-react";
import { Card, Button, Input, Textarea, Select, Spinner, PageHeader } from "@/components/primitives";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import Link from "next/link";
import { buildPoliticianWallSlug } from "@/lib/utils/slugs";

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

    const { error: inviteError } = await sendClaimInvitation(officeHolder.id, email);
    setWallInviting(false);
    setStatus(
      inviteError
        ? `Invitation error: ${inviteError.message}`
        : `Claim invitation sent to ${email} for ${profile.full_name || "the wall"}.`,
    );
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

  const reverseClaim = async (holder: Holder, claim: OfficeholderClaim) => {
    const reason = window.prompt("Reason for reversing this claim:");
    if (!reason?.trim()) return;
    setSaving(true);
    const { error } = await reverseOfficeholderWallClaim(supabase, claim.id, reason.trim());
    setSaving(false);
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
      </Card>

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
    </div>
  );
}
