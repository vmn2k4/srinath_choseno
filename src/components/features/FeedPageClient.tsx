"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import {
  MapPin,
  Users,
  Flame,
  Image as ImageIcon,
  Globe2,
  Vote,
  Layers,
  Award,
  RefreshCw,
  Video,
  ShieldAlert,
  X,
} from "lucide-react";
import LinkPreview from "./LinkPreview";
import PostCard, { PostWithComments } from "./PostCard";
import StoryStrip, { StoryPost } from "./StoryStrip";
import PitchViewerModal from "./PitchViewerModal";
import PoliticianSidebar from "./PoliticianSidebar";
import VideoRecorder from "./VideoRecorder";
import MediaThumbnail from "./MediaThumbnail";
import {
  Card,
  Button,
  Badge,
  Textarea,
  Spinner,
  EmptyState,
  StoryViewerModal,
  RemoveMediaButton,
  ConfirmDialog,
  Avatar,
} from "@/components/primitives";
import {
  getOwnProfile,
  getUserBoundaryMemberships,
  calculateMyScore,
  getPoliticianProfileFull,
} from "@/lib/services/profile";
import { getBoundaryTypesForCountries } from "@/lib/services/boundaries";
import {
  getMembershipScopedPosts,
  getCountryScopedPosts,
  getInternationalScopedPosts,
  createFeedPost,
  voteOnPost,
  createComment,
  uploadPostImage,
  getActiveElectionsForUser,
  burnGhostIdentityViaRpc,
  hydratePoliticianAuthors,
} from "@/lib/services/feed";
import { reportContent, type ReportTargetType } from "@/lib/services/moderation";
import { getPlatformRuleSettings } from "@/lib/services/settings";
import { createClient } from "@/lib/supabase/client";
import { trackPostCreated, trackPostEngagement, trackCommentAdded } from "@/lib/analytics/events";

interface MembershipShape {
  id: number;
  name: string;
  country: string;
  boundary_type: string;
  rank?: number;
}

const MAX_IMAGE_SIZE_MB = 5;

function sortByPoliticianEngagement<T extends { likes_count?: number | null; comments?: unknown[] | null }>(
  list: T[]
) {
  return [...list].sort((a, b) => {
    const scoreA = (a.likes_count ?? 0) + (a.comments?.length ?? 0);
    const scoreB = (b.likes_count ?? 0) + (b.comments?.length ?? 0);
    return scoreB - scoreA;
  });
}

function getBoundaryNameFromPost(post: any): string | null {
  const boundaries = post.post_boundaries as any[];
  if (!boundaries || boundaries.length === 0) return null;
  const first = boundaries[0];
  if (first?.map_shapes?.name) return first.map_shapes.name;
  return null;
}

