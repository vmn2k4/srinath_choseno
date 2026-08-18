"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
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
import { useTranslation } from "@/contexts/LanguageContext";
import PostCard, { PostWithComments } from "./PostCard";
import StoryStrip, { StoryPost } from "./StoryStrip";
import PitchViewerModal from "./PitchViewerModal";
import PoliticianSidebar from "./PoliticianSidebar";
import MediaThumbnail from "./MediaThumbnail";
import MentionTextarea from "./MentionTextarea";
import FeedSortControl from "./FeedSortControl";
import { sortByEngagement, defaultSortMode } from "@/lib/utils/feedSort";
import {
  Card,
  Button,
  Badge,
  Spinner,
  EmptyState,
  StoryViewerModal,
  RemoveMediaButton,
  ConfirmDialog,
  Avatar,
  Alert,
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
  hydratePostMentions,
} from "@/lib/services/feed";
import { reportContent, type ReportTargetType } from "@/lib/services/moderation";
import { getPlatformRuleSettings } from "@/lib/services/settings";
import { getSeatById } from "@/lib/services/elections";
import { buildSeatSlug } from "@/lib/utils/slugs";
import { createClient } from "@/lib/supabase/client";
import { trackPostCreated, trackPostEngagement, trackCommentAdded } from "@/lib/analytics/events";

// Only rendered once a politician opts into recording a video pitch, so it's
// pulled out of this page's initial JS bundle (the feed is the app's
// highest-traffic page) and fetched on demand instead.
const VideoRecorder = dynamic(() => import("./VideoRecorder"), {
  ssr: false,
  loading: () => <Spinner />,
});

interface MembershipShape {
  id: number;
  name: string;
  country: string;
  boundary_type: string;
  rank?: number;
}

const MAX_IMAGE_SIZE_MB = 5;

// sortByEngagement and defaultSortMode are now in @/lib/utils/feedSort
// and shared across FeedPageClient, PoliticianWallClient, and CandidacyWall.

function getBoundaryNameFromPost(post: any): string | null {
  const boundaries = post.post_boundaries as any[];
  if (!boundaries || boundaries.length === 0) return null;
  const first = boundaries[0];
  if (first?.map_shapes?.name) return first.map_shapes.name;
  return null;
}

