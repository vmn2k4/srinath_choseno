import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import LinkPreview from './LinkPreview';
import VideoRecorder from './video/VideoRecorder';
import { MapPin, Users, ArrowLeft, ShieldAlert, GraduationCap, Home, Image as ImageIcon, X, Vote, Video, HelpCircle } from 'lucide-react';

export default function CandidacyWall() {
  const { candidateId } = useParams();
  const { user } = useAuth();
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

  const fetchAll = async () => {
    setLoading(true);

    const { data: myProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setProfile(myProfile);

    const { data: candidateRow } = await supabase
      .from('election_candidates')
      .select(`
        id, statement, politician_id, status, intro_video_url,
        election_seats ( role_title, map_shapes ( name, boundary_type ), elections ( name, status ) ),
        profiles!election_candidates_politician_id_fkey ( full_name, current_ghost_id )
      `)
      .eq('id', candidateId)
      .maybeSingle();

    if (candidateRow) {
      setCandidate(candidateRow);
      const { data: polProfile } = await supabase
        .from('politician_profiles')
        .select('education, hometown, bio, political_parties(name)')
        .eq('id', candidateRow.politician_id)
        .maybeSingle();
      setCandidateProfile(polProfile);

      // RLS already withholds hidden-question answers from non-owner
      // viewers, but the owner's own "Candidates manage own answers" policy
      // lets them see everything (including admin-only-visible answers) —
      // filter to visible_to_public client-side too so the owner previews
      // exactly what voters actually see.
      const { data: answerRows } = await supabase
        .from('election_candidate_answers')
        .select('id, context_text, election_questions(id, question_text, rank, visible_to_public), election_question_options(option_text)')
        .eq('candidate_id', candidateId);
      const visible = (answerRows || [])
        .filter(a => a.election_questions?.visible_to_public)
        .sort((a, b) => (a.election_questions?.rank ?? 0) - (b.election_questions?.rank ?? 0));
      setAnswers(visible);
    } else {
      setCandidate(null);
    }

    await fetchPosts();
    setLoading(false);
  };

  const fetchPosts = async () => {
    const { data } = await supabase
      .from('posts')
      .select('*, comments (*)')
      .eq('election_candidate_id', candidateId)
      .order('created_at', { ascending: false });

    setPosts((data || []).map(post => ({
      ...post,
      comments: (post.comments || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    })));
  };

  useEffect(() => {
    if (user && candidateId) fetchAll();
  }, [user, candidateId]); // eslint-disable-line react-hooks/exhaustive-deps

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
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${profile.current_ghost_id}-${Date.now()}.${fileExt}`;
        const filePath = `posts/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('post-images').upload(filePath, imageFile);
        if (uploadError) {
          alert('Failed to upload image.');
          setSubmitting(false);
          return;
        }
        const { data: { publicUrl } } = supabase.storage.from('post-images').getPublicUrl(filePath);
        finalImageUrl = publicUrl;
      }

      const { error } = await supabase.from('posts').insert({
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

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!candidate) {
    return <div className="w-full text-center py-20 text-text-muted">Candidate not found.</div>;
  }

  const isOwner = candidate.politician_id === user.id;
  const seat = candidate.election_seats;
  const displayName = candidate.profiles?.full_name || `Ghost-${candidate.profiles?.current_ghost_id?.split('-')[0]}`;

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8">
      <div className="w-full min-w-0 max-w-3xl mx-auto">

        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-text-muted hover:text-text-secondary mb-6 transition-colors">
          <ArrowLeft size={16} /> Back
        </button>

        {/* Candidate Header */}
        <div className="bg-surface/30 backdrop-blur-md rounded-2xl border border-border-light/45 shadow-xl mb-8 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Vote size={14} className="text-primary" />
            <span className="text-xs text-text-muted">{seat?.elections?.name} · <span className="uppercase font-semibold">{seat?.elections?.status?.replace('_', ' ')}</span></span>
          </div>
          <h1 className="text-2xl font-bold text-text-main">{displayName}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="px-2.5 py-1 rounded bg-primary/20 text-primary-light text-xs font-bold uppercase tracking-wider">
              {seat?.role_title}
            </span>
            <span className="flex items-center gap-1 text-text-muted text-sm">
              <MapPin size={14} className="text-accent" /> {seat?.map_shapes?.name}
            </span>
            {candidateProfile?.political_parties?.name && (
              <span className="text-text-muted text-sm">· {candidateProfile.political_parties.name}</span>
            )}
            {isOwner && (
              <span className="ml-auto text-[10px] bg-primary/20 text-primary-light px-2 py-0.5 rounded uppercase tracking-wider font-bold">This is you</span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5 pt-5 border-t border-border-light/35">
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
        </div>

        {/* Introductory Campaign Video */}
        {candidate.intro_video_url && (
          <div className="bg-surface/30 backdrop-blur-md rounded-2xl border border-border-light/45 shadow-xl mb-8 p-6">
            <h2 className="text-sm font-bold text-text-main mb-3 flex items-center gap-2"><Video size={16} className="text-primary" /> Introduction</h2>
            <video src={candidate.intro_video_url} controls className="w-full max-h-[500px] rounded-xl bg-black" />
          </div>
        )}

        {/* Questionnaire Responses */}
        {answers.length > 0 && (
          <div className="bg-surface/30 backdrop-blur-md rounded-2xl border border-border-light/45 shadow-xl mb-8 p-6">
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
          </div>
        )}

        {/* Post / Video Pitch Composer */}
        <form onSubmit={handleCreatePost} className="mb-8 bg-surface/50 rounded-xl p-4 border border-border-light/50">
          <textarea
            value={newPostContent}
            onChange={handlePostChange}
            placeholder={isOwner ? 'Post an update or video pitch...' : `Start a discussion with ${displayName}...`}
            className="w-full bg-transparent text-text-secondary placeholder:text-text-muted resize-none outline-none min-h-[80px]"
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
              <button
                type="submit"
                disabled={submitting || (!newPostContent.trim() && !imageFile && !uploadedVideoUrl)}
                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium disabled:opacity-50"
              >
                {submitting ? 'Posting...' : 'Post anonymously'}
              </button>
            </div>
          </div>
        </form>

        {/* Feed */}
        <div className="space-y-6">
          {posts.length === 0 ? (
            <div className="text-center py-10 text-text-muted text-sm bg-surface/20 rounded-2xl border border-dashed border-border-light/60">
              No posts yet. {isOwner ? 'Share your first pitch above.' : 'Be the first to start a discussion.'}
            </div>
          ) : (
            posts.map(post => (
              <div key={post.id} className="bg-surface/30 backdrop-blur-md rounded-2xl border border-border-light/40 overflow-hidden p-5 hover:border-primary/25 transition-all duration-300 shadow-md">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-surface/50 border border-border-light/30 flex items-center justify-center">
                    <Users size={16} className="text-text-muted" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-text-secondary font-mono">
                      Ghost-{post.ghost_id.split('-')[0]}
                      {post.ghost_id === candidate.profiles?.current_ghost_id && (
                        <span className="ml-2 text-[10px] bg-primary/20 text-primary-light px-2 py-0.5 rounded uppercase tracking-wider font-bold">Candidate</span>
                      )}
                    </div>
                    <div className="text-xs text-text-muted">{new Date(post.created_at).toLocaleString()}</div>
                  </div>
                </div>

                <p className="text-text-tertiary text-sm whitespace-pre-wrap leading-relaxed mb-3">{post.content}</p>

                {post.image_url && (
                  <div className="mb-4 rounded-xl overflow-hidden border border-border-light/45">
                    <img src={post.image_url} alt="Post Attachment" className="w-full max-h-[500px] object-cover" loading="lazy" />
                  </div>
                )}

                {post.link_metadata ? (
                  <div className="mb-4"><LinkPreview url={post.link_metadata.url} metadata={post.link_metadata} /></div>
                ) : (() => {
                  const match = post.content?.match(/(https?:\/\/[^\s]+)/);
                  return match ? <div className="mb-4"><LinkPreview url={match[1]} /></div> : null;
                })()}

                {post.video_url && (
                  <div className="mt-3 rounded-xl overflow-hidden border border-border-light/45 bg-black">
                    <video src={post.video_url} controls className="w-full max-h-96 object-contain" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
