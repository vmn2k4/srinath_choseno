"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import LinkPreview from "./LinkPreview";
import AnswerValue from "./AnswerValue";
import { getGhostDisplayName } from "@/lib/utils/ghostName";
import PostCard, { type PostWithComments } from "@/components/features/PostCard";
import {
  getPublicCandidateById,
  getPublicCandidateAnswers,
  getCandidacyWallPosts,
  createCandidatePost,
  createAnswerComment,
  updateNominationFiled,
  requestCandidacyClaim,
} from "@/lib/services/elections";
import { getOwnProfile, getPoliticianProfile } from "@/lib/services/profile";
import { uploadPostImage, createComment } from "@/lib/services/feed";
import {
  getSupportStatus,
  getSupporterCount,
  withdrawSupport,
  addSupport,
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
} from "@/components/primitives";
import { createClient } from "@/lib/supabase/client";

interface CandidateRecord {
  id: string;
  seat_id: string;
  politician_id: string;
  display_name: string;
  party_name?: string;
  hometown?: string;
  education?: string;
  statement?: string;
  video_url?: string;
  avatar_url?: string;
  nomination_filed?: boolean;
  is_unregistered?: boolean;
  profiles?: {
    id?: string;
    full_name?: string;
    current_ghost_id?: string;
  };
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

  const [profile, setProfile] = useState<{ id: string; current_ghost_id: string } | null>(null);
  const [candidate, setCandidate] = useState<CandidateRecord | null>(initialCandidate);
  const [candidateProfile, setCandidateProfile] = useState<any>(initialCandidateProfile);
  const [answers, setAnswers] = useState<QuestionnaireAnswer[]>(initialAnswers);
  const [posts, setPosts] = useState<PostWithComments[]>(initialPosts);
  const [loading, setLoading] = useState(!initialCandidate);

