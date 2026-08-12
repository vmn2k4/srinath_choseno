"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { MapPin, Pencil, Flame, RefreshCw, Award } from "lucide-react";
import {
  getOwnProfile,
  getPoliticianProfileFull,
  getLatestUserLocation,
  getUserBoundaryMemberships,
  calculateMyScore,
} from "@/lib/services/profile";
import { burnGhostIdentityViaRpc } from "@/lib/services/feed";
import {
  Card,
  Button,
  Badge,
  Spinner,
  PageHeader,
  ConfirmDialog,
} from "@/components/primitives";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/contexts/LanguageContext";

export default function ProfilePageClient() {
  const { t } = useTranslation();
  const supabase = createClient();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [burning, setBurning] = useState(false);
  const [showBurnConfirm, setShowBurnConfirm] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [score, setScore] = useState<number | null>(null);
  const [scoring, setScoring] = useState(false);

  const fetchProfile = async () => {
    if (!user) return;
    setLoading(true);

    const { data } = await getOwnProfile(supabase, user.id);
    const profRecord = data as any;

    let polData: any = null;
    if (profRecord?.role === "politician") {
      const { data: pd } = await getPoliticianProfileFull(supabase, user.id);
      polData = pd;
    }

    const { data: locRows } = await getLatestUserLocation(supabase, user.id);
    const locData = (locRows as any)?.[0] || null;

    const { data: memberships } = await getUserBoundaryMemberships(
      supabase,
      user.id
    );
    const matchedBoundaries = (memberships || [])
      .map((m: any) => m.map_shapes)
      .filter(Boolean);

    setProfile({
      role: profRecord?.role || "",
      fullName: profRecord?.full_name || "",
      country: profRecord?.country || "",
      constituency: profRecord?.constituency || "",
      ghostId: profRecord?.current_ghost_id || "",
      lastBurnedAt: profRecord?.last_burned_at || null,
      burnCount: profRecord?.burn_count || 0,
      politicalPartyId: polData?.political_party_id || "",
      politicalParty: polData?.political_parties?.name || "",
      education: polData?.education || "",
      hometown: polData?.hometown || "",
      bio: polData?.bio || "",
      avatarUrl: polData?.avatar_url || "",
      target_boundary_id: polData?.target_boundary_id || null,
      lat: locData?.latitude || "",
      lng: locData?.longitude || "",
      matchedBoundaries,
    });
    setScore(profRecord?.cached_total_score ?? 0);
    setLoading(false);

    const { data: freshScore, error: scoreError } = await calculateMyScore(
      supabase
    );
    if (!scoreError && freshScore != null) setScore(freshScore);
  };

  useEffect(() => {
    if (authLoading) return;
    Promise.resolve().then(() => {
      if (user) {
        fetchProfile();
      } else {
        setLoading(false);
      }
    });
  }, [user, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const burnGhostId = async () => {
    if (!user) return;
    setBurning(true);
    const { error } = await burnGhostIdentityViaRpc(supabase);
    setBurning(false);
    setShowBurnConfirm(false);
    if (error) {
      alert("Failed to burn identity. Please try again.");
    } else {
      await fetchProfile();
    }
  };

  const updateScore = async () => {
    setScoring(true);
    const { data, error } = await calculateMyScore(supabase);
    if (!error && data != null) {
      setScore(data);
    }
    setScoring(false);
  };

  if (loading) return <Spinner fullPage />;

  if (profile?.role === "admin") {
    return (
      <div className="w-full max-w-none px-4 lg:px-8 mt-10">
        <Card padding="lg" className="text-center">
          <h3 className="text-xl font-bold text-text-secondary mb-2">
            Administrator Account
          </h3>
          <p className="text-text-muted mb-4">
            You manage electoral boundaries. Your profile is locked.
          </p>
          <Button onClick={() => router.push("/admin")}>Go to Admin Portal</Button>
        </Card>
      </div>
    );
  }

  const roleLabel =
    profile?.role === "normal"
      ? t("profile.citizen")
      : profile?.role === "politician"
      ? t("profile.politician")
      : t("profile.notSet");
  const roleTone = profile?.role === "politician" ? "primary" : "accent";

  // Citizen -> politician only. The reverse is permanently blocked at the database
  // (guard_politician_role_downgrade trigger) since a politician account can have
  // accumulated real state — candidacies, a public wall, supporters — that a downgrade
  // would silently orphan, so this button (and the DB call it makes) is never offered
  // once profile.role === "politician"; see the JSX below.
  const switchToPolitician = async () => {
    if (!user || !profile) return;
    const { error } = await supabase
      .from("profiles")
      .update({ role: "politician" })
      .eq("id", user.id);
    if (error) {
      alert("Failed to switch role: " + error.message);
      return;
    }
    fetchProfile();
  };

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 space-y-6">
      <PageHeader
        title={t("profile.title")}
        subtitle={t("profile.subtitle")}
        action={
          <Button variant="outline" onClick={() => router.push("/profile/edit")}>
            <Pencil size={15} /> {t("profile.editBtn")}
          </Button>
        }
      />

      {/* General Info Card */}
      <Card padding="md" className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest">
            {t("profile.generalInfo")}
          </h3>
          {profile?.role !== "politician" && (
            <button
              onClick={switchToPolitician}
              className="text-xs font-semibold text-text-muted hover:text-text-main hover:bg-surface-hover px-3 py-1.5 rounded-lg border border-border-light transition-colors cursor-pointer"
            >
              {t("profile.switchToPolitician")}
            </button>
          )}
        </div>
        {/* Below sm: each field is one row (label left, value right) instead
            of a stacked label-above-value block, so the card doesn't spend
            a full row's height on a single short fact. sm+ reverts to the
            original stacked two-column layout. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
          <div className="flex items-center justify-between gap-3 sm:block">
            <p className="text-xs text-text-muted sm:mb-1">{t("profile.fullName")}</p>
            <p className="font-semibold text-text-main text-right sm:text-left">
              {profile?.fullName || (
                <em className="text-text-muted not-italic font-normal">{t("profile.notSet")}</em>
              )}
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 sm:block">
            <p className="text-xs text-text-muted sm:mb-1">{t("profile.accountType")}</p>
            <Badge tone={roleTone} size="sm">
              {roleLabel}
            </Badge>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-text-muted mb-1">
              {t("profile.verifiedConstituencies")}
            </p>
            {profile?.matchedBoundaries?.length ? (
              <div className="flex flex-wrap gap-2 mt-1.5">
                {profile.matchedBoundaries.map((b: any) => (
                  <span
                    key={b.id}
                    className="flex items-center gap-1.5 px-3 py-1 bg-surface-hover rounded-lg border border-border-light text-xs font-semibold text-text-main"
                  >
                    <MapPin size={12} className="text-accent shrink-0" />
                    {b.name}
                    {b.boundary_type && (
                      <span className="text-text-muted font-normal text-[11px]">
                        ({b.boundary_type})
                      </span>
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-muted mt-1">
                No location boundaries set yet.
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Ghost ID & Privacy Section */}
      <Card padding="md" className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest">
            Privacy & Ghost ID
          </h3>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBurnConfirm(true)}
            className="text-xs text-danger hover:text-danger hover:border-danger/40"
          >
            <Flame size={14} /> Burn Ghost ID
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <p className="text-xs text-text-muted mb-1">Current Ghost ID</p>
            <p className="font-mono text-xs text-text-secondary truncate">
              {profile?.ghostId || "None"}
            </p>
          </div>

          <div>
            <p className="text-xs text-text-muted mb-1">Civic Impact Score</p>
            <div className="flex items-center gap-2">
              <Award size={16} className="text-primary" />
              <span className="font-bold text-text-main">{score ?? 0} pts</span>
              <button
                onClick={updateScore}
                disabled={scoring}
                className="text-text-muted hover:text-primary transition-colors p-0.5 ml-1 cursor-pointer"
                title="Recalculate score"
              >
                <RefreshCw size={13} className={scoring ? "animate-spin" : ""} />
              </button>
            </div>
          </div>
        </div>
      </Card>

      {showBurnConfirm && (
        <ConfirmDialog
          open={showBurnConfirm}
          title="Burn Ghost Identity?"
          message={`This permanently severs all your past activity from your account. Your current civic score (${score ?? 0}) will be locked in. Are you sure?`}
          confirmLabel={burning ? "Burning..." : "Burn Identity"}
          tone="danger"
          onConfirm={burnGhostId}
          onCancel={() => setShowBurnConfirm(false)}
        />
      )}
    </div>
  );
}
