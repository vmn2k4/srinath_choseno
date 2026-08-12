"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  getOwnProfile,
  getPoliticianProfileFull,
  getLatestUserLocation,
  getUserBoundaryMemberships,
  upsertProfileCore,
  upsertPoliticianProfile,
  uploadAvatarImage,
} from "@/lib/services/profile";
import { getPoliticalParties, getPoliticalPartyById } from "@/lib/services/politicalParties";
import { findBoundariesByPoint, syncUserBoundaryMemberships } from "@/lib/services/boundaries";
import { ArrowLeft, Camera, Check, Layers, MapPin, RefreshCw } from "lucide-react";
import { Alert, Badge, Button, Card, Input, PageHeader, Select, Spinner, Textarea } from "@/components/primitives";
import InteractiveLocationPicker from "./InteractiveLocationPicker";
import { createClient } from "@/lib/supabase/client";

// Dedicated edit-profile experience — deliberately *not* a re-run of the onboarding
// wizard (which OnboardingFlowClient.tsx owns for first-time signup only). Editing an
// existing profile has different needs: fields should arrive pre-filled, any subset of
// them can be changed in one save, and role is never re-picked here (a politician can
// never downgrade back to citizen — enforced at the DB layer by
// guard_politician_role_downgrade(), so there's deliberately no UI path attempting it).

