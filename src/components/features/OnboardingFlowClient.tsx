"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { upsertProfileCore, upsertPoliticianProfile, uploadAvatarImage } from "@/lib/services/profile";
import { getPoliticalParties } from "@/lib/services/politicalParties";
import {
  Users,
  Flag,
  ArrowLeft,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  User as UserIcon,
  Camera,
  RefreshCw,
  Layers,
  Check,
} from "lucide-react";
import { Card, Button, Input, Textarea, Select, Alert } from "@/components/primitives";
import InteractiveLocationPicker from "./InteractiveLocationPicker";
import { findBoundariesByPoint, syncUserBoundaryMemberships } from "@/lib/services/boundaries";
import { createClient } from "@/lib/supabase/client";

type Supabase = ReturnType<typeof createClient>;

interface OnboardingFormData {
  role: string; // 'citizen' or 'politician'
  lat: string;
  lng: string;
  matchedBoundaries: any[];
  fullName: string;
  politicalParty: string;
  education: string;
  hometown: string;
  bio: string;
  avatarUrl: string;
}

// ── Sub-step 1: Role ─────────────────────────────────────────────────────────

function StepRole({
  formData,
  updateData,
  nextStep,
}: {
  formData: OnboardingFormData;
  updateData: (d: Partial<OnboardingFormData>) => void;
  nextStep: () => void;
}) {
  return (
    <div className="animate-fade-in">
      <div className="text-center mb-6 sm:mb-10">
        <h2 className="text-2xl sm:text-3xl font-bold text-text-main mb-2 sm:mb-3">
          Welcome to Choseno
        </h2>
        <p className="text-sm sm:text-base text-text-muted">
          How are you planning to use the network?
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <button
          onClick={() => {
            updateData({ role: "citizen" });
            nextStep();
          }}
          className={`flex flex-col items-center justify-center p-6 sm:p-8 rounded-2xl border-2 transition-all cursor-pointer ${
            formData.role === "citizen"
              ? "border-primary bg-primary/10"
              : "border-border-light hover:border-primary-light hover:bg-surface-hover"
          }`}
        >
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-surface-elevated flex items-center justify-center mb-3 sm:mb-4 text-text-secondary shrink-0">
            <Users size={32} />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-text-main mb-2">
            Citizen / Voter
          </h3>
          <p className="text-sm text-text-muted text-center">
            Post anonymously, vote on local issues, and connect with your verified
            community.
          </p>
        </button>

        <button
          onClick={() => {
            updateData({ role: "politician" });
            nextStep();
          }}
          className={`flex flex-col items-center justify-center p-6 sm:p-8 rounded-2xl border-2 transition-all cursor-pointer ${
            formData.role === "politician"
              ? "border-accent bg-accent/10"
              : "border-border-light hover:border-accent-hover hover:bg-surface-hover"
          }`}
        >
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-surface-elevated flex items-center justify-center mb-3 sm:mb-4 text-text-secondary shrink-0">
            <Flag size={32} />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-text-main mb-2">
            Candidate / Representative
          </h3>
          <p className="text-sm text-text-muted text-center">
            Publish video statements, file candidacy, and engage directly with
            verified constituents.
          </p>
        </button>
      </div>
    </div>
  );
}

// ── Sub-step 2: Location ─────────────────────────────────────────────────────

