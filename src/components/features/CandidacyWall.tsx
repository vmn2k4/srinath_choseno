"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import LinkPreview from "./LinkPreview";
import AnswerValue from "./AnswerValue";
import { getGhostDisplayName } from "@/lib/utils/ghostName";
import { buildSeatSlug } from "@/lib/utils/slugs";
import PostCard, { type PostWithComments } from "@/components/features/PostCard";
import MentionTextarea from "./MentionTextarea";
import {
  getPublicCandidateById,
  getPublicCandidateAnswers,
  getCandidacyWallPosts,
  createCandidatePost,
  attachPostMentions,
  createAnswerComment,
  updateNominationFiled,
  requestCandidacyClaim,
} from "@/lib/services/elections";
import { getOwnProfile, getPoliticianProfile, getUserBoundaryShapeIds } from "@/lib/services/profile";
import { getPoliticianEngagementSummaries } from "@/lib/services/ratings";
import PoliticianInlineRating from "./PoliticianInlineRating";
import { uploadPostImage, createComment, hydratePoliticianAuthors, hydratePostMentions, voteOnPost } from "@/lib/services/feed";
import { reportContent, type ReportTargetType } from "@/lib/services/moderation";
import {
  getSupportStatus,
  getSupporterCount,
  withdrawSupport,
  addSupport,
  getMentionedWallPosts,
} from "@/lib/services/politicianWall";
import {
  ArrowLeft,
  GraduationCap,
  Home,
  Image as ImageIcon,
  Video,
  HelpCircle,
  Heart,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Send,
  UserCheck,
  ExternalLink,
} from "lucide-react";
import {
  Card,
  Button,
  Badge,
  Input,
  Textarea,
  Spinner,
  StoryViewerModal,
  RemoveMediaButton,
  Avatar,
  Alert,
  EmptyState,
  StarRating,
} from "@/components/primitives";
import { createClient } from "@/lib/supabase/client";
import { buildPoliticianWallSlug } from "@/lib/utils/slugs";
import { mergeWallPosts } from "@/lib/utils/mergeWallPosts";
import { trackPostCreated, trackPostEngagement, trackCommentAdded } from "@/lib/analytics/events";

interface CandidateRecord {
  id: string;
  seat_id: string;
  politician_id: string;
  display_name: string;
  party_name?: string;
  hometown?: string;
  education?: string;
  statement?: string;
  intro_video_url?: string;
  avatar_url?: string;
  nomination_filed?: boolean;
  is_unregistered?: boolean;
  profiles?: {
    id?: string;
    full_name?: string;
    current_ghost_id?: string;
    // The candidate's real, stored wall slug -- must be preferred over a
    // computed buildPoliticianWallSlug(name, role) fallback. See
    // getPublicCandidateById's comment: two different profiles can each
    // have their own valid wall_slug, and the computed fallback only ever
    // recomputes name+role, so it can collide with an unrelated profile's
    // actual slug and silently link to the wrong wall.
    politician_profiles?: { wall_slug?: string | null } | { wall_slug?: string | null }[] | null;
  };
  election_seats?: {
    role_title?: string;
    map_shapes?: { name?: string } | null;
  } | null;
}

interface QuestionnaireAnswer {
  id: string;
  context_text?: string | null;
  option_text?: string | null;
  selected_option_texts?: string[] | null;
  text_answer?: string | null;
  rating_value?: number | null;
  video_url?: string | null;
  election_questions?: {
    rank?: number;
    question_text?: string;
    question_type?: string;
    visible_to_public?: boolean;
  };
  election_question_options?: {
    option_text?: string;
  } | null;
  election_candidate_answer_options?: Array<{
    rank?: number | null;
    election_question_options?: {
      option_text?: string;
    };
  }>;
  election_answer_comments?: Array<{
    id: string;
    ghost_id: string;
    content: string;
    created_at: string;
  }>;
  comments?: Array<{
    id: string;
    ghost_id: string;
    content: string;
    created_at: string;
  }>;
}