export default function EditProfileClient() {
  const supabase = createClient();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [role, setRole] = useState<string>("");
  const [fullName, setFullName] = useState("");
  const [matchedBoundaries, setMatchedBoundaries] = useState<any[]>([]);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState("");

  const [politicalParty, setPoliticalParty] = useState("");
  const [hometown, setHometown] = useState("");
  const [education, setEducation] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [politicalTargetRole, setPoliticalTargetRole] = useState("");
  const [targetBoundaryId, setTargetBoundaryId] = useState<string | null>(null);
  const [parties, setParties] = useState<any[]>([]);
  // The saved political_party_id can belong to a country outside the
  // boundary-filtered `parties` list (mismatched officeholder data, a
  // relocated profile, etc.) -- cached here so it's still shown/selectable
  // instead of the <select> silently rendering as unselected. Only ever set
  // from inside the effect's async fetch below, never synchronously, so it
  // just holds "the last party we looked up" -- savedPartyOutOfList (derived
  // below) decides whether that's still the one that should render.
  const [fetchedFallbackParty, setFetchedFallbackParty] = useState<{ id: number; name: string; country: string } | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");

  const isPolitician = role === "politician";

  useEffect(() => {
    if (authLoading) return;
    Promise.resolve().then(async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      const { data } = await getOwnProfile(supabase, user.id);
      const profRecord = data as any;
      setRole(profRecord?.role || "");
      setFullName(profRecord?.full_name || "");

      if (profRecord?.role === "politician") {
        const { data: pd } = await getPoliticianProfileFull(supabase, user.id);
        setPoliticalParty(pd?.political_party_id ? String(pd.political_party_id) : "");
        setHometown(pd?.hometown || "");
        setEducation(pd?.education || "");
        setBio(pd?.bio || "");
        setAvatarUrl(pd?.avatar_url || "");
        setPoliticalTargetRole(pd?.political_target_role || "");
        setTargetBoundaryId(pd?.target_boundary_id ?? null);
        setContactEmail(pd?.contact_email || "");
        setContactPhone(pd?.contact_phone || "");
        setSourceUrl(pd?.source_url || "");
      }

      const { data: locRows } = await getLatestUserLocation(supabase, user.id);
      const locData = (locRows as any)?.[0] || null;
      if (locData) {
        setLat(String(locData.latitude));
        setLng(String(locData.longitude));
      }

      const { data: memberships } = await getUserBoundaryMemberships(supabase, user.id);
      setMatchedBoundaries((memberships || []).map((m: any) => m.map_shapes).filter(Boolean));

      setLoading(false);
    });
  }, [user, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const country = matchedBoundaries?.[0]?.country;
    if (!isPolitician || !country) return;
    getPoliticalParties(supabase, { country }).then(({ data: rows }) => setParties(rows || []));
  }, [isPolitician, matchedBoundaries, supabase]);

  // If the saved party isn't in the country-filtered list above, look it up
  // directly so it can still be shown/selected (see savedPartyOutOfList
  // below) instead of appearing as "no party chosen".
  const partyInList = parties.some((p) => String(p.id) === politicalParty);
  useEffect(() => {
    if (!politicalParty || partyInList) return;
    if (fetchedFallbackParty && String(fetchedFallbackParty.id) === politicalParty) return;
    let cancelled = false;
    getPoliticalPartyById(supabase, Number(politicalParty)).then(({ data }) => {
      if (!cancelled && data) setFetchedFallbackParty(data);
    });
    return () => {
      cancelled = true;
    };
  }, [politicalParty, partyInList, fetchedFallbackParty, supabase]);

  const savedPartyOutOfList =
    politicalParty && !partyInList && fetchedFallbackParty && String(fetchedFallbackParty.id) === politicalParty
      ? fetchedFallbackParty
      : null;

  const reVerifyLocation = async (latitude: number, longitude: number) => {
    setLocLoading(true);
    setLocError("");
    try {
      const { data: boundaries, error: rpcError } = await findBoundariesByPoint(supabase, latitude, longitude);
      if (rpcError) throw rpcError;
      const { error: syncError } = await syncUserBoundaryMemberships(supabase, latitude, longitude);
      if (syncError) throw syncError;
      setLat(latitude.toString());
      setLng(longitude.toString());
      setMatchedBoundaries(boundaries || []);
      if (!boundaries || boundaries.length === 0) {
        setLocError("No configured boundaries cover this location yet.");
      }
    } catch (err) {
      console.error(err);
      setLocError("Could not resolve location boundaries.");
    } finally {
      setLocLoading(false);
    }
  };

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) return setAvatarError("Image must be less than 5MB");

    setAvatarError(null);
    setUploadingAvatar(true);
    const { publicUrl, error: uploadError } = await uploadAvatarImage(supabase, file, user.id);
    setUploadingAvatar(false);

    if (uploadError) {
      setAvatarError("Failed to upload image. Please try again.");
      return;
    }
    setAvatarUrl(publicUrl || "");
  };

  const handleSave = async () => {
    if (!user) return;
    if (locLoading) {
      setError("Please wait for location verification to finish before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const matchedNames = matchedBoundaries.map((b: any) => b.name).join(", ") || null;
      const derivedCountry = matchedBoundaries?.[0]?.country ?? null;

      const { error: profileError } = await upsertProfileCore(supabase, user.id, {
        role, // unchanged — this page never offers a role picker
        fullName,
        country: derivedCountry,
        constituency: matchedNames,
      });
      if (profileError) throw profileError;

      if (isPolitician) {
        const { error: polError } = await upsertPoliticianProfile(
          supabase,
          user.id,
          {
            targetBoundaryName: matchedNames,
            politicalPartyId: politicalParty ? Number(politicalParty) : null,
            education,
            hometown,
            bio,
            avatarUrl,
            politicalTargetRole: politicalTargetRole || null,
            contactEmail: contactEmail || null,
            contactPhone: contactPhone || null,
            sourceUrl: sourceUrl || null,
          },
          targetBoundaryId
        );
        if (polError) throw polError;
      }

      setSaved(true);
      router.push("/profile");
      router.refresh();
    } catch (err: unknown) {
      console.error(err);
      const errorObj = err as { message?: string };
      setError(errorObj.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner fullPage />;

  return (
    <div className="w-full max-w-2xl mx-auto mt-6 pb-20 animate-fade-in px-4 space-y-6">
      <PageHeader
        title="Edit Profile"
        subtitle="Update your details — change only what you need."
        action={
          <Button variant="ghost" onClick={() => router.push("/profile")}>
            <ArrowLeft size={16} /> Back
          </Button>
        }
      />

      <Card padding="md" className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest">
            General Info
          </h3>
          <Badge tone={isPolitician ? "primary" : "accent"} size="sm">
            {isPolitician ? "Politician" : "Citizen"}
          </Badge>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-tertiary mb-2">
            {isPolitician ? "Full Public Name" : "Display Name (optional)"}
          </label>
          <Input
            type="text"
            placeholder={isPolitician ? "e.g. Jane Doe" : "e.g. Alex — only visible on your Profile"}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          {isPolitician && (
            <p className="text-xs text-text-muted mt-1.5">
              This is public and tied to your official Wall and QR code.
            </p>
          )}
        </div>
      </Card>

      <Card padding="md" className="space-y-4">
        <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest">
          Location & Constituencies
        </h3>

        {matchedBoundaries.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {matchedBoundaries.map((b: any) => (
              <span
                key={b.id}
                className="px-3 py-1 bg-surface-elevated border border-border-light/40 rounded-xl text-xs font-medium text-text-main flex items-center gap-1.5"
              >
                <MapPin size={12} className="text-accent" /> {b.name}
                {b.boundary_type && (
                  <span className="text-[10px] text-text-muted font-normal">({b.boundary_type})</span>
                )}
              </span>
            ))}
          </div>
        )}

        <InteractiveLocationPicker
          currentLat={lat}
          currentLng={lng}
          onLocationSelect={reVerifyLocation}
          loading={locLoading}
          error={locError}
        />

        {matchedBoundaries.length > 0 && (
          <p className="text-xs text-text-muted flex items-center gap-1.5">
            <Layers size={13} /> Re-verifying replaces your current constituency memberships above.
          </p>
        )}
      </Card>

      {isPolitician && (
        <Card padding="md" className="space-y-4">
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest">
            Political Details
          </h3>

          <div>
            <label className="block text-sm font-medium text-text-tertiary mb-2">
              Profile Photo <span className="text-text-dark text-xs">(optional)</span>
            </label>
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 rounded-full bg-surface-hover border border-border-light flex items-center justify-center overflow-hidden shrink-0">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt="Profile" fill sizes="64px" className="object-cover" />
                ) : (
                  <Camera size={20} className="text-text-muted" />
                )}
                {uploadingAvatar && (
                  <div className="absolute inset-0 bg-surface/70 flex items-center justify-center">
                    <RefreshCw size={16} className="animate-spin text-text-muted" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  id="avatar-upload-edit"
                  className="hidden"
                  onChange={handleAvatarSelect}
                />
                <label htmlFor="avatar-upload-edit">
                  <Button as="span" variant="outline" size="sm" className="cursor-pointer">
                    {avatarUrl ? "Replace Photo" : "Upload Photo"}
                  </Button>
                </label>
              </div>
            </div>
            {avatarError && <p className="text-danger text-xs mt-1">{avatarError}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-text-tertiary mb-2">
              Aspiring Position <span className="text-text-dark text-xs">(e.g. City Councillor, Mayor)</span>
            </label>
            <Input
              placeholder="e.g. City Councillor, Member of Parliament"
              value={politicalTargetRole}
              onChange={(e) => setPoliticalTargetRole(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-tertiary mb-2">Political Party</label>
            <Select value={politicalParty} onChange={(e) => setPoliticalParty(e.target.value)}>
              <option value="">Select a party (optional)...</option>
              {savedPartyOutOfList && (
                <option value={savedPartyOutOfList.id}>
                  {savedPartyOutOfList.name} ({savedPartyOutOfList.country})
                </option>
              )}
              {parties.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            {savedPartyOutOfList && (
              <p className="text-xs text-text-muted mt-1">
                This party is registered for {savedPartyOutOfList.country}, outside your detected boundaries.
                Change it if that&apos;s not right.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-text-tertiary mb-2">Official Website / Campaign Page</label>
            <Input
              placeholder="e.g. https://mycampaign.com"
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-tertiary mb-2">Contact Phone</label>
            <Input
              placeholder="e.g. (555) 123-4567"
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-tertiary mb-2">Contact Email</label>
            <Input
              placeholder="e.g. contact@mycampaign.com"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-tertiary mb-2">Hometown</label>
            <Input placeholder="e.g. Vancouver, BC" value={hometown} onChange={(e) => setHometown(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-tertiary mb-2">Education</label>
            <Input
              placeholder="e.g. B.A. Political Science, UBC"
              value={education}
              onChange={(e) => setEducation(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-tertiary mb-2">Bio / Platform Summary</label>
            <Textarea
              placeholder="Brief overview of your background and priorities..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
            />
          </div>
        </Card>
      )}

      {error && <Alert tone="danger">{error}</Alert>}
      {saved && <Alert tone="success">Profile saved.</Alert>}

      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={() => router.push("/profile")}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving || locLoading}>
          {saving ? "Saving..." : locLoading ? "Verifying Location..." : "Save Changes"}
          {!saving && <Check size={16} className="ml-1" />}
        </Button>
      </div>
    </div>
  );
}