export default function FeedPageClient() {
  const supabase = createClient();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<MembershipShape[]>([]);
  const [loadingMemberships, setLoadingMemberships] = useState(true);
  const [masterFilter, setMasterFilter] = useState<string>("all");
  const [activeElections, setActiveElections] = useState<any[]>([]);

  const [posts, setPosts] = useState<PostWithComments[]>([]);
  const [politicianAuthors, setPoliticianAuthors] = useState<Map<string, { fullName: string; wallHref: string }>>(new Map());
  const [newPostContent, setNewPostContent] = useState("");
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [commentErrors, setCommentErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [burning, setBurning] = useState(false);
  const [showBurnConfirm, setShowBurnConfirm] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [scoring, setScoring] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [extractedUrl, setExtractedUrl] = useState<string | null>(null);
  const [linkMetadata, setLinkMetadata] = useState<any>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [mediaPreview, setMediaPreview] = useState<{ url: string; type: "image" | "video" } | null>(null);

  // Ticking clock for the ephemeral story strip (rule 6) — kept in state
  // and updated on an interval rather than calling Date.now() during render,
  // which would make the component impure (React purity rule).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Admin-configurable (site_settings.story_strip_hours) — how long a video
  // pitch stays in the ephemeral "Politician Pitches" strip.
  const [storyStripHours, setStoryStripHours] = useState(24);
  useEffect(() => {
    getPlatformRuleSettings(supabase).then(({ data }) => {
      if (data?.story_strip_hours) setStoryStripHours(data.story_strip_hours);
    });
  }, [supabase]);

  useEffect(() => {
    let isMounted = true;

    async function initData() {
      if (authLoading) return;
      if (!user) {
        if (isMounted) setLoading(false);
        return;
      }
      setLoading(true);

      const { data: profData } = await getOwnProfile(supabase, user.id);
      const profRecord = profData as any;
      if (isMounted) {
        setProfile(profRecord);
        setScore(profRecord?.cached_total_score ?? 0);
      }

      if (profRecord?.role === "politician") {
        const { data: polData } = await getPoliticianProfileFull(supabase, user.id);
        if (isMounted) setAvatarUrl(polData?.avatar_url || null);
      }

      const { data: freshScore } = await calculateMyScore(supabase);
      if (isMounted && freshScore != null) setScore(freshScore);

      // Memberships
      setLoadingMemberships(true);
      const { data: memData } = await getUserBoundaryMemberships(supabase, user.id);
      const shapes = (memData || []).map((m: any) => m.map_shapes).filter(Boolean);

      if (shapes.length > 0) {
        const countries = [...new Set(shapes.map((s: any) => s.country))];
        const { data: types } = await getBoundaryTypesForCountries(
          supabase,
          countries as string[]
        );

        const rankOf = (countryName: string, typeName: string) =>
          types?.find(
            (t: any) => t.country === countryName && t.type_name === typeName
          )?.rank ?? 999;

        const sorted = shapes
          .map((s: any) => ({ ...s, rank: rankOf(s.country, s.boundary_type) }))
          .sort((a: any, b: any) => a.rank - b.rank);

        if (isMounted) {
          setMemberships(sorted);
        }
      } else {
        if (isMounted) setMemberships([]);
      }
      if (isMounted) setLoadingMemberships(false);

      // Active elections banner
      const { data: elecData } = await getActiveElectionsForUser(supabase);
      if (isMounted && elecData) setActiveElections(elecData as any[]);

      if (isMounted) setLoading(false);
    }

    initData();

    return () => {
      isMounted = false;
    };
  }, [user, authLoading, supabase]);

  const filterPills = useMemo(() => {
    interface FilterPillItem {
      key: string;
      districtName: string;
      divisionType: string;
      filterType: "all" | "shape" | "country" | "international";
      shapeId?: number;
      boundaryType?: string;
    }

    const pills: FilterPillItem[] = [
      {
        key: "all",
        districtName: "All Districts",
        divisionType: "All Levels",
        filterType: "all",
      },
    ];

    const boundaryTypeRank = (type?: string): number => {
      if (!type) return 99;
      const t = type.toLowerCase();
      if (t.includes("federal") || t.includes("congressional") || t.includes("commons")) return 1;
      if (t.includes("provincial") || t.includes("state") || t.includes("territorial")) return 2;
      if (t.includes("municipal") || t.includes("city") || t.includes("county") || t.includes("town")) return 3;
      return 4;
    };

    [...memberships]
      .filter((m) => {
        const bType = (m.boundary_type || "").toLowerCase();
        return !bType.includes("polling");
      })
      .sort((a, b) => boundaryTypeRank(a.boundary_type) - boundaryTypeRank(b.boundary_type))
      .forEach((m) => {
        pills.push({
          key: `shape-${m.id}`,
          districtName: m.name || m.boundary_type,
          divisionType: m.boundary_type,
          filterType: "shape",
          shapeId: m.id,
          boundaryType: m.boundary_type,
        });
      });

    if (profile?.country) {
      pills.push({
        key: "country",
        districtName: profile.country,
        divisionType: "Country",
        filterType: "country",
      });
    }

    pills.push({
      key: "international",
      districtName: "Global",
      divisionType: "International",
      filterType: "international",
    });

    return pills;
  }, [memberships, profile?.country]);

  const loadFeedPosts = async () => {
    if (!user || !profile) return;

    const selectedPill = filterPills.find((p) => p.key === masterFilter) || filterPills[0];
    const queries: Promise<any>[] = [];

    if (selectedPill.key === "all") {
      const matchingMembershipIds = memberships.map((m) => m.id);
      if (matchingMembershipIds.length > 0) {
        queries.push(getMembershipScopedPosts(supabase, matchingMembershipIds));
      }
    } else if (selectedPill.filterType === "shape" && selectedPill.shapeId) {
      queries.push(getMembershipScopedPosts(supabase, [selectedPill.shapeId]));
    } else if (selectedPill.filterType === "country" && profile.country) {
      queries.push(getCountryScopedPosts(supabase, profile.country));
    } else if (selectedPill.filterType === "international") {
      queries.push(getInternationalScopedPosts(supabase));
    }

    const results = await Promise.all(queries);
    const combined: PostWithComments[] = [];
    const seen = new Set<string>();

    results.forEach(({ data }) => {
      (data || []).forEach((post: any) => {
        if (!seen.has(post.id)) {
          seen.add(post.id);
          combined.push(post as PostWithComments);
        }
      });
    });

    combined.sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
    );

    // Politicians want to see the most-engaged posts first.
    const finalPosts = profile.role === "politician" ? sortByPoliticianEngagement(combined) : combined;
    setPosts(finalPosts);
    setPoliticianAuthors(await hydratePoliticianAuthors(supabase, finalPosts));
  };

  useEffect(() => {
    if (profile && profile.role !== "admin") Promise.resolve().then(() => loadFeedPosts());
  }, [masterFilter, memberships, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePostTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setNewPostContent(text);

    const urlRegex = /(https?:\/\/[^\s]+)/;
    const match = text.match(urlRegex);
    if (match && match[1] !== extractedUrl) {
      setExtractedUrl(match[1]);
      setLinkMetadata(null);
    } else if (!match) {
      setExtractedUrl(null);
      setLinkMetadata(null);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      setImageError(`Image must be less than ${MAX_IMAGE_SIZE_MB}MB`);
      return;
    }
    setImageError(null);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim() && !imageFile && !uploadedVideoUrl) return;
    if (!profile?.current_ghost_id) return;

    setSubmitting(true);
    try {
      let finalImageUrl: string | null = null;
      if (imageFile) {
        const { publicUrl, error: uploadError } = await uploadPostImage(
          supabase,
          imageFile,
          profile.current_ghost_id
        );
        if (uploadError) {
          alert("Failed to upload image.");
          setSubmitting(false);
          return;
        }
        finalImageUrl = publicUrl;
      }

      const { error } = await createFeedPost(supabase, {
        content: newPostContent.trim(),
        imageUrl: finalImageUrl,
        videoUrl: uploadedVideoUrl,
        linkMetadata,
      });

      if (error) throw error;

      trackPostCreated({
        hasImage: Boolean(finalImageUrl),
        hasVideo: Boolean(uploadedVideoUrl),
        hasLink: Boolean(linkMetadata),
        contentLength: newPostContent.trim().length,
      });

      setNewPostContent("");
      setExtractedUrl(null);
      setLinkMetadata(null);
      setImageFile(null);
      setImagePreview(null);
      setImageError(null);
      setUploadedVideoUrl(null);
      setShowVideoRecorder(false);
      await loadFeedPosts();
    } catch (err: any) {
      const msg = err?.message || err?.details || err?.hint || (typeof err === "object" ? JSON.stringify(err) : String(err));
      console.error("Error creating post:", msg, err);
      alert("Failed to create post: " + msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (postId: string, voteType: 1 | -1) => {
    if (!user) return;
    const { error } = await voteOnPost(supabase, postId, voteType);
    if (!error) {
      trackPostEngagement(voteType === 1 ? "upvote" : "downvote", postId);
      await loadFeedPosts();
    }
  };

  const handleCreateComment = async (postId: string) => {
    const content = commentInputs[postId];
    if (!content?.trim() || !profile?.current_ghost_id) return;

    setCommentErrors((prev) => ({ ...prev, [postId]: "" }));
    try {
      const { error } = await createComment(supabase, postId, content.trim());
      if (error) throw error;

      trackCommentAdded(postId, content.trim().length);
      setCommentInputs({ ...commentInputs, [postId]: "" });
      await loadFeedPosts();
    } catch (err) {
      const msg = (err as { message?: string })?.message || "Failed to post comment.";
      console.error("Error creating comment:", err);
      setCommentErrors((prev) => ({ ...prev, [postId]: msg }));
    }
  };

  const handleReport = async (targetType: ReportTargetType, targetId: string, abuseType: string) => {
    return reportContent(supabase, targetType, targetId, abuseType);
  };

  const handleRecalculateScore = async () => {
    setScoring(true);
    const { data: fresh } = await calculateMyScore(supabase);
    if (fresh != null) setScore(fresh);
    setScoring(false);
  };

  const handleBurnIdentity = async () => {
    if (!user) return;
    setBurning(true);
    const { error } = await burnGhostIdentityViaRpc(supabase);
    setBurning(false);
    setShowBurnConfirm(false);
    if (!error) {
      const { data: updated } = await getOwnProfile(supabase, user.id);
      if (updated) {
        setProfile(updated);
        await loadFeedPosts();
      }
    }
  };

  if (loading) return <Spinner fullPage />;

  const isAdmin = profile?.role === "admin";
  const isPolitician = profile?.role === "politician";

  // Story strip is ephemeral (like WhatsApp status) — only shows videos from
  // the last 24h. The underlying post stays in the regular feed forever.
  const storyWindowMs = storyStripHours * 60 * 60 * 1000;
  const storyPosts: StoryPost[] = posts
    .filter((p) => Boolean(p.video_url) && now - new Date(p.created_at || 0).getTime() < storyWindowMs)
    .map((p) => ({
      id: p.id,
      video_url: p.video_url!,
      content: p.content,
      ghost_id: p.ghost_id,
    }));

  const masterFilterOptions = [
    "all",
    ...new Set(memberships.map((m) => m.boundary_type)),
    ...(profile?.country ? ["Country"] : []),
    "International",
  ];

  return (
    <>
      <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0 space-y-6">
          {/* Profile Header & Summary */}
          <Card padding="md" className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <Avatar src={avatarUrl} name={profile?.full_name} size="md" />
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-bold text-text-main">
                      {profile?.full_name || "Constituent"}
                    </h1>
                    <Badge tone="primary" className="capitalize">
                      {profile?.role === "normal" ? "Citizen" : profile?.role}
                    </Badge>
                  </div>
                  <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                    <MapPin size={12} className="text-accent" />{" "}
                    {profile?.constituency || profile?.country || "Platform Visitor"}
                  </p>
                </div>
              </div>

              {!isAdmin && (
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-xl text-xs">
                    <Award size={14} className="text-primary" />
                    <span className="text-text-secondary font-medium">
                      Impact Score: <strong className="text-primary">{score ?? 0}</strong>
                    </span>
                    <button
                      onClick={handleRecalculateScore}
                      disabled={scoring}
                      className="text-text-muted hover:text-primary transition-colors p-0.5 ml-1 cursor-pointer"
                      title="Recalculate score"
                    >
                      <RefreshCw size={12} className={scoring ? "animate-spin" : ""} />
                    </button>
                  </div>

                  {!isPolitician && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowBurnConfirm(true)}
                      className="gap-1.5 text-xs text-danger hover:text-danger hover:border-danger/40"
                    >
                      <Flame size={14} /> Burn Identity
                    </Button>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Active Elections Banner - Compact Multi-Pill Bar (up to 5 side-by-side) */}
          {activeElections.length > 0 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-1 flex-wrap">
              {activeElections.map((elec, idx) => {
                const seatId = elec.seat_id || elec.election_seat_id;
                const formattedDate = elec.election_date
                  ? new Date(elec.election_date + "T00:00:00").toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : null;

                return (
                  <div
                    key={seatId || `${elec.election_id}-${idx}`}
                    onClick={() => router.push(`/elections/seat/${seatId}`)}
                    className="group relative flex-1 min-w-[210px] max-w-[270px] p-2.5 px-3 bg-primary/10 hover:bg-primary/20 border border-primary/30 hover:border-primary/50 rounded-2xl flex items-center gap-2.5 text-xs transition-all shadow-sm cursor-pointer hover:shadow-md animate-fade-in"
                    title={`Click to view ${elec.role_title} seat page`}
                  >
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0 group-hover:scale-110 transition-transform">
                      <Vote size={15} />
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      {/* Line 1: Election Name / Boundary */}
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-bold text-text-main truncate text-xs">
                          {elec.election_name}
                        </span>
                        {elec.boundary_name && (
                          <span className="text-[10px] text-accent font-medium truncate shrink-0">
                            📍 {elec.boundary_name}
                          </span>
                        )}
                      </div>
                      {/* Line 2: Position & Date Pill */}
                      <div className="flex items-center gap-1.5 text-[11px] truncate">
                        <span className="text-primary font-semibold truncate">
                          Pos: <strong className="text-text-main font-bold">{elec.role_title}</strong>
                        </span>
                        {formattedDate && (
                          <span className="px-1.5 py-0.2 bg-primary/20 border border-primary/30 rounded-full text-[9px] font-bold text-primary tracking-wide shrink-0">
                            📅 {formattedDate}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {isAdmin ? (
            <Card padding="md" className="flex items-start gap-3 bg-warning/10 border border-warning/30">
              <ShieldAlert className="text-warning shrink-0 mt-0.5" size={20} />
              <div>
                <h3 className="text-warning font-bold mb-1">Admin Account</h3>
                <p className="text-text-secondary text-sm leading-relaxed">
                  You are logged in as an administrator. Your primary role is managing the
                  system boundaries in the Admin panel. You do not belong to a specific
                  constituency feed.
                </p>
              </div>
            </Card>
          ) : (
            <>
              {/* No local groups yet notice */}
              {!loadingMemberships && memberships.length === 0 && (
                <Card padding="md" className="flex items-start gap-3 bg-warning/10 border border-warning/30">
                  <MapPin className="text-warning shrink-0 mt-0.5" size={18} />
                  <div>
                    <h3 className="text-warning font-bold text-sm mb-1">No Local Groups Yet</h3>
                    <p className="text-text-secondary text-xs leading-relaxed">
                      No boundary data covers your location yet, so you don&apos;t have any
                      municipal/federal groups to post into. Go to{" "}
                      <Link href="/profile" className="underline font-bold hover:text-warning">
                        Profile Settings
                      </Link>{" "}
                      to search for and add your jurisdiction manually, or check back once an
                      admin uploads boundary data for your area. You can still post to Country
                      and International.
                    </p>
                  </div>
                </Card>
              )}

              {/* Main Composer */}
              {profile?.current_ghost_id && (
                <Card padding="md">
                  <form onSubmit={handleCreatePost} className="space-y-3">
                    <Textarea
                      placeholder="What's happening in your constituency?"
                      value={newPostContent}
                      onChange={handlePostTextChange}
                      rows={3}
                    />

                    {(imagePreview || uploadedVideoUrl) && (
                      <div className="flex gap-3 items-end flex-wrap">
                        {imagePreview && (
                          <div className="flex gap-2 items-end">
                            <MediaThumbnail
                              url={imagePreview}
                              type="image"
                              alt="Preview"
                              onClick={() => setMediaPreview({ url: imagePreview, type: "image" })}
                            />
                            <RemoveMediaButton
                              onClick={() => {
                                setImageFile(null);
                                setImagePreview(null);
                                setImageError(null);
                              }}
                            />
                          </div>
                        )}

                        {uploadedVideoUrl && (
                          <div className="flex gap-2 items-end">
                            <MediaThumbnail
                              url={uploadedVideoUrl}
                              type="video"
                              onClick={() => setMediaPreview({ url: uploadedVideoUrl, type: "video" })}
                            />
                            <RemoveMediaButton
                              onClick={() => setUploadedVideoUrl(null)}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {imageError && <p className="text-danger-light text-xs">{imageError}</p>}

                    {extractedUrl && (
                      <LinkPreview
                        url={extractedUrl}
                        onMetadataFetched={setLinkMetadata}
                      />
                    )}

                    {isPolitician && showVideoRecorder && !uploadedVideoUrl && (
                      <VideoRecorder
                        onVideoUploaded={(url) => {
                          setUploadedVideoUrl(url);
                          setShowVideoRecorder(false);
                        }}
                      />
                    )}

                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-1">
                        <label className="cursor-pointer text-xs text-text-muted hover:text-text-main flex items-center gap-1 p-1.5 rounded-lg hover:bg-surface/50 transition-colors">
                          <ImageIcon size={16} />
                          <span>Photo</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageSelect}
                          />
                        </label>

                        {isPolitician && (
                          <button
                            type="button"
                            onClick={() => setShowVideoRecorder((v) => !v)}
                            disabled={!!uploadedVideoUrl}
                            className={`text-xs flex items-center gap-1 p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
                              showVideoRecorder
                                ? "text-primary bg-primary/10"
                                : "text-text-muted hover:text-text-main hover:bg-surface/50"
                            }`}
                          >
                            <Video size={16} />
                            <span>Video Pitch</span>
                          </button>
                        )}
                      </div>

                      <Button
                        type="submit"
                        disabled={submitting || (!newPostContent.trim() && !imageFile && !uploadedVideoUrl)}
                      >
                        {submitting ? "Posting..." : "Post to Feed"}
                      </Button>
                    </div>
                  </form>
                </Card>
              )}

              {/* Video Stories Strip */}
              <StoryStrip
                posts={storyPosts}
                onSelect={(postId) => setActiveStoryId(postId)}
              />

              {/* Filter Bar - Two-Line District / Level Pills */}
              <div className="flex items-center gap-2.5 overflow-x-auto text-xs py-3 border-b border-border-light/20 scrollbar-none">
                <span className="text-text-muted text-[11px] font-semibold uppercase tracking-wider shrink-0 mr-0.5">
                  Filter:
                </span>
                {filterPills.map((pill) => {
                  const isActive = masterFilter === pill.key;
                  return (
                    <button
                      key={pill.key}
                      onClick={() => setMasterFilter(pill.key)}
                      className={`px-3.5 py-1.5 rounded-xl text-left transition-all cursor-pointer whitespace-nowrap shrink-0 border ${
                        isActive
                          ? "bg-primary/20 text-primary border-primary/40 shadow-sm"
                          : "bg-surface/40 hover:bg-surface-hover text-text-muted hover:text-text-main border-border-light/30"
                      }`}
                    >
                      <div className="text-[12px] font-bold text-text-main truncate leading-tight">
                        {pill.districtName}
                      </div>
                      <div className="text-[10px] font-semibold text-primary/80 uppercase tracking-wider leading-tight">
                        {pill.divisionType}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Post List Feed */}
              {posts.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No Posts in This Feed"
                  description="Be the first constituent to post a civic update or topic for this area!"
                />
              ) : (
                <div className="space-y-4">
                  {posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      showVoteBar
                      onVote={(postId, voteType) => handleVote(postId, voteType)}
                      canComment={!!user}
                      commentValue={commentInputs[post.id] || ""}
                      onCommentChange={(text) =>
                        setCommentInputs({ ...commentInputs, [post.id]: text })
                      }
                      onSubmitComment={() => handleCreateComment(post.id)}
                      onMediaClick={(url, type) => setMediaPreview({ url, type })}
                      politicianAuthor={politicianAuthors.get(post.ghost_id) ?? null}
                      onReport={handleReport}
                      commentError={commentErrors[post.id]}
                      boundaryName={getBoundaryNameFromPost(post)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Right Sidebar Column — stacks below the feed on mobile/tablet,
            becomes a true sidebar at lg */}
        <div className="w-full lg:w-80 shrink-0">
          <PoliticianSidebar
            profile={profile}
            activeTab={masterFilter}
            selectedPill={filterPills.find((p) => p.key === masterFilter) || filterPills[0]}
            memberships={memberships}
          />
        </div>
      </div>

      {activeStoryId && (
        <PitchViewerModal
          posts={storyPosts}
          startId={activeStoryId}
          onClose={() => setActiveStoryId(null)}
        />
      )}

      {mediaPreview && (
        <StoryViewerModal
          url={mediaPreview.url}
          type={mediaPreview.type}
          onClose={() => setMediaPreview(null)}
        />
      )}

      {/* Burn Identity Confirmation Dialog */}
      {showBurnConfirm && (
        <ConfirmDialog
          open={showBurnConfirm}
          title="Burn Ghost Identity?"
          message="This action will permanently lock in your current Civic Impact Score and generate a brand-new random Ghost ID. All past posts and comments will be permanently unlinked from your future activity. This cannot be undone."
          confirmLabel={burning ? "Burning..." : "Burn Identity"}
          tone="danger"
          onConfirm={handleBurnIdentity}
          onCancel={() => setShowBurnConfirm(false)}
        />
      )}
    </>
  );
}