// Resolves the URL for a candidate's own Politician Wall. Always prefer the
// real, stored wall_slug over the computed buildPoliticianWallSlug(name,
// role) fallback -- two different profiles can each have a valid wall_slug,
// and the computed one only ever recomputes name+role, so it can (and for a
// real candidate, did) collide with an unrelated profile's actual slug and
// silently route to the wrong wall entirely. Only fall back to the computed
// slug when no real one is on record yet (e.g. a freshly claimed profile).
function resolvePoliticianWallSlug(candidate: CandidateRecord | null, displayName: string, roleTitle?: string | null) {
  const pp = candidate?.profiles?.politician_profiles;
  const realSlug = Array.isArray(pp) ? pp[0]?.wall_slug : pp?.wall_slug;
  return realSlug || buildPoliticianWallSlug(displayName, roleTitle);
}

interface CandidacyWallProps {
  candidateId: string;
  embedded?: boolean;
  // Seeded from the server (page.tsx) so the initial server-rendered HTML
  // already contains the candidate's real bio/statement/answers/posts
  // instead of a loading spinner — see ElectionSeatPageClient for the same
  // pattern. loadAll() still runs on mount for auth-dependent state
  // (viewer's own profile, isSupporting) and to refresh the seed.
  initialCandidate?: CandidateRecord | null;
  initialCandidateProfile?: unknown;
  initialAnswers?: QuestionnaireAnswer[];
  initialPosts?: PostWithComments[];
  initialSupportCount?: number;
}