  const [newPostContent, setNewPostContent] = useState("");
  const [extractedUrl, setExtractedUrl] = useState<string | null>(null);
  const [linkMetadata, setLinkMetadata] = useState<{ url: string; title?: string; description?: string; image?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [expandedAnswerIds, setExpandedAnswerIds] = useState<Set<string>>(
    () => new Set()
  );
  const [answerCommentInputs, setAnswerCommentInputs] = useState<
    Record<string, string>
  >({});

  const [supportCount, setSupportCount] = useState(initialSupportCount);
  const [isSupporting, setIsSupporting] = useState(false);

  // Claim request state
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [claimMotivation, setClaimMotivation] = useState("");
  const [claimContactEmail, setClaimContactEmail] = useState("");
  const [claimSocialMedia, setClaimSocialMedia] = useState("");
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [claimStatus, setClaimStatus] = useState("");
  const [claimSubmitted, setClaimSubmitted] = useState(false);
  const [activeStoryUrl, setActiveStoryUrl] = useState<string | null>(null);

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

  const loadPosts = async (ghostId?: string) => {
    const targetGhostId = ghostId ?? candidate?.profiles?.current_ghost_id;
    const { data } = await getCandidacyWallPosts(supabase, candidateId, targetGhostId);
    setPosts((data as PostWithComments[]) || []);
  };

  useEffect(() => {
    let isMounted = true;

    async function loadAll() {
      if (authLoading || !candidateId) return;
      if (!candidate) setLoading(true);

      if (user) {
        const { data: myProfile } = await getOwnProfile(supabase, user.id);
        if (isMounted) setProfile(myProfile as { id: string; current_ghost_id: string } | null);
      } else {
        if (isMounted) setProfile(null);
      }

      const { data: candidateRow } = await getPublicCandidateById(supabase, candidateId);
      const cand = candidateRow as CandidateRecord | null;

      if (cand) {
        if (isMounted) setCandidate(cand);
        if (cand.politician_id) {
          const { data: polProfile } = await getPoliticianProfile(supabase, cand.politician_id);
          if (isMounted) setCandidateProfile(polProfile);

          if (user) {
            const { data: mySupport } = await getSupportStatus(
              supabase,
              cand.politician_id,
              user.id
            );
            if (isMounted) setIsSupporting(!!mySupport);
          } else {
            if (isMounted) setIsSupporting(false);
          }
          const { count } = await getSupporterCount(supabase, cand.politician_id);
          if (isMounted) setSupportCount(count || 0);
        }

        const { data: answerRows } = await getPublicCandidateAnswers(supabase, candidateId);
        const visible = ((answerRows as unknown as QuestionnaireAnswer[]) || [])
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

  const handlePostChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim() && !imageFile) return;
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

      const { error } = await createCandidatePost(supabase, {
        ghost_id: profile.current_ghost_id,
        content: newPostContent.trim(),
        election_candidate_id: candidateId,
        link_metadata: linkMetadata,
        image_url: finalImageUrl,
      });

      if (error) throw error;

      setNewPostContent("");
      setExtractedUrl(null);
      setLinkMetadata(null);
      setImageFile(null);
      setImagePreview(null);
      await loadPosts();
    } catch (err) {
      console.error("Error creating post:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateComment = async (postId: string) => {
    const content = commentInputs[postId];
    if (!content?.trim() || !profile?.current_ghost_id) return;

    try {
      const { error } = await createComment(
        supabase,
        postId,
        profile.current_ghost_id,
        content.trim()
      );
      if (error) throw error;

      setCommentInputs({ ...commentInputs, [postId]: "" });
      await loadPosts();
    } catch (err) {
      console.error("Error creating comment:", err);
    }
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
            onClick={() => router.push(`/elections/seat/${candidate.seat_id}`)}
            className="gap-2"
          >
            <ArrowLeft size={16} /> Back to Seat
          </Button>
        </div>
      )}

      {/* Main Two-Column Layout */}
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
                  {partyName && (
                    <Badge tone="primary" className="mt-1">
                      {partyName}
                    </Badge>
                  )}
                </div>
              </div>

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
            {candidate.video_url && (
              <div className="pt-3 border-t border-border-light/20 space-y-2">
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                  <Video size={13} className="text-accent" /> Campaign Video
                </h3>
                <div className="rounded-xl overflow-hidden border border-border-light/40 bg-black">
                  <video
                    src={candidate.video_url}
                    controls
                    className="w-full max-h-64 object-contain"
                  />
                </div>
              </div>
            )}
          </Card>

          {/* Questionnaire Answers */}
          {answers.length > 0 && (
            <Card padding="md" className="space-y-4">
              <h2 className="text-sm font-bold text-text-main flex items-center gap-2">
                <HelpCircle size={16} className="text-accent" /> Candidate Positions
              </h2>

              <div className="space-y-4">
                {answers.map((answer) => {
                  const q = answer.election_questions;
                  const isExpanded = expandedAnswerIds.has(answer.id);
                  const comments = answer.election_answer_comments || answer.comments || [];
                  const singleOptionText =
                    answer.option_text ||
                    answer.election_question_options?.option_text ||
                    null;
                  const multipleOptionTexts =
                    answer.selected_option_texts ||
                    (answer.election_candidate_answer_options || [])
                      .map((o) => o.election_question_options?.option_text)
                      .filter(Boolean) as string[];

                  return (
                    <div
                      key={answer.id}
                      className="p-3 bg-surface/30 border border-border-light/20 rounded-xl space-y-2"
                    >
                      <p className="text-xs font-semibold text-text-secondary">
                        {q?.question_text}
                      </p>

                      <AnswerValue
                        questionType={q?.question_type}
                        optionText={singleOptionText}
                        selectedOptionTexts={multipleOptionTexts}
                        textAnswer={answer.text_answer}
                        ratingValue={answer.rating_value}
                      />

                      {answer.context_text && (
                        <p className="text-xs text-text-muted mt-1 italic whitespace-pre-wrap">
                          &quot;{answer.context_text}&quot;
                        </p>
                      )}

                      {answer.video_url && (
                        <div className="mt-2 rounded-lg overflow-hidden border border-border-light/30 bg-black">
                          <video
                            src={answer.video_url}
                            controls
                            className="w-full max-h-48 object-contain"
                          />
                        </div>
                      )}

                      <div className="pt-2 border-t border-border-light/15 flex items-center justify-between text-[11px] text-text-muted">
                        <button
                          onClick={() => toggleAnswerExpand(answer.id)}
                          className="flex items-center gap-1 hover:text-text-main transition-colors"
                        >
                          <MessageSquare size={12} />
                          <span>
                            {comments.length} comment
                            {comments.length !== 1 ? "s" : ""}
                          </span>
                          {isExpanded ? (
                            <ChevronUp size={12} />
                          ) : (
                            <ChevronDown size={12} />
                          )}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="pt-2 space-y-3 pl-2 border-l border-primary/20">
                          {comments.map((c) => (
                            <div key={c.id} className="text-xs space-y-0.5">
                              <span className="font-mono font-bold text-text-muted text-[11px]">
                                {getGhostDisplayName(c.ghost_id)}
                              </span>
                              <p className="text-text-tertiary">{c.content}</p>
                            </div>
                          ))}

                          {user && (
                            <div className="flex items-center gap-2 pt-1">
                              <Input
                                placeholder="Comment on this stance..."
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
                                className="flex-1 text-xs"
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
                                <Send size={13} />
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        {/* Right Column: Wall Feed & Composer */}
        <div className="lg:col-span-7 space-y-6">
          {user && profile?.current_ghost_id && (
            <Card padding="md">
              <form onSubmit={handleCreatePost} className="space-y-3">
                <Textarea
                  placeholder={
                    isOwner
                      ? "Post an update to your campaign wall..."
                      : "Ask the candidate a question or leave a message..."
                  }
                  value={newPostContent}
                  onChange={handlePostChange}
                  rows={3}
                />

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

                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Posting..." : "Post to Wall"}
                  </Button>
                </div>
              </form>
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
                  canComment={!!user}
                  commentValue={commentInputs[post.id] || ""}
                  onCommentChange={(text) =>
                    setCommentInputs({ ...commentInputs, [post.id]: text })
                  }
                  onSubmitComment={() => handleCreateComment(post.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {activeStoryUrl && (
        <StoryViewerModal
          url={activeStoryUrl}
          onClose={() => setActiveStoryUrl(null)}
        />
      )}
    </div>
  );
}