function StepLocation({
  supabase,
  formData,
  updateData,
  nextStep,
  prevStep,
}: {
  supabase: Supabase;
  formData: OnboardingFormData;
  updateData: (d: Partial<OnboardingFormData>) => void;
  nextStep: () => void;
  prevStep: () => void;
}) {
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState("");

  const lookupBoundaries = async (latitude: number, longitude: number) => {
    setLocLoading(true);
    setLocError("");
    try {
      const { data: boundaries, error: rpcError } = await findBoundariesByPoint(
        supabase,
        latitude,
        longitude
      );
      if (rpcError) throw rpcError;

      const { error: syncError } = await syncUserBoundaryMemberships(
        supabase,
        latitude,
        longitude
      );
      if (syncError) throw syncError;

      updateData({
        lat: latitude.toString(),
        lng: longitude.toString(),
        matchedBoundaries: boundaries || [],
      });

      if (!boundaries || boundaries.length === 0) {
        setLocError(
          "No configured boundaries cover this location yet. You can still continue."
        );
      }
    } catch (err: unknown) {
      console.error(err);
      setLocError("Could not resolve location boundaries.");
    } finally {
      setLocLoading(false);
    }
  };

  const matchedBoundaries = formData.matchedBoundaries || [];
  const hasLocation = Boolean(formData.lat && formData.lng);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={prevStep} className="rounded-full">
          <ArrowLeft size={20} />
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-text-main">
            Verify Your Electoral District
          </h2>
          <p className="text-sm text-text-muted">
            We will resolve every verified constituency your location falls
            inside.
          </p>
        </div>
      </div>

      <InteractiveLocationPicker
        currentLat={formData.lat}
        currentLng={formData.lng}
        onLocationSelect={(latitude, longitude) =>
          lookupBoundaries(latitude, longitude)
        }
        loading={locLoading}
        error={locError}
      />

      {matchedBoundaries.length > 0 && (
        <div className="p-4 bg-primary/10 border border-primary/30 rounded-2xl space-y-2">
          <p className="text-xs text-text-muted uppercase font-bold tracking-wider flex items-center gap-1.5">
            <Layers size={14} /> Verified in {matchedBoundaries.length}{" "}
            constituenc{matchedBoundaries.length > 1 ? "ies" : "y"}
          </p>
          <div className="flex flex-wrap gap-2">
            {matchedBoundaries.map((b: any) => (
              <span
                key={b.id}
                className="px-3 py-1 bg-surface-elevated border border-border-light/40 rounded-xl text-xs font-medium text-text-main flex items-center gap-1.5"
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

      <div className="flex justify-between items-center pt-4 border-t border-border-light/20">
        <Button variant="ghost" onClick={prevStep}>
          Back
        </Button>
        <Button onClick={nextStep} disabled={!hasLocation && matchedBoundaries.length === 0}>
          Continue <ArrowRight size={18} className="ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ── Sub-step 3: Username / Display Name ──────────────────────────────────────

function StepUsername({
  formData,
  updateData,
  nextStep,
  prevStep,
  error,
  loading,
  submitOnboarding,
}: {
  formData: OnboardingFormData;
  updateData: (d: Partial<OnboardingFormData>) => void;
  nextStep: () => void;
  prevStep: () => void;
  error: string | null;
  loading: boolean;
  submitOnboarding: () => void;
}) {
  const isPolitician = formData.role === "politician";
  const canContinue = isPolitician ? formData.fullName?.trim() : true;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={prevStep} className="rounded-full">
          <ArrowLeft size={20} />
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-text-main">
            {isPolitician ? "Your Public Name" : "Your Identity"}
          </h2>
          <p className="text-sm text-text-muted">
            {isPolitician
              ? "This will appear on your public Wall."
              : "Choose how you appear in the platform."}
          </p>
        </div>
      </div>

      {isPolitician ? (
        <div className="space-y-5">
          <Card padding="sm" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary-light flex items-center justify-center shrink-0">
              <UserIcon size={20} />
            </div>
            <p className="text-sm text-text-muted">
              As a <strong className="text-text-secondary">Politician</strong>,
              your name is public and tied to your official Wall and QR code.
            </p>
          </Card>

          <div>
            <label className="block text-sm font-medium text-text-tertiary mb-2">
              Full Public Name
            </label>
            <Input
              type="text"
              placeholder="e.g. Jane Doe"
              value={formData.fullName}
              onChange={(e) => updateData({ fullName: e.target.value })}
              autoFocus
            />
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-text-tertiary mb-2">
              Display Name{" "}
              <span className="text-text-dark text-xs font-normal ml-1">
                (optional)
              </span>
            </label>
            <Input
              type="text"
              placeholder="e.g. Alex — only visible on your Profile"
              value={formData.fullName}
              onChange={(e) => updateData({ fullName: e.target.value })}
            />
            <p className="text-xs text-text-muted mt-1.5">
              This is only shown on your Profile settings page, never attached to
              your anonymous posts.
            </p>
          </div>

          <Card padding="sm" className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 bg-primary/20 text-primary-light rounded-xl flex items-center justify-center shrink-0">
                <ShieldAlert size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-text-main mb-0.5">
                  The Ghost ID System
                </h3>
                <p className="text-text-muted text-sm">
                  All your posts are published under a cryptographically
                  generated Ghost ID, completely separate from your account.
                </p>
              </div>
            </div>

            <ul className="space-y-2.5">
              {[
                "Posts are 100% anonymous — no username, no avatar.",
                "Only your boundary jurisdiction is used to route your posts.",
                'You can permanently "burn" your Ghost ID at any time to start fresh.',
              ].map((text, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-sm text-text-tertiary"
                >
                  <CheckCircle2 size={16} className="text-success shrink-0 mt-0.5" />
                  {text}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="flex justify-end pt-4 border-t border-border-light/20">
        {isPolitician ? (
          <Button onClick={nextStep} disabled={!canContinue}>
            Continue <ArrowRight size={18} className="ml-1" />
          </Button>
        ) : (
          <Button onClick={submitOnboarding} disabled={loading}>
            {loading ? "Completing..." : "Complete Setup"}
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Sub-step 4: Politician Details ───────────────────────────────────────────

function StepPolitician({
  supabase,
  user,
  formData,
  updateData,
  prevStep,
  error,
  loading,
  submitOnboarding,
}: {
  supabase: Supabase;
  user: { id: string } | null | undefined;
  formData: OnboardingFormData;
  updateData: (d: Partial<OnboardingFormData>) => void;
  prevStep: () => void;
  error: string | null;
  loading: boolean;
  submitOnboarding: () => void;
}) {
  const [parties, setParties] = useState<any[]>([]);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const country = formData.matchedBoundaries?.[0]?.country || null;

  useEffect(() => {
    if (!country) return;
    getPoliticalParties(supabase, { country }).then(({ data: rows }) => {
      setParties(rows || []);
    });
  }, [country, supabase]);

  const handleAvatarSelect = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024)
      return setAvatarError("Image must be less than 5MB");

    setAvatarError(null);
    setUploadingAvatar(true);
    const { publicUrl, error: uploadError } = await uploadAvatarImage(
      supabase,
      file,
      user.id
    );
    setUploadingAvatar(false);

    if (uploadError) {
      setAvatarError("Failed to upload image. Please try again.");
      return;
    }
    updateData({ avatarUrl: publicUrl || "" });
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={prevStep} className="rounded-full">
          <ArrowLeft size={20} />
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-text-main">
            Political Details
          </h2>
          <p className="text-sm text-text-muted">
            Tell your constituents about yourself.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-tertiary mb-2">
            Profile Photo <span className="text-text-dark text-xs">(optional)</span>
          </label>
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 rounded-full bg-surface-hover border border-border-light flex items-center justify-center overflow-hidden shrink-0">
              {formData.avatarUrl ? (
                <Image
                  src={formData.avatarUrl}
                  alt="Profile"
                  fill
                  sizes="64px"
                  className="object-cover"
                />
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
                id="avatar-upload"
                className="hidden"
                onChange={handleAvatarSelect}
              />
              <label htmlFor="avatar-upload">
                <Button
                  as="span"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                >
                  {formData.avatarUrl ? "Replace Photo" : "Upload Photo"}
                </Button>
              </label>
            </div>
          </div>
          {avatarError && (
            <p className="text-danger text-xs mt-1">{avatarError}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-text-tertiary mb-2">
            Political Party
          </label>
          <Select
            value={formData.politicalParty}
            onChange={(e) => updateData({ politicalParty: e.target.value })}
          >
            <option value="">Select a party (optional)...</option>
            {parties.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-tertiary mb-2">
            Hometown
          </label>
          <Input
            placeholder="e.g. Vancouver, BC"
            value={formData.hometown}
            onChange={(e) => updateData({ hometown: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-tertiary mb-2">
            Education
          </label>
          <Input
            placeholder="e.g. B.A. Political Science, UBC"
            value={formData.education}
            onChange={(e) => updateData({ education: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-tertiary mb-2">
            Bio / Platform Summary
          </label>
          <Textarea
            placeholder="Brief overview of your background and priorities..."
            value={formData.bio}
            onChange={(e) => updateData({ bio: e.target.value })}
            rows={3}
          />
        </div>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="flex justify-between items-center pt-4 border-t border-border-light/20">
        <Button variant="ghost" onClick={prevStep}>
          Back
        </Button>
        <Button onClick={submitOnboarding} disabled={loading}>
          {loading ? "Saving Profile..." : "Complete Setup"}
        </Button>
      </div>
    </div>
  );
}

// ── Top-level wizard shell ────────────────────────────────────────────────────

export default function OnboardingFlowClient() {
  const supabase = createClient();
  const { user } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<OnboardingFormData>({
    role: "",
    lat: "",
    lng: "",
    matchedBoundaries: [],
    fullName: "",
    politicalParty: "",
    education: "",
    hometown: "",
    bio: "",
    avatarUrl: "",
  });

  const nextStep = () => setCurrentStep((prev) => prev + 1);
  const prevStep = () => setCurrentStep((prev) => prev - 1);

  const updateData = (newData: Partial<OnboardingFormData>) => {
    setFormData((prev) => ({ ...prev, ...newData }));
  };

  const submitOnboarding = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const isAdminEmail = user.email?.toLowerCase() === "vmn2k4@gmail.com";
      const finalRole = isAdminEmail
        ? "admin"
        : formData.role === "citizen"
        ? "normal"
        : formData.role;
      const matchedNames =
        (formData.matchedBoundaries || []).map((b: any) => b.name).join(", ") || null;
      const derivedCountry = formData.matchedBoundaries?.[0]?.country ?? null;

      const { error: profileError } = await upsertProfileCore(
        supabase,
        user.id,
        {
          role: finalRole,
          fullName: formData.fullName,
          country: derivedCountry,
          constituency: matchedNames,
        },
        { onboardingCompleted: true }
      );
      if (profileError) throw profileError;

      if (formData.role === "politician") {
        const primaryBoundary = formData.matchedBoundaries?.[0];
        const { error: polError } = await upsertPoliticianProfile(
          supabase,
          user.id,
          {
            targetBoundaryId: primaryBoundary ? String(primaryBoundary.id) : undefined,
            targetBoundaryName: matchedNames,
            politicalPartyId: formData.politicalParty ? Number(formData.politicalParty) : null,
            education: formData.education,
            hometown: formData.hometown,
            bio: formData.bio,
            avatarUrl: formData.avatarUrl,
          },
          null
        );
        if (polError) throw polError;
      }

      window.location.href = "/feed";
    } catch (err: unknown) {
      console.error(err);
      const errorObj = err as { message?: string };
      setError(errorObj.message || "Failed to save profile.");
      setLoading(false);
    }
  };

  const totalSteps = formData.role === "citizen" ? 3 : 4;

  return (
    <div className="w-full flex items-center justify-center py-6 sm:py-10 px-4">
      <Card
        padding="none"
        className="w-full max-w-2xl overflow-hidden relative animate-fade-in"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-surface-hover">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>

        <div className="p-5 sm:p-8">
          {currentStep === 1 && (
            <StepRole formData={formData} updateData={updateData} nextStep={nextStep} />
          )}
          {currentStep === 2 && (
            <StepLocation
              supabase={supabase}
              formData={formData}
              updateData={updateData}
              nextStep={nextStep}
              prevStep={prevStep}
            />
          )}
          {currentStep === 3 && (
            <StepUsername
              formData={formData}
              updateData={updateData}
              nextStep={nextStep}
              prevStep={prevStep}
              error={error}
              loading={loading}
              submitOnboarding={submitOnboarding}
            />
          )}
          {currentStep === 4 && (
            <StepPolitician
              supabase={supabase}
              user={user}
              formData={formData}
              updateData={updateData}
              prevStep={prevStep}
              error={error}
              loading={loading}
              submitOnboarding={submitOnboarding}
            />
          )}
        </div>
      </Card>
    </div>
  );
}
