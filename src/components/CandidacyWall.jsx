import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LinkPreview from './LinkPreview';
import { getGhostDisplayName } from '../utils/ghostName';
import VideoRecorder from './video/VideoRecorder';
import WallPostFeed from './wall/WallPostFeed';
import { getPublicCandidateById, getPublicCandidateAnswers, getCandidatePosts, createCandidatePost, updateNominationFiled } from '../services/elections';
import { getOwnProfile, getPoliticianProfile } from '../services/profile';
import { uploadPostImage, createComment } from '../services/feed';
import {
  getSupportStatus, getSupporterCount, withdrawSupport, addSupport
} from '../services/politicianWall';
import { MapPin, ArrowLeft, ShieldAlert, GraduationCap, Home, Image as ImageIcon, X, Vote, Video, HelpCircle, Heart, CheckCircle2, Circle } from 'lucide-react';
import { Card, Button, Badge, Textarea, Spinner } from './ui';

export default function CandidacyWall({ candidateId: candidateIdProp, embedded = false } = {}) {
  const { candidateId: paramCandidateId } = useParams();
  const candidateId = candidateIdProp ?? paramCandidateId;
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [candidate, setCandidate] = useState(null);
  const [candidateProfile, setCandidateProfile] = useState(null); // politician_profiles row
  const [answers, setAnswers] = useState([]); // visible-to-public questionnaire answers
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newPostContent, setNewPostContent] = useState('');
  const [extractedUrl, setExtractedUrl] = useState(null);
  const [linkMetadata, setLinkMetadata] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [showRecorder, setShowRecorder] = useState(false);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState(null);

  const [commentInputs, setCommentInputs] = useState({});

  const [supportCount, setSupportCount] = useState(0);
  const [isSupporting, setIsSupporting] = useState(false);

  const [activeStoryUrl, setActiveStoryUrl] = useState(null);

  const fetchAll = async () => {
    setLoading(true);

    if (user) {
      const { data: myProfile } = await getOwnProfile(user.id);
      setProfile(myProfile);
    } else {
      setProfile(null);
    }

    const { data: candidateRow } = await getPublicCandidateById(candidateId);

    if (candidateRow) {
      setCandidate(candidateRow);
      const { data: polProfile } = await getPoliticianProfile(candidateRow.politician_id);
      setCandidateProfile(polProfile);

      // RLS already withholds hidden-question answers from non-owner
      // viewers, but the owner's own "Candidates manage own answers" policy
      // lets them see everything (including admin-only-visible answers) —
      // filter to visible_to_public client-side too so the owner previews
      // exactly what voters actually see.
      const { data: answerRows } = await getPublicCandidateAnswers(candidateId);
      const visible = (answerRows || [])
        .filter(a => a.election_questions?.visible_to_public)
        .sort((a, b) => (a.election_questions?.rank ?? 0) - (b.election_questions?.rank ?? 0));
      setAnswers(visible);

      if (user) {
        const { data: mySupport } = await getSupportStatus(candidateRow.politician_id, user.id);
        setIsSupporting(!!mySupport);
      } else {
        setIsSupporting(false);
      }
      const { count } = await getSupporterCount(candidateRow.politician_id);
      setSupportCount(count || 0);
    } else {
      setCandidate(null);
    }

    await fetchPosts();
    setLoading(false);
  };

  const fetchPosts = async () => {
    const { data } = await getCandidatePosts(candidateId);
    // Comment pin-to-top ordering (candidate's own replies always lead) is
    // handled by WallPostFeed itself, keyed off the candidate's ghost id.
    setPosts(data || []);
  };

  useEffect(() => {
    if (!authLoading && candidateId) fetchAll();
  }, [user, authLoading, candidateId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleNominationFiled = async () => {
    const next = !candidate.nomination_filed;
    setCandidate(prev => ({ ...prev, nomination_filed: next }));
    await updateNominationFiled(candidateId, next);
  };

  const toggleSupport = async () => {
    if (!candidate) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    if (isSupporting) {
      setIsSupporting(false);
      setSupportCount(prev => Math.max(0, prev - 1));
      await withdrawSupport(candidate.politician_id, user.id);
    } else {
      setIsSupporting(true);
      setSupportCount(prev => prev + 1);
      await addSupport(candidate.politician_id, user.id);
    }
  };

  const handlePostChange = (e) => {
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

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPostContent.trim() && !imageFile && !uploadedVideoUrl) return;
    if (!profile?.current_ghost_id) return;

    setSubmitting(true);
    try {
      let finalImageUrl = null;
      if (imageFile) {
        const { publicUrl, error: uploadError } = await uploadPostImage(imageFile, profile.current_ghost_id);
        if (uploadError) {
          alert('Failed to upload image.');
          setSubmitting(false);
          return;
        }
        finalImageUrl = publicUrl;
      }

      const { error } = await createCandidatePost({
        ghost_id: profile.current_ghost_id,
        content: newPostContent.trim(),
        election_candidate_id: candidateId,
        link_metadata: linkMetadata,
        image_url: finalImageUrl,
        video_url: uploadedVideoUrl
      });
      if (error) throw error;

      setNewPostContent('');
      setExtractedUrl(null);
      setLinkMetadata(null);
      setImageFile(null);
      setImagePreview(null);
      setUploadedVideoUrl(null);
      setShowRecorder(false);
      fetchPosts();
    } catch (err) {
      console.error('Error creating post:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateComment = async (postId) => {
    const content = commentInputs[postId];
    if (!content?.trim() || !profile?.current_ghost_id) return;

    try {
      const { error } = await createComment(postId, profile.current_ghost_id, content.trim());
      if (error) throw error;

      setCommentInputs({ ...commentInputs, [postId]: '' });
      fetchPosts();
    } catch (err) {
      console.error('Error creating comment:', err);
    }
  };

  if (loading) {
    return <Spinner fullPage />;
  }

  if (!candidate) {
    return <div className="w-full text-center py-20 text-text-muted">Candidate not found.</div>;
  }

  const isOwner = !!user && candidate.politician_id === user.id;
  const seat = candidate.election_seats;
  const displayName = candidate.profiles?.full_name || getGhostDisplayName(candidate.profiles?.current_ghost_id);
  const candidateGhostId = candidate.profiles?.current_ghost_id;

  // Campaign video gallery — the required intro video from the application
  // step, followed by the candidate's own later video posts from this same
  // wall, newest first. No separate schema: reuses posts.video_url exactly
  // like the composer below already writes it.
  const videoGallery = [
    ...(candidate.intro_video_url ? [{ url: candidate.intro_video_url, label: 'Introduction' }] : []),
    ...posts
      .filter(p => p.video_url && p.ghost_id === candidateGhostId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(p => ({ url: p.video_url, label: new Date(p.created_at).toLocaleDateString() }))
  ];

  return (
    <div className={embedded ? 'w-full' : 'w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8'}>
      <div className={embedded ? 'w-full min-w-0' : 'w-full min-w-0 max-w-6xl mx-auto'}>

        {!embedded && (
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-text-muted hover:text-text-secondary mb-6 transition-colors">
            <ArrowLeft size={16} /> Back
          </button>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">

          {/* LEFT: profile column — sticks in place while the feed scrolls on wide screens */}
          <div className="space-y-6 min-w-0 lg:sticky lg:top-6">

            {/* Candidate Header */}
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <Vote size={14} className="text-primary" />
                <span className="text-xs text-text-muted">{seat?.elections?.name} · <span className="uppercase font-semibold">{seat?.elections?.status?.replace('_', ' ')}</span></span>
              </div>
              <h1 className="text-2xl font-bold text-text-main">{displayName}</h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge tone="primary" size="sm">{seat?.role_title}</Badge>
                <span className="flex items-center gap-1 text-text-muted text-sm">
                  <MapPin size={14} className="text-accent" /> {seat?.map_shapes?.name}
                </span>
                {isOwner && <Badge tone="primary">This is you</Badge>}
              </div>
              {candidateProfile?.political_parties?.name && (
                <p className="text-text-muted text-sm mt-1">{candidateProfile.political_parties.name}</p>
              )}

              {/* Nomination papers filed -- a self-reported, real-world fact,
                  distinct from the platform's own approval status. */}
              <div className="mt-3">
                {isOwner ? (
                  <button
                    onClick={toggleNominationFiled}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                      candidate.nomination_filed
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
                        : 'bg-surface-hover/60 text-text-muted border border-border-light hover:bg-surface-hover'
                    }`}
                  >
                    {candidate.nomination_filed ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                    {candidate.nomination_filed ? 'Nomination Papers Filed' : 'Mark Nomination Papers as Filed'}
                  </button>
                ) : candidate.nomination_filed ? (
                  <Badge tone="emerald" shape="pill" size="sm" uppercase={false} icon={<CheckCircle2 size={13} />}>
                    Nomination Papers Filed
                  </Badge>
                ) : (
                  <Badge tone="neutral" shape="pill" size="sm" uppercase={false} icon={<Circle size={13} />}>
                    Nomination Papers Not Yet Filed
                  </Badge>
                )}
              </div>

              {candidate.added_by_election_admin_id && (
                <p className="text-[10px] text-text-muted mt-2 italic">Added by an election administrator</p>
              )}

              {/* Support button */}
              <div className="mt-5 pt-5 border-t border-border-light/35 flex items-center gap-3 flex-wrap">
                <Button
                  variant={isSupporting ? 'danger' : 'outline'}
                  onClick={toggleSupport}
                  disabled={isOwner}
                >
                  <Heart size={16} className={isSupporting ? 'fill-current text-danger' : ''} />
                  {!user ? 'Sign in to Support' : isSupporting ? 'Supported' : 'I Support'}
                </Button>
                <div className="text-text-muted text-sm font-semibold">
                  {supportCount.toLocaleString()} Supporter{supportCount !== 1 ? 's' : ''}
                </div>
              </div>

              {(candidateProfile?.education || candidateProfile?.hometown) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 mt-5 pt-5 border-t border-border-light/35">
                  {candidateProfile?.education && (
                    <div className="flex items-start gap-2">
                      <GraduationCap size={16} className="text-accent shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Education</p>
                        <p className="text-sm text-text-secondary">{candidateProfile.education}</p>
                      </div>
                    </div>
                  )}
                  {candidateProfile?.hometown && (
                    <div className="flex items-start gap-2">
                      <Home size={16} className="text-accent shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Hometown</p>
                        <p className="text-sm text-text-secondary">{candidateProfile.hometown}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {candidate.statement && (
                <div className="mt-4 pt-4 border-t border-border-light/35">
                  <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider mb-1.5">Why I'm Running</p>
                  <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{candidate.statement}</p>
                </div>
              )}
              {candidateProfile?.bio && (
                <div className="mt-4 pt-4 border-t border-border-light/35">
                  <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider mb-1.5">Biography & Platform</p>
                  <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{candidateProfile.bio}</p>
                </div>
              )}
            </Card>

            {/* Campaign Video Gallery */}
            {videoGallery.length > 0 && (
              <Card>
                <h2 className="text-sm font-bold text-text-main mb-3 flex items-center gap-2"><Video size={16} className="text-primary" /> Campaign Videos</h2>
                <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {videoGallery.map((v, idx) => (
                    <button
                      key={`${v.url}-${idx}`}
                      onClick={() => setActiveStoryUrl(v.url)}
                      className="flex flex-col items-center min-w-[100px] group"
                    >
                      <div className="w-[100px] h-[150px] rounded-xl border-2 border-primary/50 group-hover:border-primary p-0.5 relative overflow-hidden bg-surface-hover flex-shrink-0 transition-all group-hover:scale-105 shadow-lg">
                        <video src={v.url} className="w-full h-full rounded-lg object-cover" muted preload="metadata" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent rounded-lg transition-opacity group-hover:opacity-80" />
                        <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5">
                          <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0 border border-primary-light">
                            <Video size={8} className="text-slate-950" />
                          </div>
                          <span className="text-[10px] text-white font-medium truncate drop-shadow-md">{v.label}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
            )}

            {/* Questionnaire Responses */}
            {answers.length > 0 && (
              <Card>
                <h2 className="text-sm font-bold text-text-main mb-4 flex items-center gap-2"><HelpCircle size={16} className="text-primary" /> Candidate Questionnaire</h2>
                <div className="space-y-4">
                  {answers.map(a => (
                    <div key={a.id} className="pb-4 border-b border-border-light/20 last:border-0 last:pb-0">
                      <p className="text-sm font-semibold text-text-secondary">{a.election_questions?.question_text}</p>
                      <p className="text-sm text-primary-light mt-1">{a.election_question_options?.option_text}</p>
                      {a.context_text && (
                        <p className="text-xs text-text-muted mt-1.5 italic whitespace-pre-wrap">"{a.context_text}"</p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* RIGHT: composer + feed */}
          <div className="space-y-6 min-w-0">
            {/* Post / Video Pitch Composer — requires an account to post anonymously as a ghost ID */}
            {!user ? (
              <Card padding="sm" className="text-center">
                <p className="text-sm text-text-muted">
                  <button onClick={() => navigate('/auth')} className="text-primary-light hover:underline font-semibold">Sign in</button> to join the discussion.
                </p>
              </Card>
            ) : (
            <Card as="form" onSubmit={handleCreatePost} variant="composer" padding="sm">
              <Textarea
                plain
                value={newPostContent}
                onChange={handlePostChange}
                placeholder={isOwner ? 'Post an update or video pitch...' : `Start a discussion with ${displayName}...`}
                className="min-h-[80px]"
                required={!imageFile && !uploadedVideoUrl}
              />

              {extractedUrl && <div className="mb-3"><LinkPreview url={extractedUrl} onMetadataFetched={setLinkMetadata} /></div>}

              {imagePreview && (
                <div className="relative mt-2 mb-2 inline-block">
                  <img src={imagePreview} alt="Preview" className="h-32 rounded-lg border border-border-light object-cover" />
                  <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }} className="absolute -top-2 -right-2 bg-danger text-white rounded-full p-1 shadow-lg hover:bg-danger-light">
                    <X size={14} />
                  </button>
                </div>
              )}

              {isOwner && showRecorder && (
                <VideoRecorder onVideoUploaded={(url) => { setUploadedVideoUrl(url); setShowRecorder(false); }} />
              )}

              {isOwner && uploadedVideoUrl && (
                <div className="mb-3 bg-primary/10 border border-primary/30 p-3 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2 text-primary-light text-sm font-medium">
                    <Video size={16} /> Video Attached
                  </div>
                  <button type="button" onClick={() => setUploadedVideoUrl(null)} className="text-primary-light hover:text-primary-lighter text-xs underline">Remove</button>
                </div>
              )}

              <div className="flex items-center justify-between mt-2 border-t border-border-light/50 pt-3">
                <span className="text-xs text-text-dark flex items-center gap-1">
                  <ShieldAlert size={12} /> Posting as Ghost ID
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    id="candidacy-image-upload"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        if (file.size > 5 * 1024 * 1024) return alert('Image must be less than 5MB');
                        setImageFile(file);
                        const reader = new FileReader();
                        reader.onloadend = () => setImagePreview(reader.result);
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <label htmlFor="candidacy-image-upload" className="p-2 text-text-muted hover:bg-surface-hover hover:text-primary-light rounded-lg cursor-pointer transition-colors" title="Attach Image">
                    <ImageIcon size={18} />
                  </label>
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => setShowRecorder(!showRecorder)}
                      className={`p-2 rounded-lg transition-colors ${showRecorder || uploadedVideoUrl ? 'bg-primary/20 text-primary-light' : 'text-text-muted hover:bg-surface-hover hover:text-primary-light'}`}
                      title="Post a Campaign Video Update"
                    >
                      <Video size={18} />
                    </button>
                  )}
                  <Button
                    type="submit"
                    size="sm"
                    disabled={submitting || (!newPostContent.trim() && !imageFile && !uploadedVideoUrl)}
                  >
                    {submitting ? 'Posting...' : 'Post anonymously'}
                  </Button>
                </div>
              </div>
            </Card>
            )}

            {/* Feed */}
            <WallPostFeed
              posts={posts}
              ownerGhostId={candidateGhostId}
              ownerBadgeLabel="Candidate"
              viewerIsOwner={isOwner}
              canComment={!!user}
              emptyMessage={isOwner ? 'No posts yet. Share your first pitch above.' : 'No posts yet. Be the first to start a discussion.'}
              commentInputs={commentInputs}
              onCommentInputChange={(postId, value) => setCommentInputs({ ...commentInputs, [postId]: value })}
              onSubmitComment={handleCreateComment}
            />
          </div>
        </div>

        {/* Full Screen Video Modal */}
        {activeStoryUrl && (
          <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="relative max-w-sm w-full bg-surface rounded-2xl overflow-hidden shadow-2xl border border-border-light">
              <button
                onClick={() => setActiveStoryUrl(null)}
                className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center bg-black/50 hover:bg-black/80 rounded-full text-white transition-colors"
              >
                ✕
              </button>
              <video src={activeStoryUrl} controls autoPlay className="w-full max-h-[85vh] object-contain bg-black" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
