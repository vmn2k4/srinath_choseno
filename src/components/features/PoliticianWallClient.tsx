"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "@/contexts/AuthContext";
import LinkPreview from "./LinkPreview";
import PostCard, { type PostWithComments } from "@/components/features/PostCard";
import PitchPostPlayer from "@/components/features/PitchPostPlayer";
import MentionTextarea from "./MentionTextarea";
import FeedSortControl from "./FeedSortControl";
// Only needed once a "Play Interview" chip is tapped, so loaded on demand.
const PlayInterviewReel = dynamic(() => import("./PlayInterviewReel"), { ssr: false });
import { sortByEngagement, defaultSortMode } from "@/lib/utils/feedSort";
import {
  Users,
  Heart,
  QrCode,
  Image as ImageIcon,
  X,
  Video,
  Flag,
  Mail,
  Phone,
  Globe,
  ShieldCheck,
  CheckCircle2,
  Star,
} from "lucide-react";
import { getOwnProfile, getUserBoundaryShapeIds } from "@/lib/services/profile";
import {
  getWallOwnerProfile,
  getSupportStatus,
  getSupporterCount,
  withdrawSupport,
  addSupport,
  getSupportersList,
  getWallPosts,
  getMentionedWallPosts,
  createWallPost,
  subscribeToSupportChanges,
  unsubscribeFromSupportChanges,
  getActiveCandidacies,
  WALL_PAGE_SIZE,
} from "@/lib/services/politicianWall";
import { uploadPostImage, createComment, hydratePoliticianAuthors, hydratePostMentions, voteOnPost } from "@/lib/services/feed";
import { reportContent, type ReportTargetType } from "@/lib/services/moderation";
import { getPoliticianEngagementSummaries } from "@/lib/services/ratings";
import { getWallClaimEligibility, requestCandidacyClaim, requestOfficeholderWallClaim } from "@/lib/services/elections";
import PoliticianRatingModal from "./PoliticianRatingModal";
import PoliticianInlineRating from "./PoliticianInlineRating";
import {
  Card,
  Button,
  Badge,
  Input,
  Textarea,
  Alert,
  Spinner,
  Modal,
  StoryViewerModal,
  RemoveMediaButton,
  Avatar,
  EmptyState,
  StarRating,
} from "@/components/primitives";

// Both only render behind a rare user action (opening the QR modal /
// recording a video pitch), so they're pulled out of this page's initial
// JS bundle and fetched on demand instead of loading for every wall visit.
const QRCodeSVG = dynamic(() => import("qrcode.react").then((mod) => mod.QRCodeSVG), {
  ssr: false,
  loading: () => <Spinner />,
});
const VideoRecorder = dynamic(() => import("./VideoRecorder"), {
  ssr: false,
  loading: () => <Spinner />,
});
import ReportDialog from "./ReportDialog";
import { createClient } from "@/lib/supabase/client";
import { trackPostCreated, trackPostEngagement, trackCommentAdded, trackPoliticianViewed } from "@/lib/analytics/events";
import { buildPoliticianWallSlug, buildSeatSlug } from "@/lib/utils/slugs";
import { mergeWallPosts } from "@/lib/utils/mergeWallPosts";

interface WallOwnerRecord {
  id: string;
  full_name: string;
  current_ghost_id?: string | null;
  politician_profiles?: {
    wall_slug?: string | null;
    political_target_role?: string;
    target_boundary_name?: string;
    bio?: string;
    avatar_url?: string;
    contact_email?: string | null;
    contact_phone?: string | null;
    photo_url?: string | null;
    source_url?: string | null;
    holding_since?: string | null;
    // Set client-side in enrichProfileWithContactFallback (politicianWall.ts)
    // when this wall matches an office_holders record. Purely a display flag
    // (badge text/contact fallback) — claim eligibility is a separate check,
    // see claimEligibility/get_wall_claim_eligibility() below.
    is_office_holder?: boolean;
    // Set alongside is_office_holder when the only office_holders match(es)
    // are retired (is_current = false) — e.g. lost re-election. Takes
    // priority over the raw holding_since fallback below so a retired
    // officeholder's stale holding_since (set back when they were claimed)
    // doesn't make the badge read as still-current.
    is_former_office_holder?: boolean;
    term_ended_at?: string | null;
    // Every current office this profile is linked_profile_id-linked to (see
    // enrichProfileWithContactFallback in politicianWall.ts) -- a person can
    // hold more than one at once (e.g. a Premier who's also their home
    // riding's sitting MLA). Renders as one badge per position; falls back
    // to the single political_target_role badge below when empty (a
    // declared candidate with no office_holders link yet, for instance).
    positions?: { roleTitle: string; jurisdictionName: string | null; boundaryType?: string | null }[];
  } | null;
}

interface SupporterRecord {
  id: string;
  created_at: string;
  profiles?: {
    full_name?: string;
  };
}

interface PoliticianWallClientProps {
  ghostId: string;
  // Seeded from the server (page.tsx) — same pattern as CandidacyWall /
  // ElectionSeatPageClient, so the initial server HTML already has the
  // wall owner's real info and posts instead of a loading spinner.
  initialWallOwner?: WallOwnerRecord | null;
  initialPosts?: PostWithComments[];
  initialSupportCount?: number;
  /**
   * Optional discovery-rail content (Related People, Races Happening, etc.)
   * rendered beside the post feed specifically -- not beside the profile
   * header/rating bar/composer above it. Passed in as a prop (rather than
   * page.tsx wrapping this whole component in a grid) so it can start at
   * the feed's actual position without needing to split this component's
   * shared state across two separately-rendered pieces. Server-rendered
   * content (page.tsx builds it, this component only places it).
   */
  sidebar?: React.ReactNode;
}