export default function FeedPageClient() {
  const { t } = useTranslation();
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
  // null until a per-role default is applied once (politicians used to be
  // hard-locked to engagement sort with no way to see recency instead, and
  // vice versa for everyone else) -- after that, purely user-controlled via
  // the dropdown, never auto-overridden again.
  const [sortMode, setSortMode] = useState<"recency" | "engagement" | null>(null);
  const [politicianAuthors, setPoliticianAuthors] = useState<Map<string, { fullName: string; wallHref: string }>>(new Map());
  const [postMentions, setPostMentions] = useState<Map<string, { politicianId: string; fullName: string; wallHref: string }[]>>(new Map());
  const [newPostContent, setNewPostContent] = useState("");
  const [mentionedPoliticianIds, setMentionedPoliticianIds] = useState<string[]>([]);
  const [postError, setPostError] = useState<string | null>(null);
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

  // Composer starts collapsed to a single tap-to-expand row (app-style —
  // Twitter/LinkedIn "start a post" pattern) instead of always showing the
  // full textarea + toolbar, which used to dominate the first screenful on
  // mobile before any actual feed content appeared.
  const [composerOpen, setComposerOpen] = useState(false);

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
        // Anonymous visitors (incl. crawlers, now that /feed is indexable —
        // see robots.ts) have no membership data to scope a feed by, so
        // fall back to the international feed as a public default rather
        // than leaving the page empty.
        const { data } = await getInternationalScopedPosts(supabase);
        const anonPosts = (data || []) as PostWithComments[];
        const authors = await hydratePoliticianAuthors(supabase, anonPosts);
        if (isMounted) {
          setPosts(anonPosts);
          setPoliticianAuthors(authors);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      setLoadingMemberships(true);

      // Four independent reads -- none need each other's result (score and
      // active-elections need nothing at all; memberships only needs
      // user.id) -- so they fire together instead of four sequential round
      // trips before anything below could even start.
      const [{ data: profData }, { data: freshScore }, { data: memData }, { data: elecData }] = await Promise.all([
        getOwnProfile(supabase, user.id),
        calculateMyScore(supabase),
        getUserBoundaryMemberships(supabase, user.id),
        getActiveElectionsForUser(supabase),
      ]);

      const profRecord = profData as any;
      if (isMounted) {
        setProfile(profRecord);
        setScore(profRecord?.cached_total_score ?? 0);
      }
      if (isMounted && freshScore != null) setScore(freshScore);
      if (isMounted && elecData) setActiveElections(elecData as any[]);

      const shapes = (memData || []).map((m: any) => m.map_shapes).filter(Boolean);
      const countries = [...new Set(shapes.map((s: any) => s.country))];

      // These two depend on the batch above (profile.role, shapes) but not
      // on each other, so they also fire together.
      const [{ data: polData }, { data: types }] = await Promise.all([
        profRecord?.role === "politician" ? getPoliticianProfileFull(supabase, user.id) : Promise.resolve({ data: null }),
        shapes.length > 0 ? getBoundaryTypesForCountries(supabase, countries as string[]) : Promise.resolve({ data: [] }),
      ]);
      if (isMounted) setAvatarUrl(polData?.avatar_url || null);

      if (shapes.length > 0) {
        const rankOf = (countryName: string, typeName: string) =>
          (types as any[])?.find(
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

    // Stored recency-sorted always -- engagement ordering is applied as a
    // display-only derivation (see `displayedPosts` below) driven by the
    // user's sortMode choice, not baked in here.
    setPosts(combined);
    setPoliticianAuthors(await hydratePoliticianAuthors(supabase, combined));
    setPostMentions(await hydratePostMentions(supabase, combined));
  };

  useEffect(() => {
    if (profile && profile.role !== "admin") Promise.resolve().then(() => loadFeedPosts());
  }, [masterFilter, memberships, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch when the user lands back on this page via the browser's
  // Back/Forward buttons -- e.g. Feed -> post on My Wall -> Back to Feed.
  // Per Next's own Client Cache docs ("Pages are not cached by default but
  // are reused during browser back/forward navigation"), a popstate return
  // to a route Next has already rendered reuses that in-memory RSC tree
  // instead of re-running the page, bypassing staleTimes entirely -- so the
  // effect above (keyed on masterFilter/memberships/profile, none of which
  // changed) never re-fires and the feed silently shows whatever it had
  // before the user navigated away. This isn't the browser's native
  // page-unload bfcache (no `pageshow`/`event.persisted` fires -- the SPA
  // never unloads), it's Next's own client-side cache, restored on the same
  // native `popstate` event the browser always fires for back/forward, so
  // that's the signal to listen for. `visibilitychange` is a secondary
  // fallback for the "left the tab, came back" case popstate won't catch.
  useEffect(() => {
    if (!profile || profile.role === "admin") return;
    const refetch = () => loadFeedPosts();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refetch();
    };
    window.addEventListener("popstate", refetch);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("popstate", refetch);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayedPosts = useMemo(() => {
    const effectiveSortMode = sortMode ?? defaultSortMode(profile?.role);
    return effectiveSortMode === "engagement" ? sortByEngagement(posts) : posts;
  }, [posts, sortMode, profile?.role]);

  const handlePostTextChange = (text: string) => {
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
    setComposerOpen(true);
  };

  // Only snap the composer back to its compact one-line trigger when there's
  // nothing pending -- an in-progress draft, image, or video stays expanded
  // so a stray tap outside doesn't silently discard it.
  const closeComposerIfEmpty = () => {
    if (!newPostContent.trim() && !imageFile && !uploadedVideoUrl && !showVideoRecorder) {
      setComposerOpen(false);
      setPostError(null);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim() && !imageFile && !uploadedVideoUrl) return;
    if (!profile?.current_ghost_id) return;

    setSubmitting(true);
    setPostError(null);
    try {
      let finalImageUrl: string | null = null;
      if (imageFile) {
        const { publicUrl, error: uploadError } = await uploadPostImage(
          supabase,
          imageFile,
          profile.current_ghost_id
        );
        if (uploadError) {
          setPostError("Failed to upload image.");
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
        mentionedPoliticianIds,
      });

      if (error) throw error;

      trackPostCreated({
        hasImage: Boolean(finalImageUrl),
        hasVideo: Boolean(uploadedVideoUrl),
        hasLink: Boolean(linkMetadata),
        contentLength: newPostContent.trim().length,
      });

      setNewPostContent("");
      setMentionedPoliticianIds([]);
      setExtractedUrl(null);
      setLinkMetadata(null);
      setImageFile(null);
      setImagePreview(null);
      setImageError(null);
      setUploadedVideoUrl(null);
      setShowVideoRecorder(false);
      setComposerOpen(false);
      await loadFeedPosts();
    } catch (err: any) {
      const msg = err?.message || err?.details || err?.hint || (typeof err === "object" ? JSON.stringify(err) : String(err));
      console.error("Error creating post:", msg, err);
      setPostError(msg);
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
          {/* Profile Header & Summary — kept to one compact row through
              tablet widths (Facebook-style mini header); only the true
              desktop two-column layout (lg+) gets the roomier spelled-out
              version. */}
          <Card padding="sm" className="space-y-2 lg:p-6 lg:space-y-4">
            {/* Below lg: identity (avatar/name/badge) and meta (location,
                score, burn) are two stacked rows so the name always gets the
                full row width instead of racing the score/burn chips for
                space. lg:contents unwraps the meta row so, at desktop width,
                its children rejoin the identity row as before (location back
                under the name, actions pinned to the far right). */}
            <div className="flex flex-col gap-1.5 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
              <div className="flex items-center gap-2 lg:gap-3 min-w-0">
                <Avatar
                  src={avatarUrl}
                  name={profile?.full_name}
                  size="md"
                  className="!w-8 !h-8 !text-xs lg:!w-10 lg:!h-10 lg:!text-sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 lg:gap-2 min-w-0">
                    <h1 className="text-sm lg:text-lg font-bold text-text-main truncate">
                      {profile?.full_name || "Constituent"}
                    </h1>
                    <Badge tone="primary" className="capitalize shrink-0">
                      {profile?.role === "normal" ? "Citizen" : profile?.role}
                    </Badge>
                  </div>
                  <p className="hidden lg:flex text-xs text-text-muted items-center gap-1 mt-0.5 truncate">
                    <MapPin size={12} className="text-accent shrink-0" />{" "}
                    <span className="truncate">
                      {profile?.constituency || profile?.country || "Platform Visitor"}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 lg:contents">
                <p className="lg:hidden pl-10 min-w-0 text-[11px] text-text-muted flex items-center gap-1 truncate">
                  <MapPin size={11} className="text-accent shrink-0" />{" "}
                  <span className="truncate">
                    {profile?.constituency || profile?.country || "Platform Visitor"}
                  </span>
                </p>

                {!isAdmin && (
                  <div className="flex items-center gap-1.5 lg:gap-3 shrink-0">
                    <div className="flex items-center gap-1 lg:gap-2 px-2 py-1 lg:px-3 lg:py-1.5 bg-primary/10 border border-primary/30 rounded-lg lg:rounded-xl text-[10px] lg:text-xs">
                      <Award size={12} className="text-primary shrink-0" />
                      <span className="text-text-secondary font-medium whitespace-nowrap">
                        <span className="hidden lg:inline">Impact Score: </span>
                        <strong className="text-primary">{score ?? 0}</strong>
                      </span>
                      <button
                        onClick={handleRecalculateScore}
                        disabled={scoring}
                        className="text-text-muted hover:text-primary transition-colors p-0.5 lg:ml-1 cursor-pointer"
                        title="Recalculate score"
                      >
                        <RefreshCw size={11} className={scoring ? "animate-spin" : ""} />
                      </button>
                    </div>

                    {!isPolitician && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowBurnConfirm(true)}
                        className="gap-1.5 text-xs text-danger hover:text-danger hover:border-danger/40 !px-2 !py-1 lg:!px-3 lg:!py-1.5"
                        title="Burn Identity"
                      >
                        <Flame size={13} /> <span className="hidden lg:inline">Burn Identity</span>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Active Elections Banner - below lg this is a single-line,
              horizontally-scrolling pill strip (no wrap → no stacked full-
              width rows eating the screen); lg+ reverts to the original
              two-line, wrapping card grid. */}
          {activeElections.length > 0 && (
            <div className="flex items-center gap-2 lg:gap-3 overflow-x-auto pb-1 lg:flex-wrap">
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
                    onClick={async () => {
                      if (!seatId) return;
                      const { data: seat } = await getSeatById(supabase, seatId);
                      router.push(`/elections/seat/${buildSeatSlug(seat || { id: seatId })}`);
                    }}
                    className="group relative shrink-0 lg:flex-1 lg:min-w-[210px] lg:max-w-[270px] flex items-center gap-2 lg:gap-2.5 px-2.5 py-1.5 lg:p-2.5 lg:px-3 bg-primary/10 hover:bg-primary/20 border border-primary/30 hover:border-primary/50 rounded-full lg:rounded-2xl text-[11px] lg:text-xs transition-all shadow-sm cursor-pointer hover:shadow-md animate-fade-in"
                    title={`Click to view ${elec.role_title} seat page`}
                  >
                    <div className="w-5 h-5 lg:w-7 lg:h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0 group-hover:scale-110 transition-transform">
                      <Vote size={11} className="lg:hidden" />
                      <Vote size={15} className="hidden lg:block" />
                    </div>

                    {/* Mobile/tablet: one line, role + date only. */}
                    <div className="flex lg:hidden items-center gap-1 min-w-0 whitespace-nowrap">
                      <span className="font-bold text-text-main truncate max-w-[110px]">
                        {elec.role_title}
                      </span>
                      {formattedDate && (
                        <span className="text-primary font-semibold shrink-0">· {formattedDate}</span>
                      )}
                    </div>

                    {/* Desktop: full two-line detail as before. */}
                    <div className="hidden lg:block min-w-0 flex-1 space-y-0.5">
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

              {/* Main Composer — collapses to a single tap-to-expand row
                  (Twitter/LinkedIn "start a post" pattern) so it doesn't
                  dominate the first screenful on mobile before any feed
                  content is visible. Expands automatically once there's a
                  draft, image, or video pending. */}
              {profile?.current_ghost_id && (
                <Card padding={composerOpen ? "md" : "sm"}>
                  {!composerOpen ? (
                    <button
                      type="button"
                      onClick={() => setComposerOpen(true)}
                      className="w-full flex items-center gap-2.5 text-left cursor-pointer"
                    >
                      <Avatar src={avatarUrl} name={profile?.full_name} size="sm" />
                      <span className="flex-1 min-w-0 text-sm text-text-muted bg-surface/50 border border-border-light/30 rounded-full px-4 py-2 truncate">
                        {t("feed.createPostPlaceholder")}
                      </span>
                      <span className="shrink-0 flex items-center gap-1 text-text-muted">
                        <ImageIcon size={18} aria-hidden="true" />
                        {isPolitician && <Video size={18} aria-hidden="true" />}
                      </span>
                    </button>
                  ) : (
                    <form onSubmit={handleCreatePost} className="space-y-3">
                      <MentionTextarea
                        supabase={supabase}
                        placeholder="What's happening in your constituency? Type @ to tag a politician"
                        value={newPostContent}
                        onChange={handlePostTextChange}
                        onMentionsChange={setMentionedPoliticianIds}
                        viewerShapeIds={memberships.map((m) => m.id)}
                        viewerCountry={profile?.country}
                        rows={3}
                        autoFocus
                      />

                    {postError && <Alert tone="danger">{postError}</Alert>}

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

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={closeComposerIfEmpty}
                          className="text-xs font-semibold text-text-muted hover:text-text-main px-2 py-1.5 rounded-lg hover:bg-surface/50 transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <Button
                          type="submit"
                          disabled={submitting || (!newPostContent.trim() && !imageFile && !uploadedVideoUrl)}
                        >
                          {submitting ? t("feed.posting") : t("feed.postBtn")}
                        </Button>
                      </div>
                    </div>
                  </form>
                  )}
                </Card>
              )}

              {/* Video Stories Strip — renders nothing when empty (see
                  StoryStrip), so it never occupies space just to announce
                  its own emptiness. */}
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
                      type="button"
                      onClick={() => setMasterFilter(pill.key)}
                      className={`flex flex-col text-left px-3 py-2 rounded-xl transition-all border shrink-0 min-w-[130px] cursor-pointer ${
                        isActive
                          ? "bg-primary/10 border-primary text-text-main font-bold shadow-sm"
                          : "bg-surface/60 border-border-light/40 text-text-muted hover:bg-surface-hover hover:border-border-light hover:text-text-main"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <MapPin size={12} className={isActive ? "text-primary shrink-0" : "text-text-muted shrink-0"} />
                        <span className="truncate text-xs">{pill.districtName}</span>
                      </div>
                      <div className="text-[10px] font-semibold text-primary/80 uppercase tracking-wider leading-tight">
                        {pill.divisionType}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* User-controlled sort (used to be hard-locked: politicians
                  always got engagement order, everyone else always got
                  recency, with no visual cue either way -- a genuinely new,
                  unengaged post could silently rank below a week-old
                  high-engagement one and read as a bug). Defaults to each
                  role's old behavior, but is freely switchable now. */}
              {displayedPosts.length > 0 && (
                <FeedSortControl
                  sortMode={sortMode ?? defaultSortMode(profile?.role)}
                  onSortChange={setSortMode}
                />
              )}

              {/* Post List Feed */}
              {displayedPosts.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title={t("feed.emptyTitle")}
                  description={t("feed.emptyDesc")}
                />
              ) : (
                <div className="space-y-4">
                  {displayedPosts.map((post) => (
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
                      mentions={postMentions.get(post.id)}
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