export default function CandidacyWall({
  candidateId,
  embedded = false,
  initialCandidate = null,
  initialCandidateProfile = null,
  initialAnswers = [],
  initialPosts = [],
  initialSupportCount = 0,
}: CandidacyWallProps) {
  const supabase = createClient();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<{ id: string; current_ghost_id: string; country?: string | null } | null>(null);
  const [viewerShapeIds, setViewerShapeIds] = useState<number[]>([]);
  const [candidate, setCandidate] = useState<CandidateRecord | null>(initialCandidate);
  const [candidateProfile, setCandidateProfile] = useState<any>(initialCandidateProfile);
  const [answers, setAnswers] = useState<QuestionnaireAnswer[]>(initialAnswers);
  const [posts, setPosts] = useState<PostWithComments[]>(initialPosts);
  const [loading, setLoading] = useState(!initialCandidate);

  const [newPostContent, setNewPostContent] = useState("");
  const [mentionedPoliticianIds, setMentionedPoliticianIds] = useState<string[]>([]);
  const [postError, setPostError] = useState<string | null>(null);
  const [extractedUrl, setExtractedUrl] = useState<string | null>(null);
  const [linkMetadata, setLinkMetadata] = useState<{ url: string; title?: string; description?: string; image?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  // Same tap-to-expand pattern as the Feed/Wall composers -- starts
  // collapsed to a single row instead of always showing the full textarea.
  const [composerOpen, setComposerOpen] = useState(false);

  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [commentErrors, setCommentErrors] = useState<Record<string, string>>({});
  const [expandedAnswerIds, setExpandedAnswerIds] = useState<Set<string>>(
    () => new Set()
  );
  const [answerCommentInputs, setAnswerCommentInputs] = useState<
    Record<string, string>
  >({});

  const [supportCount, setSupportCount] = useState(initialSupportCount);
  const [isSupporting, setIsSupporting] = useState(false);
  const [ratingSummary, setRatingSummary] = useState<{ avg: number; count: number } | null>(null);
  // Inline "leave a review" panel that expands in place — same non-modal
  // pattern PoliticianWallClient and NewsArticleLinkedPoliticians already
  // use, replacing the old PoliticianRatingModal popup here too.
  const [showInlineRating, setShowInlineRating] = useState(false);

  // Claim request state
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [claimMotivation, setClaimMotivation] = useState("");
  const [claimContactEmail, setClaimContactEmail] = useState("");
  const [claimSocialMedia, setClaimSocialMedia] = useState("");
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [claimStatus, setClaimStatus] = useState("");
  const [claimSubmitted, setClaimSubmitted] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<{ url: string; type: "image" | "video" } | null>(null);
  const [showPositionsModal, setShowPositionsModal] = useState(false);

  const loadAnswers = async () => {
    const { data: answerRows } = await getPublicCandidateAnswers(supabase, candidateId);
    const visible = ((answerRows as unknown as QuestionnaireAnswer[]) || [])
      .filter((a) => a.election_questions?.visible_to_public)
      .sort(
        (a, b) =>
          (a.election_questions?.rank ?? 0) - (b.election_questions?.rank ?? 0)
      );
    setAnswers(visible);
  };

  const [politicianAuthors, setPoliticianAuthors] = useState<Map<string, { fullName: string; wallHref: string }>>(new Map());
  const [postMentions, setPostMentions] = useState<Map<string, { politicianId: string; fullName: string; wallHref: string }[]>>(new Map());
  const [mentionOnlyPostIds, setMentionOnlyPostIds] = useState<Set<string>>(new Set());

  const loadPosts = async (ghostId?: string) => {
    const targetGhostId = ghostId ?? candidate?.profiles?.current_ghost_id;
    const { data } = await getCandidacyWallPosts(supabase, candidateId, targetGhostId);
    const authored = (data as PostWithComments[]) || [];

    let mentioned: PostWithComments[] = [];
    if (candidate?.politician_id) {
      const { data: mentionedData } = await getMentionedWallPosts(supabase, candidate.politician_id);
      mentioned = (mentionedData as PostWithComments[]) || [];
    }
    const { merged, mentionOnlyIds } = mergeWallPosts(authored, mentioned);
    setPosts(merged);
    setMentionOnlyPostIds(mentionOnlyIds);
    setPostMentions(await hydratePostMentions(supabase, merged));

    const map = await hydratePoliticianAuthors(supabase, merged);
    if (targetGhostId && candidate?.display_name) {
      map.set(targetGhostId, {
        fullName: candidate.display_name,
        wallHref: `/wall/${resolvePoliticianWallSlug(candidate, candidate.display_name, candidate.election_seats?.role_title)}`,
      });
    }
    setPoliticianAuthors(map);
  };

  useEffect(() => {
    let isMounted = true;

    async function loadAll() {
      if (authLoading || !candidateId) return;
      if (!candidate) setLoading(true);

      // The viewer's own profile (for the boundary/claim checks below) and
      // the candidate row itself don't depend on each other — they used to
      // run as two sequential round trips before anything else could start;
      // now they run together.
      const [profileResult, candidateResult] = await Promise.all([
        user ? getOwnProfile(supabase, user.id) : Promise.resolve({ data: null }),
        getPublicCandidateById(supabase, candidateId),
      ]);

      if (user) {
        const myProfileTyped = profileResult.data as
          | { id: string; current_ghost_id: string; country?: string | null }
          | null;
        if (isMounted) setProfile(myProfileTyped);
        if (myProfileTyped?.id) {
          const { data: shapeRows } = await getUserBoundaryShapeIds(supabase, myProfileTyped.id);
          if (isMounted) setViewerShapeIds((shapeRows || []).map((r) => r.map_shape_id));
        }
      } else {
        if (isMounted) setProfile(null);
      }

      const cand = candidateResult.data as CandidateRecord | null;

      if (cand) {
        if (isMounted) setCandidate(cand);

        // Everything below only reads cand.politician_id/candidateId — none
        // of these five calls depend on each other's result, so they used
        // to serialize for no reason (the rating box, in particular, was
        // the 3rd of 4 chained awaits here before anything rendered).
        const politicianId = cand.politician_id;
        const [polProfileResult, supportResult, supporterCountResult, summariesResult, answersResult] =
          await Promise.all([
            politicianId ? getPoliticianProfile(supabase, politicianId) : Promise.resolve({ data: null }),
            politicianId && user ? getSupportStatus(supabase, politicianId, user.id) : Promise.resolve({ data: null }),
            politicianId ? getSupporterCount(supabase, politicianId) : Promise.resolve({ count: 0 }),
            politicianId ? getPoliticianEngagementSummaries(supabase, [politicianId]) : Promise.resolve({ data: [] }),
            getPublicCandidateAnswers(supabase, candidateId),
          ]);

        if (politicianId && isMounted) {
          setCandidateProfile(polProfileResult.data);
          setIsSupporting(!!supportResult.data);
          setSupportCount(supporterCountResult.count || 0);
          const summary = (summariesResult.data || [])[0] as { avg_rating: number; rating_count: number } | undefined;
          setRatingSummary(summary ? { avg: summary.avg_rating, count: summary.rating_count } : null);
        }

        const visible = ((answersResult.data as unknown as QuestionnaireAnswer[]) || [])
          .filter((a) => a.election_questions?.visible_to_public)
          .sort(
            (a, b) =>
              (a.election_questions?.rank ?? 0) - (b.election_questions?.rank ?? 0)
          );
        if (isMounted) setAnswers(visible);
      } else {
        if (isMounted) setCandidate(null);
      }

      const targetGhostId = cand?.profiles?.current_ghost_id;
      const { data: postRows } = await getCandidacyWallPosts(supabase, candidateId, targetGhostId);
      if (isMounted) {
        setPosts((postRows as PostWithComments[]) || []);
        setLoading(false);
      }
    }

    loadAll();

    return () => {
      isMounted = false;
    };
  }, [user, authLoading, candidateId, supabase]);

  // Re-fetches the true aggregate after a submit — the inline panel only
  // knows the viewer's own vote, not the new average, same as
  // PoliticianWallClient's refreshRatingSummary.
  const refreshRatingSummary = async () => {
    if (!candidate?.politician_id) return;
    const { data: summaries } = await getPoliticianEngagementSummaries(supabase, [candidate.politician_id]);
    const summary = (summaries || [])[0] as { avg_rating: number; rating_count: number } | undefined;
    setRatingSummary({ avg: summary?.avg_rating || 0, count: summary?.rating_count || 0 });
  };

  const toggleNominationFiled = async () => {
    if (!candidate) return;
    const next = !candidate.nomination_filed;
    setCandidate((prev) => (prev ? { ...prev, nomination_filed: next } : null));
    await updateNominationFiled(supabase, candidateId, next);
  };

  const toggleSupport = async () => {
    if (!candidate) return;
    if (!user) {
      router.push("/auth");
      return;
    }
    if (isSupporting) {
      setIsSupporting(false);
      setSupportCount((prev) => Math.max(0, prev - 1));
      await withdrawSupport(supabase, candidate.politician_id, user.id);
    } else {
      setIsSupporting(true);
      setSupportCount((prev) => prev + 1);
      await addSupport(supabase, candidate.politician_id, user.id);
    }
  };

  const submitClaimRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingClaim(true);
    setClaimStatus("");
    const { error } = await requestCandidacyClaim(supabase, candidateId, {
      motivation: claimMotivation,
      contactEmail: claimContactEmail,
      socialMediaInfo: claimSocialMedia,
    });
    setSubmittingClaim(false);
    if (error) {
      setClaimStatus("Error: " + error.message);
      return;
    }
    setClaimSubmitted(true);
    setShowClaimForm(false);
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
    if (!newPostContent.trim() && !imageFile) return;
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

      const { data: newPost, error } = await createCandidatePost(supabase, {
        ghost_id: profile.current_ghost_id,
        content: newPostContent.trim(),
        election_candidate_id: candidateId,
        link_metadata: linkMetadata,
        image_url: finalImageUrl,
      });

      if (error) throw error;

      if (newPost?.id && mentionedPoliticianIds.length > 0) {
        await attachPostMentions(supabase, newPost.id, mentionedPoliticianIds);
      }

      trackPostCreated({
        hasImage: Boolean(finalImageUrl),
        hasVideo: false,
        hasLink: Boolean(linkMetadata),
        contentLength: newPostContent.trim().length,
      });

      setNewPostContent("");
      setMentionedPoliticianIds([]);
      setExtractedUrl(null);
      setLinkMetadata(null);
      setImageFile(null);
      setImagePreview(null);
      setComposerOpen(false);
      await loadPosts();
    } catch (err: any) {
      const msg = err?.message || err?.details || err?.hint || (typeof err === "object" ? JSON.stringify(err) : String(err));
      console.error("Error creating post:", msg, err);
      setPostError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Only snap the composer back to its compact one-line trigger when
  // there's nothing pending, mirroring the Feed/Wall composers.
  const closeComposerIfEmpty = () => {
    if (!newPostContent.trim() && !imageFile) {
      setComposerOpen(false);
      setPostError(null);
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
      await loadPosts();
    } catch (err) {
      const msg = (err as { message?: string })?.message || "Failed to post comment.";
      console.error("Error creating comment:", err);
      setCommentErrors((prev) => ({ ...prev, [postId]: msg }));
    }
  };

  const handleVote = async (postId: string, voteType: 1 | -1) => {
    if (!user) return;
    const { error } = await voteOnPost(supabase, postId, voteType);
    if (!error) {
      trackPostEngagement(voteType === 1 ? "upvote" : "downvote", postId);
      await loadPosts();
    }
  };

  const handleReport = async (targetType: ReportTargetType, targetId: string, abuseType: string) => {
    return reportContent(supabase, targetType, targetId, abuseType);
  };

  const handleCreateAnswerComment = async (answerId: string) => {
    const content = answerCommentInputs[answerId];
    if (!content?.trim()) return;

    let activeGhostId = profile?.current_ghost_id;
    if (!activeGhostId && user) {
      const { data: p } = await getOwnProfile(supabase, user.id);
      const rawP: any = p;
      activeGhostId = rawP?.current_ghost_id;
    }
    if (!activeGhostId) {
      alert("Please log in or complete onboarding to post anonymous comments.");
      return;
    }

    try {
      const { error } = await createAnswerComment(
        supabase,
        answerId,
        activeGhostId,
        content.trim()
      );
      if (error) throw error;

      setAnswerCommentInputs((prev) => ({ ...prev, [answerId]: "" }));
      setExpandedAnswerIds((prev) => new Set(prev).add(answerId));
      await loadAnswers();
    } catch (err: any) {
      console.error("Error creating answer comment:", err);
      alert("Failed to post comment: " + (err?.message || "Unknown error"));
    }
  };

  const toggleAnswerExpand = (answerId: string) => {
    setExpandedAnswerIds((prev) => {
      const next = new Set(prev);
      if (next.has(answerId)) next.delete(answerId);
      else next.add(answerId);
      return next;
    });
  };

  if (loading) return <Spinner fullPage />;

  if (!candidate) {
    return (
      <div className="w-full px-4 lg:px-8">
        <Card className="text-center py-12">
          <p className="text-text-muted">Candidate not found.</p>
          <Button onClick={() => router.push("/elections")} className="mt-4">
            Back to Elections
          </Button>
        </Card>
      </div>
    );
  }

  const isOwner = user && candidate?.politician_id === user.id;
  const isStubCandidate = candidate.is_unregistered;
  const displayName =
    candidate.display_name ||
    candidate.profiles?.full_name ||
    candidateProfile?.full_name ||
    getGhostDisplayName(candidate.profiles?.current_ghost_id);
  const avatarUrl = candidate.avatar_url || candidateProfile?.avatar_url;
  const partyName =
    candidate.party_name ||
    candidateProfile?.party_name ||
    candidateProfile?.political_parties?.name;

  return (
    <div className="w-full space-y-6">
      {/* Top Bar Navigation (if not embedded) */}
      {!embedded && (
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              router.push(
                `/elections/seat/${buildSeatSlug({ id: candidate.seat_id, ...candidate.election_seats })}`
              )
            }
            className="gap-2"
          >
            <ArrowLeft size={16} /> Back to Seat
          </Button>
        </div>
      )}

      {/* Positions Full-Page View */}
      {showPositionsModal ? (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPositionsModal(false)}
                className="gap-2 mb-4"
              >
                <ArrowLeft size={16} /> Back to Profile
              </Button>
              <h1 className="text-3xl font-bold text-text-main flex items-center gap-3">
                <HelpCircle size={32} className="text-accent" />
                {displayName}'s Positions
              </h1>
              <p className="text-sm text-text-muted mt-2">{answers.length} questions answered</p>
            </div>
          </div>

          {/* Positions Grid */}
          <div className="space-y-5">
            {answers.map((answer, idx) => {
              const q = answer.election_questions;
              const isExpanded = expandedAnswerIds.has(answer.id);
              const comments = answer.election_answer_comments || answer.comments || [];
              const singleOptionText =
                answer.option_text ||
                answer.election_question_options?.option_text ||
                null;
              const multipleOptionTexts =
                answer.selected_option_texts ||
                ([...(answer.election_candidate_answer_options || [])]
                  .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
                  .map((o) => o.election_question_options?.option_text)
                  .filter(Boolean) as string[]);

              return (
                <Card key={answer.id} padding="md" className="space-y-4 border-l-4 border-l-primary">
                  {/* Question Number & Type Badge */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary-light text-sm font-bold">
                          {idx + 1}
                        </span>
                        <Badge tone="neutral" className="text-xs">
                          {q?.question_type === "single_choice"
                            ? "Yes/No"
                            : q?.question_type === "multiple_choice"
                            ? "Multiple Choice"
                            : q?.question_type === "ranking"
                            ? "Priority Ranking"
                            : q?.question_type === "rating"
                            ? "Rating"
                            : "Text"}
                        </Badge>
                      </div>
                      <h3 className="text-lg font-bold text-text-main leading-snug">
                        {q?.question_text}
                      </h3>
                    </div>
                  </div>

                  {/* Answer */}
                  <div className="pt-4 border-t border-border-light/20">
                    <AnswerValue
                      questionType={q?.question_type}
                      optionText={singleOptionText}
                      selectedOptionTexts={multipleOptionTexts}
                      textAnswer={answer.text_answer}
                      ratingValue={answer.rating_value}
                    />
                  </div>

                  {/* Context/Elaboration */}
                  {answer.context_text && (
                    <div className="pt-4 border-t border-border-light/20">
                      <p className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wider">Context:</p>
                      <p className="text-base text-text-secondary whitespace-pre-wrap leading-relaxed italic">
                        "{answer.context_text}"
                      </p>
                    </div>
                  )}

                  {/* Video Answer */}
                  {answer.video_url && (
                    <div className="pt-4 border-t border-border-light/20">
                      <p className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wider">Video Explanation:</p>
                      <div className="rounded-lg overflow-hidden border border-border-light/30 bg-black">
                        <video
                          src={answer.video_url}
                          controls
                          className="w-full max-h-96 object-contain"
                        />
                      </div>
                    </div>
                  )}

                  {/* Comments Section */}
                  <div className="pt-4 border-t border-border-light/20">
                    <button
                      onClick={() => toggleAnswerExpand(answer.id)}
                      className="flex items-center gap-2 text-sm text-text-muted hover:text-text-main transition-colors font-medium"
                    >
                      <MessageSquare size={16} />
                      <span>
                        {comments.length} comment{comments.length !== 1 ? "s" : ""}
                      </span>
                      {isExpanded ? (
                        <ChevronUp size={16} />
                      ) : (
                        <ChevronDown size={16} />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="mt-4 space-y-4 pl-4 border-l border-primary/20">
                        {comments.map((c) => (
                          <div key={c.id} className="space-y-1.5">
                            <span className="font-mono font-bold text-text-muted text-xs">
                              {getGhostDisplayName(c.ghost_id)}
                            </span>
                            <p className="text-sm text-text-secondary leading-relaxed">{c.content}</p>
                          </div>
                        ))}

                        {user && (
                          <div className="flex items-center gap-2 pt-3 mt-3 border-t border-border-light/15">
                            <Input
                              placeholder="Comment on this position..."
                              value={answerCommentInputs[answer.id] || ""}
                              onChange={(e) =>
                                setAnswerCommentInputs({
                                  ...answerCommentInputs,
                                  [answer.id]: e.target.value,
                                })
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleCreateAnswerComment(answer.id);
                                }
                              }}
                              className="flex-1"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                handleCreateAnswerComment(answer.id)
                              }
                              disabled={
                                !answerCommentInputs[answer.id]?.trim()
                              }
                            >
                              <Send size={16} />
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        /* Main Two-Column Layout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Candidate Info & Campaign Details */}
        <div className="lg:col-span-5 space-y-6">
          <Card padding="md" className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <Avatar src={avatarUrl} name={displayName} size="lg" />
                <div>
                  <h1 className="text-xl font-bold text-text-main flex items-center gap-2">
                    {displayName}
                  </h1>
                  {ratingSummary && candidate?.politician_id && (
                    <button
                      type="button"
                      onClick={() => setShowInlineRating((v) => !v)}
                      className="mt-1 cursor-pointer hover:opacity-80 transition-opacity"
                      title="Rate this candidate"
                    >
                      <StarRating value={ratingSummary.avg} count={ratingSummary.count} size="sm" />
                    </button>
                  )}
                  {partyName && (
                    <Badge tone="primary" className="mt-1">
                      {partyName}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap shrink-0">
                {candidate.profiles?.current_ghost_id && (
                  <Link
                    href={`/wall/${resolvePoliticianWallSlug(candidate, displayName, candidate.election_seats?.role_title)}`}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs border-primary/30 text-primary-light hover:bg-primary/10 shrink-0"
                      title={`View ${displayName}'s full Politician Wall`}
                    >
                      <ExternalLink size={13} />
                      View Politician Wall
                    </Button>
                  </Link>
                )}

                {/* Support Button */}
                <Button
                  variant={isSupporting ? "primary" : "outline"}
                  size="sm"
                  onClick={toggleSupport}
                  className="gap-1.5 shrink-0"
                >
                  <Heart
                    size={14}
                    className={isSupporting ? "fill-current" : ""}
                  />
                  {supportCount > 0 ? supportCount : "Support"}
                </Button>
              </div>
            </div>

            {/* Inline "leave a review" panel — expands in place instead of
                a popup, so rating never navigates away from the candidate's
                tab (see PoliticianWallClient for the same pattern). */}
            {showInlineRating && candidate?.politician_id && (
              <PoliticianInlineRating
                politicianId={candidate.politician_id}
                politicianName={displayName}
                onSubmitted={refreshRatingSummary}
                onCancel={() => setShowInlineRating(false)}
              />
            )}

            {/* Nomination Status */}
            <div className="pt-3 border-t border-border-light/20 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                {candidate.nomination_filed ? (
                  <span className="text-accent flex items-center gap-1 font-semibold">
                    <CheckCircle2 size={14} /> Papers Filed
                  </span>
                ) : (
                  <span className="text-text-muted flex items-center gap-1">
                    <Circle size={14} /> Nomination Pending
                  </span>
                )}
              </div>

              {isOwner && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleNominationFiled}
                  className="text-xs"
                >
                  Toggle Status
                </Button>
              )}
            </div>

            {/* Stub candidate invite notice */}
            {isStubCandidate && (
              <Alert tone="warning" className="text-xs">
                <div className="space-y-2">
                <p className="font-medium">
                  Listed by verified election administrator.
                </p>
                {user && !claimSubmitted && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowClaimForm((v) => !v)}
                    className="w-full text-xs"
                  >
                    <UserCheck size={13} className="mr-1" /> This is me — Claim Candidacy
                  </Button>
                )}

                {showClaimForm && (
                  <form onSubmit={submitClaimRequest} className="space-y-2 pt-2">
                    <Input
                      placeholder="Contact Email"
                      value={claimContactEmail}
                      onChange={(e) => setClaimContactEmail(e.target.value)}
                      required
                      className="text-xs"
                    />
                    <Input
                      placeholder="Social Media / Proof Link"
                      value={claimSocialMedia}
                      onChange={(e) => setClaimSocialMedia(e.target.value)}
                      className="text-xs"
                    />
                    <Textarea
                      placeholder="Why are you claiming this candidacy?"
                      value={claimMotivation}
                      onChange={(e) => setClaimMotivation(e.target.value)}
                      rows={2}
                      className="text-xs"
                    />
                    {claimStatus && (
                      <p className="text-[11px] text-danger">{claimStatus}</p>
                    )}
                    <Button type="submit" size="sm" disabled={submittingClaim} className="w-full">
                      {submittingClaim ? "Submitting..." : "Submit Claim Request"}
                    </Button>
                  </form>
                )}

                {claimSubmitted && (
                  <p className="text-xs text-accent font-medium pt-1">
                    Claim request submitted for review.
                  </p>
                )}
                </div>
              </Alert>
            )}

            {/* Details list */}
            <div className="space-y-2 text-xs text-text-secondary pt-2">
              {(candidate.hometown || candidateProfile?.hometown) && (
                <div className="flex items-center gap-2">
                  <Home size={14} className="text-text-muted shrink-0" />
                  <span>Hometown: {candidate.hometown || candidateProfile?.hometown}</span>
                </div>
              )}
              {(candidate.education || candidateProfile?.education) && (
                <div className="flex items-center gap-2">
                  <GraduationCap size={14} className="text-text-muted shrink-0" />
                  <span>Education: {candidate.education || candidateProfile?.education}</span>
                </div>
              )}
            </div>

            {/* Platform statement */}
            {candidate.statement && (
              <div className="pt-3 border-t border-border-light/20 space-y-1">
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">
                  Why I&apos;m Running
                </h3>
                <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
                  {candidate.statement}
                </p>
              </div>
            )}

            {/* Intro video */}
            {candidate.intro_video_url && (
              <div className="pt-3 border-t border-border-light/20 space-y-2">
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                  <Video size={13} className="text-accent" /> Introductory Campaign Video Pitch
                </h3>
                <div className="rounded-xl overflow-hidden border border-border-light/40 bg-black">
                  <video
                    src={candidate.intro_video_url}
                    controls
                    className="w-full max-h-64 object-contain"
                  />
                </div>
              </div>
            )}

            {/* CTA Button for Positions */}
            {answers.length > 0 && (
              <div className="pt-3 border-t border-border-light/20">
                <Button
                  onClick={() => setShowPositionsModal(true)}
                  className="w-full"
                  size="sm"
                >
                  <HelpCircle size={14} className="mr-1.5" />
                  See How They Stand ({answers.length} Positions)
                </Button>
              </div>
            )}
          </Card>

        </div>

        {/* Right Column: Wall Feed & Composer */}
        <div className="lg:col-span-7 space-y-6">
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
                      ? "Post an update to your campaign wall..."
                      : "Ask the candidate a question or leave a message..."}
                  </span>
                  <ImageIcon size={18} className="shrink-0 text-text-muted" aria-hidden="true" />
                </button>
              ) : (
              <form onSubmit={handleCreatePost} className="space-y-3">
                <MentionTextarea
                  supabase={supabase}
                  placeholder={
                    isOwner
                      ? "Post an update to your campaign wall... Type @ to tag a politician"
                      : "Ask the candidate a question or leave a message... Type @ to tag a politician"
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

                <div className="flex items-center justify-between pt-2">
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

          {posts.length === 0 ? (
            <EmptyState description="No posts on this candidate wall yet." />
          ) : (
            <div className="space-y-6">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  ownerGhostId={candidate?.profiles?.current_ghost_id ?? profile?.current_ghost_id}
                  ownerBadgeLabel="Candidate"
                  viewerIsOwner={isOwner}
                  showVoteBar
                  onVote={(postId, voteType) => handleVote(postId, voteType)}
                  canComment={!!user}
                  commentValue={commentInputs[post.id] || ""}
                  onCommentChange={(text) =>
                    setCommentInputs({ ...commentInputs, [post.id]: text })
                  }
                  onSubmitComment={() => handleCreateComment(post.id)}
                  onMediaClick={(url, type) => setMediaPreview({ url, type })}
                  politicianAuthor={
                    politicianAuthors.get(post.ghost_id) ??
                    (post.ghost_id === candidate?.profiles?.current_ghost_id && candidate?.display_name
                      ? {
                          fullName: candidate.display_name,
                          wallHref: `/wall/${resolvePoliticianWallSlug(candidate, candidate.display_name, candidate.election_seats?.role_title)}`,
                        }
                      : null)
                  }
                  onReport={handleReport}
                  commentError={commentErrors[post.id]}
                  mentions={postMentions.get(post.id)}
                  mentionBadge={mentionOnlyPostIds.has(post.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {mediaPreview && (
        <StoryViewerModal
          url={mediaPreview.url}
          type={mediaPreview.type}
          onClose={() => setMediaPreview(null)}
        />
      )}

    </div>
  );
}