export default function PoliticianWallClient({
  ghostId,
  initialWallOwner = null,
  initialPosts = [],
  initialSupportCount = 0,
  sidebar,
}: PoliticianWallClientProps) {
  const supabase = createClient();
  const { user } = useAuth();
  const router = useRouter();

  const trackedGhostViewRef = React.useRef<string | null>(null);
  const [wallOwner, setWallOwner] = useState<WallOwnerRecord | null>(initialWallOwner);
  const [profile, setProfile] = useState<{ id: string; current_ghost_id: string; country?: string | null } | null>(null);
  const [viewerShapeIds, setViewerShapeIds] = useState<number[]>([]);
  const [posts, setPosts] = useState<PostWithComments[]>(initialPosts);
  // Infinite scroll -- raw accumulators for BOTH sources that feed into
  // `posts` (authored/wall posts + posts where the owner was only
  // @mentioned), kept separately from the deduped/sorted `posts` state
  // itself. Every load (initial or "load more") re-runs mergeWallPosts
  // against the FULL accumulated sets rather than trying to merge just the
  // newest batch in -- the two sources interleave by date, so there's no
  // way to know where "page 2" starts in the already-merged display list
  // without redoing the merge from the raw sources each time. Feed sizes
  // here are moderate (nowhere near the news feed's volume), so redoing
  // the sort/dedup on every page is cheap.
  const [rawAuthoredPosts, setRawAuthoredPosts] = useState<PostWithComments[]>(initialPosts);
  const [rawMentionedPosts, setRawMentionedPosts] = useState<PostWithComments[]>([]);
  const [feedOffset, setFeedOffset] = useState(0);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const loadingMorePostsRef = useRef(false);
  const feedSentinelRef = useRef<HTMLDivElement | null>(null);
  const [sortMode, setSortMode] = useState<"recency" | "engagement" | null>(null);
  const [loading, setLoading] = useState(!initialWallOwner);
  const [newPostContent, setNewPostContent] = useState("");
  const [mentionedPoliticianIds, setMentionedPoliticianIds] = useState<string[]>([]);
  const [postError, setPostError] = useState<string | null>(null);
  const [extractedUrl, setExtractedUrl] = useState<string | null>(null);
  const [linkMetadata, setLinkMetadata] = useState<{ url: string; title?: string; description?: string; image?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [supportCount, setSupportCount] = useState(initialSupportCount);
  const [isSupporting, setIsSupporting] = useState(false);
  const [showSupporters, setShowSupporters] = useState(false);
  const [supportersList, setSupportersList] = useState<SupporterRecord[]>([]);

  const [ratingSummary, setRatingSummary] = useState<{ avg: number; count: number }>({ avg: 0, count: 0 });
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  // Inline "leave a review" panel — expands under the header in place of
  // opening the modal, so rating this wall's owner never navigates away.
  const [showInlineRating, setShowInlineRating] = useState(false);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showRecorder, setShowRecorder] = useState(false);
  // Same tap-to-expand pattern as the main Feed composer -- starts collapsed
  // to a single row instead of always showing the full textarea + toolbar.
  const [composerOpen, setComposerOpen] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [commentErrors, setCommentErrors] = useState<Record<string, string>>({});
  const [showReportProfile, setShowReportProfile] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<{ url: string; type: "image" | "video" } | null>(null);
  const [pitchPostToPlay, setPitchPostToPlay] = useState<PostWithComments | null>(null);

  // A pitch's Share button links to ?pitch=<postId> on this same page (see
  // PitchPostPlayer) -- once posts are loaded, reopen that exact clip
  // instead of leaving a visitor who followed the link staring at the top
  // of the whole wall with no idea which post it was about.
  const handledPitchDeepLinkRef = useRef(false);
  useEffect(() => {
    if (handledPitchDeepLinkRef.current || posts.length === 0) return;
    if (typeof window === "undefined") return;
    const pitchId = new URLSearchParams(window.location.search).get("pitch");
    if (!pitchId) return;
    const match = posts.find((p) => p.id === pitchId);
    if (match) {
      handledPitchDeepLinkRef.current = true;
      setPitchPostToPlay(match);
    }
  }, [posts]);

  const [politicianAuthors, setPoliticianAuthors] = useState<Map<string, { fullName: string; wallHref: string }>>(new Map());
  const [postMentions, setPostMentions] = useState<Map<string, { politicianId: string; fullName: string; wallHref: string }[]>>(new Map());
  const [mentionOnlyPostIds, setMentionOnlyPostIds] = useState<Set<string>>(new Set());
  const [candidacies, setCandidacies] = useState<any[]>([]);
  const [showInterviewCandidateId, setShowInterviewCandidateId] = useState<string | null>(null);

  // Unified claim eligibility — see get_wall_claim_eligibility() (migration
  // 20260811170000). Derived from public data (no auth.users lookup needed):
  // an unclaimed election_candidates stub, an unclaimed office_holders wall,
  // or 'not_claimable' if the wall already has a real owner or an open
  // claim. Replaces the old is_office_holder-only binary, which never
  // accounted for a wall already belonging to a real, signed-up person.
  type ClaimEligibility =
    | { kind: "unclaimed_candidate"; candidate_id: string }
    | { kind: "unclaimed_officeholder"; office_holder_id: string }
    | { kind: "not_claimable" }
    | null;
  const [claimEligibility, setClaimEligibility] = useState<ClaimEligibility>(null);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimEmail, setClaimEmail] = useState("");
  const [claimPhone, setClaimPhone] = useState("");
  const [claimMotivation, setClaimMotivation] = useState("");
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [claimError, setClaimError] = useState("");

  const displayedPosts = useMemo(() => {
    // Interview-answer posts show here like any other wall post --
    // docs/VIRTUAL_INTERVIEW_SYSTEM.md: a video answer "gets the *standard*
    // treatment every other post already has... no bespoke comment/like
    // system for interview answers." Filtering them out (an earlier pass
    // here) meant a candidate's own video answers were missing from their
    // own posting history, which the doc doesn't call for -- the "Play
    // Interview" chip below is an additional way to watch them all in
    // sequence, not a replacement for them showing individually.
    const effectiveSortMode = sortMode ?? defaultSortMode(profile?.id ? "politician" : null);
    return effectiveSortMode === "engagement" ? sortByEngagement(posts) : posts;
  }, [posts, sortMode, profile?.id]);

  // Which candidacies (this wall owner can be actively running for more than
  // one seat at once) have at least one recorded video answer, and how many
  // -- powers the small "Play Interview" affordance on each matching
  // "Currently Running For" chip below.
  const interviewCounts = useMemo(() => {
    const counts = new Map<string, number>();
    posts.forEach((p) => {
      if (p.post_kind === "answer_pitch" && p.election_candidate_id) {
        counts.set(p.election_candidate_id, (counts.get(p.election_candidate_id) || 0) + 1);
      }
    });
    return counts;
  }, [posts]);

  useEffect(() => {
    let cancelled = false;
    async function loadEligibility() {
      if (!wallOwner?.id) {
        if (!cancelled) setClaimEligibility(null);
        return;
      }
      const { data, error } = await getWallClaimEligibility(supabase, wallOwner.id);
      if (cancelled) return;
      setClaimEligibility(error || !data ? { kind: "not_claimable" } : (data as ClaimEligibility));
    }
    loadEligibility();
    return () => {
      cancelled = true;
    };
  }, [supabase, wallOwner?.id]);

  // Campaign outreach wall view & duration tracking
  useEffect(() => {
    if (typeof window === "undefined") return;
    const trackingToken = new URLSearchParams(window.location.search).get("t");
    if (!trackingToken) return;

    const startTime = Date.now();
    const trackingBaseUrl =
      process.env.NEXT_PUBLIC_TRACKING_BASE_URL ||
      `${process.env.NEXT_PUBLIC_SUPABASE_URL || "https://qlzyfdwrkcxyqapewxwg.supabase.co"}/functions/v1`;

    const sendDurationBeacon = () => {
      const durationSeconds = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
      const payload = JSON.stringify({
        token: trackingToken,
        wall_slug: ghostId,
        duration_seconds: durationSeconds,
      });

      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon(`${trackingBaseUrl}/track-wall-view`, blob);
      } else {
        fetch(`${trackingBaseUrl}/track-wall-view`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    };

    window.addEventListener("beforeunload", sendDurationBeacon);
    return () => {
      window.removeEventListener("beforeunload", sendDurationBeacon);
      sendDurationBeacon();
    };
  }, [ghostId]);

  const openClaimModal = () => {
    if (!user) {
      router.push(`/auth?role=politician&next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setClaimEmail(user.email || "");
    setShowClaimModal(true);
  };

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimEmail.trim() || !claimEligibility || claimEligibility.kind === "not_claimable") return;
    setSubmittingClaim(true);
    setClaimError("");

    try {
      if (claimEligibility.kind === "unclaimed_candidate") {
        const { error } = await requestCandidacyClaim(supabase, claimEligibility.candidate_id, {
          motivation: claimMotivation.trim(),
          contactEmail: claimEmail.trim(),
          socialMediaInfo: claimPhone.trim() || null,
        });
        if (error) {
          setClaimError(error.message || "Failed to submit request.");
          setSubmittingClaim(false);
          return;
        }
      } else {
        const { error } = await requestOfficeholderWallClaim(
          supabase,
          claimEligibility.office_holder_id,
          claimEmail.trim(),
          [claimPhone.trim() && `Phone/social: ${claimPhone.trim()}`, claimMotivation.trim()].filter(Boolean).join("\n") || null,
        );
        if (error) {
          setClaimError(error.message || "Failed to submit request.");
          setSubmittingClaim(false);
          return;
        }
      }

      // Best-effort admin notification email — the claim request itself is
      // already recorded and reviewable regardless of whether this succeeds.
      await supabase.functions.invoke("send-email", {
        body: {
          to: "info@choseno.com",
          subject: `Wall Claim Request: ${wallOwner?.full_name || "Politician"}`,
          html: `<h2>Wall Claim Request</h2>
            <p><strong>Wall:</strong> ${wallOwner?.full_name || "Representative"}</p>
            <p><strong>Wall URL:</strong> ${typeof window !== "undefined" ? window.location.href : ""}</p>
            <p><strong>Contact Email:</strong> ${claimEmail.trim()}</p>
            <p><strong>Phone / Social Link:</strong> ${claimPhone.trim() || "N/A"}</p>
            <p><strong>Notes:</strong> ${claimMotivation.trim() || "N/A"}</p>`,
          replyTo: claimEmail.trim(),
        },
      }).catch(() => null);

      setClaimSuccess(true);
      setClaimEligibility({ kind: "not_claimable" });
    } catch (err) {
      console.error("Error submitting claim request:", err);
      setClaimError("Failed to submit request. Please try again or email info@choseno.com.");
    } finally {
      setSubmittingClaim(false);
    }
  };

  // Manual refresh (after posting/voting/etc.) -- always resets back to
  // page 1 rather than trying to preserve infinite-scroll position, since
  // a fresh post at the top shifts everything else's offset anyway.
  const fetchPosts = async () => {
    try {
      const { data, error } = await getWallPosts(supabase, ghostId);
      if (error) throw error;
      const authored = (data as PostWithComments[]) || [];

      let mentioned: PostWithComments[] = [];
      if (wallOwner?.id) {
        const { data: mentionedData } = await getMentionedWallPosts(supabase, wallOwner.id);
        mentioned = (mentionedData as PostWithComments[]) || [];
      }
      setRawAuthoredPosts(authored);
      setRawMentionedPosts(mentioned);
      setFeedOffset(authored.length);
      setHasMorePosts(authored.length === WALL_PAGE_SIZE || mentioned.length === WALL_PAGE_SIZE);

      const { merged, mentionOnlyIds } = mergeWallPosts(authored, mentioned);
      setPosts(merged);
      setMentionOnlyPostIds(mentionOnlyIds);
      setPostMentions(await hydratePostMentions(supabase, merged));

      const map = await hydratePoliticianAuthors(supabase, merged);
      if (ghostId && wallOwner?.full_name) {
        map.set(ghostId, { fullName: wallOwner.full_name, wallHref: `/wall/${wallOwner.politician_profiles?.wall_slug || buildPoliticianWallSlug(wallOwner.full_name, wallOwner.politician_profiles?.political_target_role)}` });
      }
      setPoliticianAuthors(map);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Infinite scroll -- fetches the next page from BOTH sources (using
  // feedOffset for each, since page N of "authored" and page N of
  // "mentioned" are independent lists that only get interleaved by
  // mergeWallPosts, not two halves of one combined offset) and re-merges
  // against the full accumulated raw sets. hasMorePosts stays true as long
  // as EITHER source's last page came back full -- the other might still
  // have more even if one is already exhausted.
  const loadMorePosts = useCallback(async () => {
    if (loadingMorePostsRef.current || !hasMorePosts) return;
    loadingMorePostsRef.current = true;
    setLoadingMorePosts(true);

    try {
      const [{ data: moreAuthoredData, error: authoredErr }, mentionedRes] = await Promise.all([
        getWallPosts(supabase, ghostId, { offset: feedOffset, limit: WALL_PAGE_SIZE }),
        wallOwner?.id
          ? getMentionedWallPosts(supabase, wallOwner.id, { offset: feedOffset, limit: WALL_PAGE_SIZE })
          : Promise.resolve({ data: [] as PostWithComments[] }),
      ]);
      if (authoredErr) throw authoredErr;

      const moreAuthored = (moreAuthoredData as PostWithComments[]) || [];
      const moreMentioned = (mentionedRes.data as PostWithComments[]) || [];

      const nextAuthored = [...rawAuthoredPosts, ...moreAuthored];
      const nextMentioned = [...rawMentionedPosts, ...moreMentioned];
      setRawAuthoredPosts(nextAuthored);
      setRawMentionedPosts(nextMentioned);
      setFeedOffset((prev) => prev + WALL_PAGE_SIZE);
      setHasMorePosts(moreAuthored.length === WALL_PAGE_SIZE || moreMentioned.length === WALL_PAGE_SIZE);

      const { merged, mentionOnlyIds } = mergeWallPosts(nextAuthored, nextMentioned);
      setPosts(merged);
      setMentionOnlyPostIds(mentionOnlyIds);

      const [mentionsMap, authorsMap] = await Promise.all([
        hydratePostMentions(supabase, merged),
        hydratePoliticianAuthors(supabase, merged),
      ]);
      setPostMentions(mentionsMap);
      if (ghostId && wallOwner?.full_name) {
        authorsMap.set(ghostId, {
          fullName: wallOwner.full_name,
          wallHref: `/wall/${wallOwner.politician_profiles?.wall_slug || buildPoliticianWallSlug(wallOwner.full_name, wallOwner.politician_profiles?.political_target_role)}`,
        });
      }
      setPoliticianAuthors(authorsMap);
    } catch (err) {
      console.error("Failed to load more wall posts:", err);
      // Leave hasMorePosts as-is so the sentinel can retry on next
      // intersection rather than permanently declaring the feed exhausted
      // over a transient network error.
    } finally {
      setLoadingMorePosts(false);
      loadingMorePostsRef.current = false;
    }
  }, [supabase, ghostId, wallOwner?.id, wallOwner?.full_name, wallOwner?.politician_profiles, feedOffset, hasMorePosts, rawAuthoredPosts, rawMentionedPosts]);

  // Same IntersectionObserver pattern as NewsInfiniteFeed -- 600px
  // rootMargin so the next page starts loading well before the sentinel
  // is actually on screen, not once the visitor hits a dead-stop at the
  // bottom.
  useEffect(() => {
    if (!hasMorePosts) return;
    const el = feedSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMorePosts();
      },
      { rootMargin: "600px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMorePosts, loadMorePosts]);

  useEffect(() => {
    let supportChannel: ReturnType<typeof subscribeToSupportChanges> | null = null;
    let isMounted = true;

    async function loadWall() {
      if (!ghostId) return;
      if (!wallOwner) setLoading(true);

      // Three independent reads -- the signed-in viewer's own profile, the
      // wall owner's profile, and the wall's posts -- none need each
      // other's result, so they go out together instead of one at a time.
      // (getOwnProfile -> getUserBoundaryShapeIds is its own short chain,
      // wrapped in one promise so it still joins this same batch.)
      const profilePromise = user
        ? getOwnProfile(supabase, user.id).then(async ({ data: myProfile }) => {
            const myProfileTyped = myProfile as { id: string; current_ghost_id: string; country?: string | null } | null;
            if (isMounted) setProfile(myProfileTyped);
            if (myProfileTyped?.id) {
              const { data: shapeRows } = await getUserBoundaryShapeIds(supabase, myProfileTyped.id);
              if (isMounted) setViewerShapeIds((shapeRows || []).map((r) => r.map_shape_id));
            }
          })
        : Promise.resolve();

      const [, { data: owner }, { data: postRows, error: postErr }] = await Promise.all([
        profilePromise,
        getWallOwnerProfile(supabase, ghostId),
        getWallPosts(supabase, ghostId),
      ]);
      const ownerRecord = owner as WallOwnerRecord | null;

      let mentioned: PostWithComments[] = [];

      if (ownerRecord) {
        if (isMounted) {
          setWallOwner((prev) => {
            if (!prev) return ownerRecord;
            const prevPP = prev.politician_profiles;
            const newPP = ownerRecord.politician_profiles;
            return {
              ...ownerRecord,
              politician_profiles: {
                ...newPP,
                contact_email: newPP?.contact_email || prevPP?.contact_email || null,
                contact_phone: newPP?.contact_phone || prevPP?.contact_phone || null,
                source_url: newPP?.source_url || prevPP?.source_url || null,
                photo_url: newPP?.photo_url || prevPP?.photo_url || null,
                holding_since: newPP?.holding_since || prevPP?.holding_since || null,
              },
            };
          });
        }
        if (trackedGhostViewRef.current !== ghostId) {
          trackedGhostViewRef.current = ghostId;
          trackPoliticianViewed({ ghostId, source: "wall" });
        }
        if (ownerRecord.id) {
          // These five all depend only on ownerRecord.id, not on each
          // other (mentioned-posts included -- it only needs the owner's
          // id, not the authored posts fetched above), so they fire as one
          // batch instead of five sequential round trips.
          const [supportResult, supporterCountResult, candsResult, summariesResult, mentionedResult] = await Promise.all([
            user ? getSupportStatus(supabase, ownerRecord.id, user.id) : Promise.resolve({ data: null }),
            getSupporterCount(supabase, ownerRecord.id),
            getActiveCandidacies(supabase, ownerRecord.id),
            getPoliticianEngagementSummaries(supabase, [ownerRecord.id]),
            getMentionedWallPosts(supabase, ownerRecord.id),
          ]);

          if (user && isMounted) setIsSupporting(!!supportResult.data);
          if (isMounted) setSupportCount(supporterCountResult.count || 0);
          if (isMounted) setCandidacies((candsResult.data || []) as any[]);
          const summary = (summariesResult.data || [])[0] as { avg_rating: number; rating_count: number } | undefined;
          if (isMounted) setRatingSummary({ avg: summary?.avg_rating || 0, count: summary?.rating_count || 0 });
          mentioned = (mentionedResult.data as PostWithComments[]) || [];

          supportChannel = subscribeToSupportChanges(supabase, ownerRecord.id, () => {
            getSupporterCount(supabase, ownerRecord.id).then(({ count }) => {
              if (isMounted) setSupportCount(count || 0);
            });
          });
        }
      } else if (isMounted) {
        // Owner came back hidden (e.g. is_test filtering) on a re-fetch after
        // initialWallOwner was already set from SSR -- clear the stale data
        // instead of leaving the previous (now-hidden) owner on screen.
        setWallOwner(null);
      }

      if (!postErr && isMounted) {
        const authored = (postRows as PostWithComments[]) || [];
        setRawAuthoredPosts(authored);
        setRawMentionedPosts(mentioned);
        setFeedOffset(authored.length);
        setHasMorePosts(authored.length === WALL_PAGE_SIZE || mentioned.length === WALL_PAGE_SIZE);

        const { merged, mentionOnlyIds } = mergeWallPosts(authored, mentioned);
        if (!isMounted) return;
        setPosts(merged);
        setMentionOnlyPostIds(mentionOnlyIds);

        // Independent of each other -- both just derive from `merged`.
        const [mentionsMap, authorsMap] = await Promise.all([
          hydratePostMentions(supabase, merged),
          hydratePoliticianAuthors(supabase, merged),
        ]);
        if (!isMounted) return;
        setPostMentions(mentionsMap);
        if (ghostId && ownerRecord?.full_name) {
          authorsMap.set(ghostId, { fullName: ownerRecord.full_name, wallHref: `/wall/${ownerRecord.politician_profiles?.wall_slug || buildPoliticianWallSlug(ownerRecord.full_name, ownerRecord.politician_profiles?.political_target_role)}` });
        }
        setPoliticianAuthors(authorsMap);
      }
      if (isMounted) setLoading(false);
    }

    loadWall();

    return () => {
      isMounted = false;
      if (supportChannel) unsubscribeFromSupportChanges(supabase, supportChannel);
    };
  }, [user, ghostId, supabase]);

  const toggleSupport = async () => {
    if (!wallOwner || !user) {
      router.push("/auth");
      return;
    }

    if (isSupporting) {
      setIsSupporting(false);
      setSupportCount((prev) => Math.max(0, prev - 1));
      await withdrawSupport(supabase, wallOwner.id, user.id);
    } else {
      setIsSupporting(true);
      setSupportCount((prev) => prev + 1);
      await addSupport(supabase, wallOwner.id, user.id);
    }
  };

  const loadSupportersDashboard = async () => {
    if (!wallOwner) return;
    setShowSupporters(true);
    const { data } = await getSupportersList(supabase, wallOwner.id);
    if (data) setSupportersList(data as unknown as SupporterRecord[]);
  };

  const handlePostChange = (text: string) => {
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

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim() || !profile?.current_ghost_id) return;

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

      const { error } = await createWallPost(supabase, {
        content: newPostContent.trim(),
        wallGhostId: ghostId,
        linkMetadata,
        imageUrl: finalImageUrl,
        videoUrl,
        mentionedPoliticianIds,
      });

      if (error) throw error;

      trackPostCreated({
        hasImage: Boolean(finalImageUrl),
        hasVideo: Boolean(videoUrl),
        hasLink: Boolean(linkMetadata),
        contentLength: newPostContent.trim().length,
      });

      setNewPostContent("");
      setMentionedPoliticianIds([]);
      setExtractedUrl(null);
      setLinkMetadata(null);
      setImageFile(null);
      setImagePreview(null);
      setVideoUrl(null);
      setShowRecorder(false);
      setComposerOpen(false);
      await fetchPosts();
    } catch (err: any) {
      const msg = err?.message || err?.details || err?.hint || (typeof err === "object" ? JSON.stringify(err) : String(err));
      console.error("Error creating post:", msg, err);
      setPostError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Only snap the composer back to its compact one-line trigger when
  // there's nothing pending, mirroring the Feed composer's behavior.
  const closeComposerIfEmpty = () => {
    if (!newPostContent.trim() && !imageFile && !videoUrl && !showRecorder) {
      setComposerOpen(false);
      setPostError(null);
    }
  };

  // Logged-out visitors used to have their click silently swallowed here --
  // same "sign in first" redirect toggleSupport uses elsewhere on this wall,
  // so a like/dislike attempt actually goes somewhere instead of doing
  // nothing with no explanation.
  const requireAuth = () => {
    router.push(`/auth?next=${encodeURIComponent(window.location.pathname)}`);
  };

  const handleVote = async (postId: string, voteType: 1 | -1) => {
    if (!user) {
      requireAuth();
      return;
    }
    const { error } = await voteOnPost(supabase, postId, voteType);
    if (!error) {
      trackPostEngagement(voteType === 1 ? "upvote" : "downvote", postId);
      await fetchPosts();
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
      await fetchPosts();
    } catch (err) {
      const msg = (err as { message?: string })?.message || "Failed to post comment.";
      console.error("Error creating comment:", err);
      setCommentErrors((prev) => ({ ...prev, [postId]: msg }));
    }
  };

  const handleReport = async (targetType: ReportTargetType, targetId: string, abuseType: string) => {
    return reportContent(supabase, targetType, targetId, abuseType);
  };

  // Re-pulls just the avg/count pair after a rating is cast via the inline
  // panel — the panel itself only knows the viewer's own vote, not the true
  // new aggregate, so this is the source of truth for the header display.
  const refreshRatingSummary = async () => {
    if (!wallOwner?.id) return;
    const { data: summaries } = await getPoliticianEngagementSummaries(supabase, [wallOwner.id]);
    const summary = (summaries || [])[0] as { avg_rating: number; rating_count: number } | undefined;
    setRatingSummary({ avg: summary?.avg_rating || 0, count: summary?.rating_count || 0 });
  };

  if (loading) return <Spinner fullPage />;

  const isOwner = user && wallOwner?.id === user.id;
  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  // This wall owner can be actively campaigning for more than one seat at
  // once (see the "Currently Running For" chips), each with its own set of
  // interview answers -- picks whichever candidacy has the most recorded
  // answers as the one "Play Interview" surfaces. Not gated on election
  // status (unlike those chips, which only show *active* elections): the
  // interview is recorded and worth watching well before an election goes
  // active, so tying visibility to that would hide it for most of a
  // candidate's actual campaign season.
  let primaryInterviewCandidateId: string | null = null;
  let primaryInterviewCount = 0;
  interviewCounts.forEach((count, candidateId) => {
    if (count > primaryInterviewCount) {
      primaryInterviewCount = count;
      primaryInterviewCandidateId = candidateId;
    }
  });

  // Action icon row extracted to a variable so it can render inline with the
  // contact icons on mobile (single combined row, saving a whole row of
  // height) while staying in its own right-aligned column on desktop —
  // avoids duplicating the button markup itself, just its placement.
  const actionButtons = (
    <>
      <div className="relative shrink-0">
        <Button
          variant="icon"
          size="sm"
          tone="default"
          onClick={toggleSupport}
          title={isSupporting ? "Withdraw support" : "Support this politician"}
          // Icon-variant tones are muted-until-hover by design, which
          // hides a *persistent* toggled state — force it visible here
          // since "supporting" needs to read as active at rest, not
          // just on hover.
          className={isSupporting ? "!text-primary bg-primary/10" : ""}
        >
          <Heart size={16} className={isSupporting ? "fill-current" : ""} />
        </Button>
        {supportCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-text-on-primary text-[10px] font-bold flex items-center justify-center leading-none pointer-events-none">
            {supportCount}
          </span>
        )}
      </div>

      {/* Every video-interview answer collapses into this one button instead
          of showing up as N separate posts in the list below (see
          displayedPosts). */}
      {primaryInterviewCandidateId && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowInterviewCandidateId(primaryInterviewCandidateId)}
          className="gap-1.5 text-xs border-primary/30 text-primary-light hover:bg-primary/10 shrink-0"
          title={`Play ${wallOwner?.full_name || "this candidate"}'s video interview`}
        >
          <Video size={13} />
          Play Interview
        </Button>
      )}

      {/* Unified claim gating — see get_wall_claim_eligibility() (migration
          20260811170000). Shows nothing at all once the wall already has a
          real owner or an open claim; otherwise routes to whichever claim
          system actually backs this wall (election-candidacy stub vs.
          officeholder import) instead of one generic form that only ever
          worked for the candidate case. */}
      {!isOwner && (claimEligibility?.kind === "unclaimed_candidate" || claimEligibility?.kind === "unclaimed_officeholder") && (
        <Button
          variant="icon"
          size="sm"
          tone="primary"
          onClick={openClaimModal}
          title="Claim This Wall"
          // Same reasoning as the Support toggle above — this needs to
          // read as a live call-to-action at rest (an unclaimed wall
          // inviting the real politician to claim it), not blend into
          // the muted-until-hover default icon look.
          className="shrink-0 !text-primary bg-primary/10 hover:bg-primary/20"
        >
          <ShieldCheck size={16} />
        </Button>
      )}

      {isOwner && (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/profile/edit")}
            className="gap-1 text-xs shrink-0"
          >
            ✎ Edit Profile
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadSupportersDashboard}
            className="gap-1 text-xs shrink-0"
          >
            <Users size={14} /> Supporters Dashboard
          </Button>
        </>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowQr(true)}
        className="p-2 shrink-0"
      >
        <QrCode size={16} />
      </Button>

      {!isOwner && wallOwner?.id && (
        <Button
          variant="icon"
          size="sm"
          tone="danger"
          onClick={() => setShowReportProfile(true)}
          title="Report this politician"
          className="shrink-0"
        >
          <Flag size={14} />
        </Button>
      )}
    </>
  );

  return (
    // No horizontal padding here -- both call sites (src/app/wall/[ghostId]/
    // page.tsx and .../[slug]/page.tsx) supply their own px-4 lg:px-8 wrapper
    // now, so this component can be nested inside a wider layout (a grid
    // column alongside a sidebar, on the main wall page) without doubling up.
    <div className="w-full max-w-none pb-20 space-y-6">
      {/* Accessible SEO & AI Search Entity Lead Block */}
      {wallOwner && (
        <section aria-label="Politician Profile Overview" className="sr-only">
          <p>
            {wallOwner.full_name || "Politician"} is a public leader and candidate profile on Choseno.
            {wallOwner.politician_profiles?.political_target_role && ` Serving as or running for ${wallOwner.politician_profiles.political_target_role}.`}
            {wallOwner.politician_profiles?.target_boundary_name && ` Located in ${wallOwner.politician_profiles.target_boundary_name}.`}
            {wallOwner.politician_profiles?.bio && ` Profile overview: ${wallOwner.politician_profiles.bio}`}
            {" "}Voters and constituents can review policy stances, submit public ratings, track campaign updates, and leave feedback on Choseno.
          </p>
        </section>
      )}

      {/* Wall Header Card — ultra-compact on mobile (p-3, space-y-2) to save
          vertical real estate; expands to breathable spacing on lg+ (p-6,
          space-y-4). Two-row mobile layout: identity in left column,
          actions icons in right. Same compact two-row pattern as the Feed
          and Elections headers. */}
      <Card padding="none" className="p-3 lg:p-6 space-y-2 lg:space-y-4">
        <div className="flex flex-col gap-2 lg:gap-4 lg:flex-row lg:items-start lg:justify-between">
          {/* items-start (not items-center) so the avatar pins to the top of
              the text column instead of vertically centering against it —
              with 2-3 contact pills stacked below the name, that column can
              get much taller than the avatar, which used to drag the avatar
              down into the middle of the card. */}
          <div className="flex items-start gap-2 lg:gap-4 min-w-0">
            <Avatar
              src={wallOwner?.politician_profiles?.photo_url || wallOwner?.politician_profiles?.avatar_url}
              name={wallOwner?.full_name || "P"}
              size="xl"
              className="!w-12 !h-12 !text-lg lg:!w-20 lg:!h-20 lg:!text-2xl"
            />
            <div className="min-w-0 flex-1">
              <h1 className="text-lg lg:text-2xl font-bold text-text-main flex items-center gap-2 min-w-0 flex-wrap">
                <span className="truncate">{wallOwner?.full_name || "Politician Wall"}</span>
                {wallOwner?.politician_profiles?.positions && wallOwner.politician_profiles.positions.length > 1 ? (
                  // Holds more than one office at once (e.g. Premier + home-riding MLA) --
                  // one badge per position instead of picking just one to show.
                  wallOwner.politician_profiles.positions.map((pos) => (
                    <Badge key={`${pos.roleTitle}-${pos.jurisdictionName}`} tone="primary" className="shrink-0">
                      {pos.roleTitle}
                    </Badge>
                  ))
                ) : wallOwner?.politician_profiles?.political_target_role ? (
                  <Badge tone="primary" className="shrink-0">
                    {wallOwner.politician_profiles.is_former_office_holder
                      ? `Former ${wallOwner.politician_profiles.political_target_role}`
                      : wallOwner.politician_profiles.is_office_holder || wallOwner.politician_profiles.holding_since
                        ? wallOwner.politician_profiles.political_target_role
                        : `Aspiring ${wallOwner.politician_profiles.political_target_role}`}
                  </Badge>
                ) : null}
              </h1>
              {/* Location + rating collapsed onto one line on mobile instead
                  of two — they're both short, low-priority metadata and
                  don't need a row each. */}
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {(() => {
                  const positions = wallOwner?.politician_profiles?.positions;
                  const jurisdictionLine =
                    positions && positions.length > 1
                      ? positions
                          .map((p) => p.jurisdictionName)
                          .filter((name, i, arr) => Boolean(name) && arr.indexOf(name) === i)
                          .join(" · ")
                      : wallOwner?.politician_profiles?.target_boundary_name;
                  return jurisdictionLine ? (
                    <>
                      <span className="text-xs text-text-muted truncate">{jurisdictionLine}</span>
                      <span className="text-text-muted/40 text-xs">·</span>
                    </>
                  ) : null;
                })()}
                <button
                  type="button"
                  onClick={() => setShowInlineRating((v) => !v)}
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  title="Rate this profile"
                >
                  <StarRating value={ratingSummary.avg} count={ratingSummary.count} size="sm" />
                </button>
                {ratingSummary.count > 0 && (
                  <>
                    <span className="text-text-muted/40 text-xs">·</span>
                    <button
                      type="button"
                      onClick={() => setShowReviewsModal(true)}
                      className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                    >
                      See reviews
                    </button>
                  </>
                )}
              </div>

              {/* Inline "leave a review" panel — expands in place instead of
                  a popup, so rating never navigates away from the wall. */}
              {showInlineRating && wallOwner?.id && (
                <PoliticianInlineRating
                  politicianId={wallOwner.id}
                  politicianName={wallOwner.full_name || "This politician"}
                  onSubmitted={refreshRatingSummary}
                  onCancel={() => setShowInlineRating(false)}
                />
              )}

              {/* Contact + action icons share one row on mobile — below lg,
                  contact links are icon-only circular buttons (title attr
                  carries the label for a11y/tooltip) and the action buttons
                  (support/claim/qr/report) are appended right after them in
                  the same wrapping row, so the whole card collapses from
                  four stacked rows to one. At lg+ contact links regain their
                  full labeled-pill form here, and the action buttons move
                  back out to their own right-aligned column below. */}
              <div className="flex flex-wrap items-center gap-1.5 lg:gap-2 mt-1.5 lg:mt-2">
                {wallOwner?.politician_profiles?.contact_email && (
                  <a
                    href={`mailto:${wallOwner.politician_profiles.contact_email}`}
                    title={wallOwner.politician_profiles.contact_email}
                    className="inline-flex items-center justify-center gap-1.5 w-7 h-7 lg:w-auto lg:h-auto lg:px-2.5 lg:py-1.5 text-xs font-medium text-primary hover:text-primary-light bg-primary/10 hover:bg-primary/15 rounded-full lg:rounded-lg transition-colors shrink-0"
                  >
                    <Mail size={13} className="shrink-0" />
                    <span className="hidden lg:inline truncate max-w-[220px]">
                      {wallOwner.politician_profiles.contact_email}
                    </span>
                  </a>
                )}
                {wallOwner?.politician_profiles?.contact_phone && (
                  <a
                    href={`tel:${wallOwner.politician_profiles.contact_phone}`}
                    title={wallOwner.politician_profiles.contact_phone}
                    className="inline-flex items-center justify-center gap-1.5 w-7 h-7 lg:w-auto lg:h-auto lg:px-2.5 lg:py-1.5 text-xs font-medium text-primary hover:text-primary-light bg-primary/10 hover:bg-primary/15 rounded-full lg:rounded-lg transition-colors shrink-0"
                  >
                    <Phone size={13} className="shrink-0" />
                    <span className="hidden lg:inline">{wallOwner.politician_profiles.contact_phone}</span>
                  </a>
                )}
                {wallOwner?.politician_profiles?.source_url && (
                  <a
                    href={wallOwner.politician_profiles.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Official Website"
                    className="inline-flex items-center justify-center gap-1.5 w-7 h-7 lg:w-auto lg:h-auto lg:px-2.5 lg:py-1.5 text-xs font-medium text-primary hover:text-primary-light bg-primary/10 hover:bg-primary/15 rounded-full lg:rounded-lg transition-colors shrink-0"
                  >
                    <Globe size={13} className="shrink-0" />
                    <span className="hidden lg:inline">Official Website</span>
                  </a>
                )}

                {/* Thin divider between contact links and action icons so
                    the merged mobile row still reads as two groups. */}
                {(wallOwner?.politician_profiles?.contact_email ||
                  wallOwner?.politician_profiles?.contact_phone ||
                  wallOwner?.politician_profiles?.source_url) && (
                  <span className="w-px h-4 bg-border lg:hidden shrink-0" />
                )}

                {/* Mobile-only: action buttons folded into this same row.
                    Hidden at lg where they reappear in their own column. */}
                <div className="flex items-center gap-1.5 flex-wrap lg:hidden">
                  {actionButtons}
                </div>
              </div>
            </div>
          </div>

          {/* Desktop-only action column — icon-only row. Ratings is gone
              entirely -- the star rating in the identity column already
              opens this same modal, so a second "Ratings" button was a
              duplicate control. */}
          <div className="hidden lg:flex items-center gap-2 flex-wrap">
            {actionButtons}
          </div>
        </div>

        {wallOwner?.politician_profiles?.bio && (
          <p className="text-sm text-text-secondary pt-2 lg:pt-3 border-t border-border-light/20 leading-relaxed">
            {wallOwner.politician_profiles.bio}
          </p>
        )}

        {candidacies.length > 0 && (
          <div className="pt-4 border-t border-border-light/20 space-y-2">
            <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-2">
              Currently Running For
            </p>
            <div className="flex flex-wrap gap-2">
              {candidacies.map((cand) => {
                const seat = cand.election_seats as any;
                const election = seat?.elections as any;
                const shape = seat?.map_shapes as any;
                // "active" alone was wrong -- a race sitting in nomination
                // (the normal state for most of an election cycle, well
                // before polling day) has status "nominations_open" or
                // "nominations_closed", not "active" yet. That narrower
                // check meant this chip silently rendered nothing for
                // almost every real candidacy, even though the "CURRENTLY
                // RUNNING FOR" heading above it still showed (it only
                // checks candidacies.length > 0). Same open-race status set
                // used everywhere else in the app (see
                // getOpenSeatsNearShapeIds in elections.ts).
                const isOpenRace = ["nominations_open", "nominations_closed", "active"].includes(election?.status);

                if (!isOpenRace || !seat?.id) return null;

                const seatSlug = buildSeatSlug({ id: seat.id, role_title: seat.role_title, map_shapes: shape });

                return (
                  <a
                    key={cand.id}
                    href={`/elections/seat/${seatSlug}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-hover border border-border-light/60 rounded-full hover:bg-surface-active hover:border-primary/40 transition-all text-xs font-semibold text-text-secondary"
                  >
                    <span>{seat?.role_title}</span>
                    <span className="text-text-muted">•</span>
                    <span className="text-text-muted">{shape?.name}</span>
                  </a>
                );
              }).filter(Boolean)}
            </div>
          </div>
        )}

        {/* "Be the first to review" motivation banner -- the direct answer
            to a wall with zero reviews reading as dead/abandoned. Only
            shown while showInlineRating is false so it doesn't duplicate
            the expanded panel it opens (rendered further up, next to the
            star rating control). Hidden the moment ratingSummary.count
            ticks above 0 via refreshRatingSummary, same state the star
            rating and "See reviews" link already read from. */}
        {ratingSummary.count === 0 && !showInlineRating && (
          <div className="pt-4 border-t border-border-light/20">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-primary/5 border border-dashed border-primary/25">
              <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <Star size={18} className="text-primary fill-primary/25" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-text-main">
                  No one has reviewed {wallOwner?.full_name || "this politician"} yet — you&rsquo;d be the first
                </p>
                <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                  Rate them on their record and recent news coverage. Reviews post under your anonymous Ghost
                  ID — {wallOwner?.full_name || "they"} and every other visitor only ever see that, never your
                  real name.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => (user ? setShowInlineRating(true) : requireAuth())}
                className="gap-1.5 shrink-0 w-full sm:w-auto"
              >
                <Star size={13} /> Be the First to Review
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Post Composer — collapses to a single tap-to-expand row (same
          pattern as the main Feed composer) instead of always showing the
          full textarea + toolbar. */}
      {user && profile?.current_ghost_id && (
        <Card padding={composerOpen ? "md" : "sm"}>
          {!composerOpen ? (
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="w-full flex items-center gap-2.5 text-left cursor-pointer"
            >
              <Avatar name="You" size="sm" />
              <span className="flex-1 min-w-0 text-sm text-text-muted bg-surface/50 border border-border-light/30 rounded-full px-4 py-2 truncate">
                {isOwner
                  ? "Post an update to your public wall..."
                  : "Leave a post or message for this representative..."}
              </span>
              <span className="shrink-0 flex items-center gap-1 text-text-muted">
                <ImageIcon size={18} aria-hidden="true" />
                {isOwner && <Video size={18} aria-hidden="true" />}
              </span>
            </button>
          ) : (
          <form onSubmit={handleCreatePost} className="space-y-3">
            <MentionTextarea
              supabase={supabase}
              placeholder={
                isOwner
                  ? "Post an update to your public wall... Type @ to tag a politician"
                  : "Leave a post or message for this representative... Type @ to tag a politician"
              }
              value={newPostContent}
              onChange={handlePostChange}
              onMentionsChange={setMentionedPoliticianIds}
              viewerShapeIds={viewerShapeIds}
              viewerCountry={profile?.country}
              rows={3}
              autoFocus
            />

            {postError && <Alert tone="danger">{postError}</Alert>}

            {imagePreview && (
              <div className="relative rounded-xl overflow-hidden border border-border-light/45 max-h-60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                <RemoveMediaButton
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                  }}
                />
              </div>
            )}

            {extractedUrl && (
              <LinkPreview
                url={extractedUrl}
                onMetadataFetched={setLinkMetadata}
              />
            )}

            {showRecorder && (
              <VideoRecorder
                maxDuration={30}
                onVideoUploaded={(url) => {
                  setVideoUrl(url);
                  setShowRecorder(false);
                }}
              />
            )}

            {videoUrl && (
              <div className="p-3 bg-primary/10 border border-primary/30 rounded-xl flex items-center justify-between text-xs">
                <span className="font-semibold text-primary flex items-center gap-1.5">
                  <Video size={14} /> Campaign Video Attached
                </span>
                <button
                  type="button"
                  onClick={() => setVideoUrl(null)}
                  className="text-text-muted hover:text-danger underline cursor-pointer"
                >
                  Remove
                </button>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <label className="cursor-pointer text-xs text-text-muted hover:text-text-main flex items-center gap-1 p-1.5 rounded-lg hover:bg-surface/50 transition-colors">
                  <ImageIcon size={16} />
                  <span>Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setImageFile(file);
                        setImagePreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                </label>

                {isOwner && (
                  <button
                    type="button"
                    onClick={() => setShowRecorder(!showRecorder)}
                    className={`text-xs flex items-center gap-1 p-1.5 rounded-lg transition-colors cursor-pointer ${
                      showRecorder || videoUrl
                        ? "bg-primary/20 text-primary font-bold"
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
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Posting..." : "Post to Wall"}
                </Button>
              </div>
            </div>
          </form>
          )}
        </Card>
      )}

      {/* Wall Post Feed -- paired with the optional sidebar prop in a grid
          starting exactly here, not any higher (the profile header, rating
          bar, and composer above stay full-width). */}
      <div className={sidebar ? "lg:grid lg:grid-cols-[1fr_340px] lg:gap-8 lg:items-start" : undefined}>
      <div className="min-w-0">
      {displayedPosts.length === 0 ? (
        <EmptyState
          icon={Users}
          title="It's quiet here"
          description={`No public posts yet. Leave the first message for ${wallOwner?.full_name || "this politician"}${
            ratingSummary.count === 0 ? ", or rate them above" : ""
          } — both help other constituents get a read on them.`}
        />
      ) : (
        <>
          <FeedSortControl
            sortMode={sortMode ?? defaultSortMode(profile?.id ? "politician" : null)}
            onSortChange={setSortMode}
          />
          <div className="space-y-6">
            {displayedPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              ownerGhostId={ghostId}
              ownerFullName={wallOwner?.full_name}
              ownerBadgeLabel="Politician"
              viewerIsOwner={isOwner}
              showVoteBar
              onVote={(postId, voteType) => handleVote(postId, voteType)}
              canComment={!!user}
              onRequireAuth={requireAuth}
              commentValue={commentInputs[post.id] || ""}
              onCommentChange={(text) =>
                setCommentInputs({ ...commentInputs, [post.id]: text })
              }
              onSubmitComment={() => handleCreateComment(post.id)}
              onMediaClick={(url, type) => setMediaPreview({ url, type })}
              onPitchVideoClick={(p) => setPitchPostToPlay(p)}
              politicianAuthor={
                politicianAuthors.get(post.ghost_id) ??
                (post.ghost_id === ghostId && wallOwner?.full_name
                  ? { fullName: wallOwner.full_name, wallHref: `/wall/${wallOwner.politician_profiles?.wall_slug || buildPoliticianWallSlug(wallOwner.full_name, wallOwner.politician_profiles?.political_target_role)}` }
                  : null)
              }
              onReport={handleReport}
              commentError={commentErrors[post.id]}
              mentions={postMentions.get(post.id)}
              mentionBadge={mentionOnlyPostIds.has(post.id)}
            />
          ))}
          </div>
        </>
      )}

      {/* Infinite scroll sentinel -- same IntersectionObserver pattern as
          NewsInfiniteFeed. Rendered even while displayedPosts is empty (the
          EmptyState above already covers that message) so the observer has
          something to watch once posts do start coming in from a fresh
          wall. */}
      {hasMorePosts && (
        <div ref={feedSentinelRef} className="py-6 flex justify-center">
          {loadingMorePosts && <Spinner />}
        </div>
      )}
      {!hasMorePosts && displayedPosts.length > 0 && (
        <div className="py-6 text-center text-xs text-text-muted flex items-center justify-center gap-1.5">
          <CheckCircle2 size={14} className="text-primary" />
          You&rsquo;re all caught up
        </div>
      )}
      </div>
      {sidebar && <div className="mt-8 lg:mt-0">{sidebar}</div>}
      </div>

      {showReportProfile && wallOwner?.id && (
        <ReportDialog
          targetType="politician_profile"
          targetId={wallOwner.id}
          onReport={handleReport}
          onClose={() => setShowReportProfile(false)}
        />
      )}

      {showReviewsModal && wallOwner?.id && (
        <PoliticianRatingModal
          politicianId={wallOwner.id}
          politicianName={wallOwner.full_name || "This politician"}
          onClose={() => setShowReviewsModal(false)}
          onChange={(summary) => setRatingSummary({ avg: summary.avgRating, count: summary.ratingCount })}
        />
      )}

      {/* QR Code Modal */}
      {showQr && (
        <Modal onOverlayClick={() => setShowQr(false)}>
          <Card padding="md" className="space-y-4 text-center">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm text-text-main">Wall QR Code</h3>
              <Button size="sm" variant="ghost" onClick={() => setShowQr(false)}>
                <X size={14} />
              </Button>
            </div>
            <div className="p-4 bg-white rounded-2xl inline-block">
              <QRCodeSVG value={currentUrl} size={200} />
            </div>
            <p className="text-xs text-text-muted text-center">
              Scan to open this politician wall on mobile
            </p>
          </Card>
        </Modal>
      )}

      {/* Supporters Dashboard Modal */}
      {showSupporters && (
        <Modal onOverlayClick={() => setShowSupporters(false)}>
          <Card padding="md" className="space-y-4 w-full max-w-md">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm text-text-main">Constituent Supporters</h3>
              <Button size="sm" variant="ghost" onClick={() => setShowSupporters(false)}>
                <X size={14} />
              </Button>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto p-2">
              {supportersList.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-4">
                  No supporters recorded yet.
                </p>
              ) : (
                supportersList.map((sup) => (
                  <div
                    key={sup.id}
                    className="flex items-center justify-between p-2.5 bg-surface/30 rounded-xl border border-border-light/20 text-xs"
                  >
                    <span className="font-medium text-text-main">
                      {sup.profiles?.full_name || "Constituent"}
                    </span>
                    <span className="text-[10px] text-text-muted">
                      {new Date(sup.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </Modal>
      )}

      {mediaPreview && (
        <StoryViewerModal
          url={mediaPreview.url}
          type={mediaPreview.type}
          onClose={() => setMediaPreview(null)}
        />
      )}

      {pitchPostToPlay && (
        <PitchPostPlayer
          post={pitchPostToPlay}
          authorName={wallOwner?.full_name || "Candidate"}
          authorAvatarUrl={wallOwner?.politician_profiles?.photo_url || wallOwner?.politician_profiles?.avatar_url}
          onClose={() => setPitchPostToPlay(null)}
        />
      )}

      {showInterviewCandidateId && (
        <PlayInterviewReel
          candidateId={showInterviewCandidateId}
          candidateName={wallOwner?.full_name || "This candidate"}
          onClose={() => setShowInterviewCandidateId(null)}
        />
      )}

      {/* Claim Wall Modal — same form, routes to whichever backend claim
          system actually matches this wall (see claimEligibility above). */}
      {showClaimModal && (
        <Modal onOverlayClick={() => setShowClaimModal(false)}>
          <Card padding="md" className="space-y-4 w-full max-w-md">
            <div className="flex justify-between items-center border-b border-border-light/30 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-primary" />
                <h3 className="font-bold text-base text-text-main">Claim This Wall</h3>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setShowClaimModal(false)}>
                <X size={16} />
              </Button>
            </div>

            {claimSuccess ? (
              <div className="space-y-4 text-center py-4">
                <CheckCircle2 size={44} className="text-success mx-auto" />
                <h4 className="font-bold text-lg text-text-main">Claim Request Submitted!</h4>
                <p className="text-xs text-text-muted leading-relaxed">
                  Thank you! Your claim request for <strong>{wallOwner?.full_name || "this representative"}</strong> has been received. Our team will review your verification details and contact you at <strong>{claimEmail}</strong> shortly.
                </p>
                <Button
                  className="w-full mt-2"
                  onClick={() => {
                    setShowClaimModal(false);
                    setClaimSuccess(false);
                  }}
                >
                  Done
                </Button>
              </div>
            ) : (
              <form onSubmit={handleClaimSubmit} className="space-y-4">
                <p className="text-xs text-text-muted leading-relaxed">
                  Are you <strong>{wallOwner?.full_name || "this representative"}</strong> or an authorized campaign staff member? Submit your contact details to request official verification and wall access. Signed in as <strong>{user?.email}</strong> — an admin reviews every request before anything on this wall changes.
                </p>

                {claimError && (
                  <Alert tone="danger">{claimError}</Alert>
                )}

                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">
                    Official Contact Email *
                  </label>
                  <Input
                    type="email"
                    required
                    placeholder="e.g. campaign@bobferguson.org"
                    value={claimEmail}
                    onChange={(e) => setClaimEmail(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">
                    Phone Number or Official Website/Social Link
                  </label>
                  <Input
                    placeholder="e.g. (555) 123-4567 or twitter.com/bobferguson"
                    value={claimPhone}
                    onChange={(e) => setClaimPhone(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-main mb-1">
                    Verification Notes / Message
                  </label>
                  <Textarea
                    rows={3}
                    placeholder="Briefly state your role or official position..."
                    value={claimMotivation}
                    onChange={(e) => setClaimMotivation(e.target.value)}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowClaimModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submittingClaim}
                    className="flex-1"
                  >
                    {submittingClaim ? <Spinner size="sm" /> : "Submit Claim Request"}
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </Modal>
      )}
    </div>
  );
}
