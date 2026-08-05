"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import LinkPreview from "./LinkPreview";
import PostCard, { type PostWithComments } from "@/components/features/PostCard";
import {
  Users,
  Heart,
  QrCode,
  Image as ImageIcon,
  X,
  Video,
  Flag,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import VideoRecorder from "./VideoRecorder";
import { getOwnProfile } from "@/lib/services/profile";
import {
  getWallOwnerProfile,
  getSupportStatus,
  getSupporterCount,
  withdrawSupport,
  addSupport,
  getSupportersList,
  getWallPosts,
  createWallPost,
  subscribeToSupportChanges,
  unsubscribeFromSupportChanges,
} from "@/lib/services/politicianWall";
import { uploadPostImage, createComment, hydratePoliticianAuthors } from "@/lib/services/feed";
import { reportContent, type ReportTargetType } from "@/lib/services/moderation";
import {
  Card,
  Button,
  Badge,
  Textarea,
  Spinner,
  Modal,
  StoryViewerModal,
  RemoveMediaButton,
  Avatar,
  EmptyState,
} from "@/components/primitives";
import ReportDialog from "./ReportDialog";
import { createClient } from "@/lib/supabase/client";

interface WallOwnerRecord {
  id: string;
  full_name: string;
  party_name?: string;
  bio?: string;
  avatar_url?: string;
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
}

export default function PoliticianWallClient({
  ghostId,
  initialWallOwner = null,
  initialPosts = [],
  initialSupportCount = 0,
}: PoliticianWallClientProps) {
  const supabase = createClient();
  const { user } = useAuth();
  const router = useRouter();

  const [wallOwner, setWallOwner] = useState<WallOwnerRecord | null>(initialWallOwner);
  const [profile, setProfile] = useState<{ id: string; current_ghost_id: string } | null>(null);
  const [posts, setPosts] = useState<PostWithComments[]>(initialPosts);
  const [loading, setLoading] = useState(!initialWallOwner);
  const [newPostContent, setNewPostContent] = useState("");
  const [extractedUrl, setExtractedUrl] = useState<string | null>(null);
  const [linkMetadata, setLinkMetadata] = useState<{ url: string; title?: string; description?: string; image?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [supportCount, setSupportCount] = useState(initialSupportCount);
  const [isSupporting, setIsSupporting] = useState(false);
  const [showSupporters, setShowSupporters] = useState(false);
  const [supportersList, setSupportersList] = useState<SupporterRecord[]>([]);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showRecorder, setShowRecorder] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [commentErrors, setCommentErrors] = useState<Record<string, string>>({});
  const [showReportProfile, setShowReportProfile] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<{ url: string; type: "image" | "video" } | null>(null);

  const [politicianAuthors, setPoliticianAuthors] = useState<Map<string, { fullName: string; wallHref: string }>>(new Map());

  const fetchPosts = async () => {
    try {
      const { data, error } = await getWallPosts(supabase, ghostId);
      if (error) throw error;
      const postRows = (data as PostWithComments[]) || [];
      setPosts(postRows);
      const map = await hydratePoliticianAuthors(supabase, postRows);
      if (ghostId && wallOwner?.full_name) {
        map.set(ghostId, { fullName: wallOwner.full_name, wallHref: `/wall/${ghostId}` });
      }
      setPoliticianAuthors(map);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let supportChannel: ReturnType<typeof subscribeToSupportChanges> | null = null;
    let isMounted = true;

    async function loadWall() {
      if (!ghostId) return;
      if (!wallOwner) setLoading(true);

      if (user) {
        const { data: myProfile } = await getOwnProfile(supabase, user.id);
        if (isMounted) setProfile(myProfile as { id: string; current_ghost_id: string } | null);
      }

      const { data: owner } = await getWallOwnerProfile(supabase, ghostId);
      const ownerRecord = owner as WallOwnerRecord | null;

      if (ownerRecord) {
        if (isMounted) setWallOwner(ownerRecord);
        if (ownerRecord.id) {
          if (user) {
            const { data: mySupport } = await getSupportStatus(
              supabase,
              ownerRecord.id,
              user.id
            );
            if (isMounted) setIsSupporting(!!mySupport);
          }
          const { count } = await getSupporterCount(supabase, ownerRecord.id);
          if (isMounted) setSupportCount(count || 0);

          supportChannel = subscribeToSupportChanges(supabase, ownerRecord.id, () => {
            getSupporterCount(supabase, ownerRecord.id).then(({ count }) => {
              if (isMounted) setSupportCount(count || 0);
            });
          });
        }
      }

      const { data: postRows, error: postErr } = await getWallPosts(supabase, ghostId);
      if (!postErr && isMounted) {
        const rows = (postRows as PostWithComments[]) || [];
        setPosts(rows);
        const map = await hydratePoliticianAuthors(supabase, rows);
        if (ghostId && ownerRecord?.full_name) {
          map.set(ghostId, { fullName: ownerRecord.full_name, wallHref: `/wall/${ghostId}` });
        }
        if (isMounted) setPoliticianAuthors(map);
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
    if (!newPostContent.trim() || !profile?.current_ghost_id) return;

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

      const { error } = await createWallPost(supabase, {
        content: newPostContent.trim(),
        wallGhostId: ghostId,
        linkMetadata,
        imageUrl: finalImageUrl,
        videoUrl,
      });

      if (error) throw error;

      setNewPostContent("");
      setExtractedUrl(null);
      setLinkMetadata(null);
      setImageFile(null);
      setImagePreview(null);
      await fetchPosts();
    } catch (err) {
      console.error("Error creating post:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateComment = async (postId: string) => {
    const content = commentInputs[postId];
    if (!content?.trim() || !profile?.current_ghost_id) return;

    setCommentErrors((prev) => ({ ...prev, [postId]: "" }));
    try {
      const { error } = await createComment(supabase, postId, content.trim());
      if (error) throw error;

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

  if (loading) return <Spinner fullPage />;

  const isOwner = user && wallOwner?.id === user.id;
  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <div className="w-full max-w-none pb-20 px-4 lg:px-8 space-y-6">
      {/* Wall Header Card */}
      <Card padding="md" className="space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Avatar src={wallOwner?.avatar_url} name={wallOwner?.full_name || "P"} size="xl" />
            <div>
              <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
                {wallOwner?.full_name || "Politician Wall"}
                <Badge tone="primary">Politician</Badge>
              </h1>
              {wallOwner?.party_name && (
                <p className="text-xs text-text-muted mt-0.5">
                  {wallOwner.party_name}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={isSupporting ? "primary" : "outline"}
              size="sm"
              onClick={toggleSupport}
              className="gap-1.5"
            >
              <Heart
                size={14}
                className={isSupporting ? "fill-current" : ""}
              />
              {supportCount > 0 ? supportCount : "Support"}
            </Button>

            {isOwner && (
              <Button
                variant="ghost"
                size="sm"
                onClick={loadSupportersDashboard}
                className="gap-1 text-xs"
              >
                <Users size={14} /> Supporters Dashboard
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowQr(true)}
              className="p-2"
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
              >
                <Flag size={14} />
              </Button>
            )}
          </div>
        </div>

        {wallOwner?.bio && (
          <p className="text-sm text-text-secondary pt-3 border-t border-border-light/20 leading-relaxed">
            {wallOwner.bio}
          </p>
        )}
      </Card>

      {/* Post Composer */}
      {user && profile?.current_ghost_id && (
        <Card padding="md">
          <form onSubmit={handleCreatePost} className="space-y-3">
            <Textarea
              placeholder={
                isOwner
                  ? "Post an update to your public wall..."
                  : "Leave a post or message for this representative..."
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

              <Button type="submit" disabled={submitting}>
                {submitting ? "Posting..." : "Post to Wall"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Wall Post Feed */}
      {posts.length === 0 ? (
        <EmptyState description="No posts on this wall yet." />
      ) : (
        <div className="space-y-6">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              ownerGhostId={ghostId}
              ownerBadgeLabel="Politician"
              viewerIsOwner={isOwner}
              canComment={!!user}
              commentValue={commentInputs[post.id] || ""}
              onCommentChange={(text) =>
                setCommentInputs({ ...commentInputs, [post.id]: text })
              }
              onSubmitComment={() => handleCreateComment(post.id)}
              onMediaClick={(url, type) => setMediaPreview({ url, type })}
              politicianAuthor={
                politicianAuthors.get(post.ghost_id) ??
                (post.ghost_id === ghostId && wallOwner?.full_name
                  ? { fullName: wallOwner.full_name, wallHref: `/wall/${ghostId}` }
                  : null)
              }
              onReport={handleReport}
              commentError={commentErrors[post.id]}
            />
          ))}
        </div>
      )}

      {showReportProfile && wallOwner?.id && (
        <ReportDialog
          targetType="politician_profile"
          targetId={wallOwner.id}
          onReport={handleReport}
          onClose={() => setShowReportProfile(false)}
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
    </div>
  );
}
