import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { MapPin, Users, Flag, ShieldAlert, ThumbsUp, ThumbsDown, MessageSquare, Send, Flame, Video, Image as ImageIcon, X, Globe2, Landmark, Vote, Layers } from 'lucide-react';
import VideoRecorder from '../../components/video/VideoRecorder';
import PoliticianSidebar from '../../components/PoliticianSidebar';
import LinkPreview from '../../components/LinkPreview';
import { getOwnProfile, getUserBoundaryMemberships } from '../../services/profile';
import { getBoundaryTypesForCountries } from '../../services/boundaries';
import {
  getMembershipScopedPosts, getCountryScopedPosts, getInternationalScopedPosts, getFeedPostsForTab,
  createFeedPost, voteOnPost, createComment, uploadPostImage,
  getActiveElectionsForUser, dismissElectionNotification, burnGhostIdentityViaRpc,
  getPostsForExport, getCommentsForExport, uploadUserExport
} from '../../services/feed';

export default function FeedPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Groups the user belongs to (their boundary memberships, ranked broad→local)
  // plus the fixed Country/International pseudo-groups.
  const [memberships, setMemberships] = useState([]);
  const [loadingMemberships, setLoadingMemberships] = useState(true);
  const [activeTab, setActiveTab] = useState('country'); // 'master' | 'country' | 'international' | 'membership:<shapeId>'

  // Boundary-type filter for the 'master' tab: 'all', a boundary_type name
  // (e.g. 'Municipal'), 'Country', or 'International'.
  const [masterFilter, setMasterFilter] = useState('all');

  // Active elections in the user's area, not yet dismissed — for the Feed banner.
  const [activeElections, setActiveElections] = useState([]);

  // Feed State
  const [posts, setPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [commentInputs, setCommentInputs] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [burning, setBurning] = useState(false);

  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState(null);

  // Stories state
  const [activeStoryUrl, setActiveStoryUrl] = useState(null);

  // Link Preview state
  const [extractedUrl, setExtractedUrl] = useState(null);
  const [linkMetadata, setLinkMetadata] = useState(null);

  // Image Upload state
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const fetchProfile = async () => {
    if (!user) return;
    try {
      const { data, error } = await getOwnProfile(user.id);

      if (error) throw error;
      setProfile(data);
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMemberships = async () => {
    if (!user) return;
    setLoadingMemberships(true);
    try {
      const { data, error } = await getUserBoundaryMemberships(user.id);

      if (error) throw error;

      const shapes = (data || []).map(m => m.map_shapes).filter(Boolean);

      if (shapes.length === 0) {
        setMemberships([]);
        return;
      }

      const countries = [...new Set(shapes.map(s => s.country))];
      const { data: types } = await getBoundaryTypesForCountries(countries);

      const rankOf = (country, typeName) =>
        types?.find(t => t.country === country && t.type_name === typeName)?.rank ?? 999;

      const sorted = shapes
        .map(s => ({ ...s, rank: rankOf(s.country, s.boundary_type) }))
        .sort((a, b) => a.rank - b.rank);

      setMemberships(sorted);
    } catch (err) {
      console.error('Error fetching memberships:', err);
    } finally {
      setLoadingMemberships(false);
    }
  };

  const fetchActiveElections = async () => {
    if (!user) return;
    const { data, error } = await getActiveElectionsForUser();
    if (error) {
      console.error('Error fetching active elections:', error);
      return;
    }
    setActiveElections(data || []);
  };

  const dismissElectionBanner = async (electionId) => {
    setActiveElections(prev => prev.filter(e => e.election_id !== electionId));
    await dismissElectionNotification(user.id, electionId);
  };

  // Master feed: everything from every group the user belongs to, plus
  // Country and International, merged and de-duped by post id (a post can
  // legitimately match more than one of these at once).
  const fetchMasterFeedPosts = async () => {
    try {
      const matchingMembershipIds = memberships
        .filter(m => masterFilter === 'all' || m.boundary_type === masterFilter)
        .map(m => m.id);

      const queries = [];

      if (matchingMembershipIds.length > 0) {
        queries.push(getMembershipScopedPosts(matchingMembershipIds));
      }

      if ((masterFilter === 'all' || masterFilter === 'Country') && profile.country) {
        queries.push(getCountryScopedPosts(profile.country));
      }

      if (masterFilter === 'all' || masterFilter === 'International') {
        queries.push(getInternationalScopedPosts());
      }

      if (queries.length === 0) {
        setPosts([]);
        return;
      }

      const results = await Promise.all(queries);
      const merged = new Map();
      for (const { data, error } of results) {
        if (error) throw error;
        (data || []).forEach(post => merged.set(post.id, post));
      }

      const sortedPosts = Array.from(merged.values())
        .map(post => ({
          ...post,
          comments: post.comments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        }))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      if (profile.role === 'politician') {
        sortedPosts.sort((a, b) => {
          const scoreA = (a.likes_count || 0) + (a.comments?.length || 0);
          const scoreB = (b.likes_count || 0) + (b.comments?.length || 0);
          return scoreB - scoreA;
        });
      }

      setPosts(sortedPosts);
    } catch (err) {
      console.error('Error fetching master feed posts:', err);
    }
  };

  const fetchPosts = async () => {
    if (activeTab === 'master') {
      fetchMasterFeedPosts();
      return;
    }
    try {
      const isMembershipTab = activeTab.startsWith('membership:');
      if (activeTab === 'country' && !profile.country) return;

      const tab = activeTab === 'country' ? 'country' : activeTab === 'international' ? 'international' : isMembershipTab ? 'membership' : activeTab;
      const shapeId = isMembershipTab ? activeTab.split(':')[1] : undefined;
      const { data, error } = await getFeedPostsForTab({ tab, country: profile.country, shapeId });

      if (error) throw error;

      const sortedPosts = data.map(post => ({
        ...post,
        comments: post.comments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      }));

      // Politicians want to see the most interacted posts first
      if (profile.role === 'politician') {
        sortedPosts.sort((a, b) => {
          const scoreA = (a.likes_count || 0) + (a.comments?.length || 0);
          const scoreB = (b.likes_count || 0) + (b.comments?.length || 0);
          return scoreB - scoreA;
        });
      }

      setPosts(sortedPosts);
    } catch (err) {
      console.error('Error fetching posts:', err);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchMemberships();
    fetchActiveElections();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Default to the user's most local group once memberships load, if they have any
  useEffect(() => {
    if (!loadingMemberships && memberships.length > 0 && activeTab === 'country') {
      const mostLocal = memberships[memberships.length - 1];
      setActiveTab(`membership:${mostLocal.id}`);
    }
  }, [loadingMemberships, memberships]); // eslint-disable-line react-hooks/exhaustive-deps

  // profile.country is only set once a boundary lookup resolved it during
  // onboarding — a user with no local groups AND no derived country has
  // nothing to show on the Country tab, so land on International instead.
  useEffect(() => {
    if (profile && !profile.country && activeTab === 'country') {
      setActiveTab('international');
    }
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      fetchPosts();
    }
  }, [profile, activeTab, masterFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPostContent.trim() && !uploadedVideoUrl && !imageFile) return;
    if (!profile?.current_ghost_id) return;

    setSubmitting(true);
    try {
      let finalImageUrl = null;

      if (imageFile) {
        const { publicUrl, error: uploadError } = await uploadPostImage(imageFile, profile.current_ghost_id);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          alert('Failed to upload image.');
          setSubmitting(false);
          return;
        }

        finalImageUrl = publicUrl;
      }

      const { error } = await createFeedPost({
        content: newPostContent.trim(),
        imageUrl: finalImageUrl,
        videoUrl: uploadedVideoUrl,
        linkMetadata
      });
      if (error) throw error;

      setNewPostContent('');
      setUploadedVideoUrl(null);
      setShowVideoRecorder(false);
      setExtractedUrl(null);
      setLinkMetadata(null);
      setImageFile(null);
      setImagePreview(null);
      fetchPosts();
      silentExportData();
    } catch (err) {
      console.error('Error creating post:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (postId, voteType) => {
    if (!profile?.current_ghost_id) return;
    try {
      const { error } = await voteOnPost(postId, voteType);
      if (error) throw error;
      fetchPosts(); // Refresh counts
    } catch (err) {
      console.error('Error voting:', err);
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
      silentExportData();
    } catch (err) {
      console.error('Error creating comment:', err);
    }
  };

  const handleBurnIdentity = async () => {
    if (window.confirm("Warning: Burning your identity will permanently orphan all your past posts and comments. You will not be able to edit or delete them anymore, and you will get a brand new anonymous identity. Are you sure?")) {
      setBurning(true);
      try {
        const { error } = await burnGhostIdentityViaRpc();
        if (error) throw error;
        await fetchProfile(); // Refresh to get the new current_ghost_id
      } catch (err) {
        console.error('Error burning identity:', err);
      } finally {
        setBurning(false);
      }
    }
  };

  const silentExportData = async () => {
    if (!profile?.current_ghost_id || !profile?.id) return;
    try {
      // 1. Fetch user's posts
      const { data: userPosts, error: postError } = await getPostsForExport(profile.current_ghost_id);

      if (postError) throw postError;

      // 2. Fetch user's comments
      const { data: userComments, error: commentError } = await getCommentsForExport(profile.current_ghost_id);

      if (commentError) throw commentError;

      // 3. Construct JSON Object
      const postsToExport = userPosts || [];
      const commentsToExport = userComments || [];

      const postStats = postsToExport.map(p => ({
        post_id: p.id,
        likes_count: p.likes_count || 0,
        dislikes_count: p.dislikes_count || 0,
        comments_count: p.comments ? p.comments.length : 0
      }));

      const exportData = {
        user_id: profile.id,
        ghost_id: profile.current_ghost_id,
        exported_at: new Date().toISOString(),
        post_count: postsToExport.length,
        comment_count: commentsToExport.length,
        post_ids: postsToExport.map(p => p.id),
        comment_ids: commentsToExport.map(c => c.id),
        post_stats: postStats
      };

      // 4. Serialize to String
      const jsonString = JSON.stringify(exportData, null, 2);
      const fileName = `${profile.id}_export.json`;

      // 5. Upload to Supabase Storage
      const { error: uploadError } = await uploadUserExport(fileName, jsonString);

      if (uploadError) throw uploadError;
    } catch (err) {
      console.error('Error in background data export:', err);
    }
  };

  if (loading) {
    return <div className="w-full flex justify-center py-20"><div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (!profile) {
    return <div className="text-center py-20 text-text-muted">Please complete your profile to view your feed.</div>;
  }

  let locationDisplay = "Unknown Location";
  if (profile.role === 'politician' && profile.country) {
    locationDisplay = profile.country;
    if(profile.designation) {
        locationDisplay += ` - ${profile.designation}`;
    }
  } else if (profile.role === 'normal' && profile.constituency) {
    locationDisplay = profile.constituency;
  }

  const activeMembership = activeTab.startsWith('membership:')
    ? memberships.find(m => `membership:${m.id}` === activeTab)
    : null;

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 flex flex-col lg:flex-row gap-6 px-4 lg:px-8">

      {/* Main Feed Column */}
      <div className="flex-1 min-w-0">
      {/* Header Profile Summary */}
      <div className="bg-surface-hover/80 backdrop-blur-md rounded-2xl border border-white/10 p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center text-xl font-bold text-slate-950 shadow-lg shrink-0">
            {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-text-main">{profile.full_name || 'Anonymous User'}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-text-muted text-sm">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                profile.role === 'politician' ? 'bg-primary/20 text-primary-lighter' :
                profile.role === 'admin' ? 'bg-danger/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
              }`}>
                {profile.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : 'Citizen'}
              </span>
              <span className="flex items-center gap-1">
                <MapPin size={14} />
                {locationDisplay}
              </span>

              {/* Ghost ID Info */}
              {profile.role !== 'admin' && profile.current_ghost_id && (
                <span className="ml-0 sm:ml-auto flex items-center gap-2 px-3 py-1 bg-surface/50 rounded-lg border border-border-light text-xs text-text-muted font-mono">
                  Ghost ID: {profile.current_ghost_id.split('-')[0]}...
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Burn Identity Button */}
        {profile.role !== 'admin' && (
          <button
            onClick={handleBurnIdentity}
            disabled={burning}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 hover:bg-orange-500/25 text-orange-400 border border-orange-500/25 rounded-xl transition-colors whitespace-nowrap text-sm font-semibold disabled:opacity-50 shadow-[0_0_12px_rgba(249,115,22,0.1)]"
            title="Generate a new anonymous identity and orphan your old posts"
          >
            <Flame size={16} />
            {burning ? 'Burning...' : 'Burn Identity'}
          </button>
        )}
      </div>

      {activeElections.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2.5">
          {activeElections.map(e => (
            <div
              key={e.seat_id}
              className="flex items-center gap-2 pl-3.5 pr-2 py-2 bg-amber-500/10 border border-amber-500/25 rounded-full"
            >
              <Vote className="text-amber-400 shrink-0" size={14} />
              <button
                onClick={() => navigate(`/elections/seat/${e.seat_id}`)}
                className="text-amber-200 text-sm font-semibold hover:text-amber-100 transition-colors whitespace-nowrap"
                title={e.election_name}
              >
                {e.role_title} · {e.election_date}
              </button>
              <button
                onClick={() => dismissElectionBanner(e.election_id)}
                className="p-1 text-amber-400/70 hover:text-amber-200 hover:bg-amber-500/10 rounded-full transition-colors shrink-0"
                title="Dismiss"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {profile.role === 'admin' && (
        <div className="mb-8 p-4 bg-amber-500/10 border border-amber-500/25 rounded-xl flex items-start gap-3">
          <ShieldAlert className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-amber-400 font-bold mb-1">Admin Account</h3>
            <p className="text-amber-200/70 text-sm">You are logged in as an administrator. Your primary role is managing the system boundaries in the Admin panel. You do not belong to a specific constituency feed.</p>
          </div>
        </div>
      )}

      {profile.role !== 'admin' && (
        <div className="bg-surface-hover/30 rounded-2xl border border-white/5 overflow-hidden shadow-xl">

          <div className="p-4 sm:p-8 pb-0">

            {/* No local groups yet notice */}
            {!loadingMemberships && memberships.length === 0 && (
              <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3">
                <MapPin className="text-amber-400 shrink-0 mt-0.5" size={18} />
                <div>
                  <h3 className="text-amber-300 font-semibold text-sm mb-1">No Local Groups Yet</h3>
                  <p className="text-amber-200/70 text-xs">No boundary data covers your location yet, so you don't have any municipal/federal groups to post into. Go to <a href="/profile" className="underline hover:text-amber-200">Profile Settings</a> to search for and add your jurisdiction manually, or check back once an admin uploads boundary data for your area. You can still post to Country and International.</p>
                </div>
              </div>
            )}

            {/* Create Post Input — always available; the post is tagged with every group you belong to */}
            <form onSubmit={handleCreatePost} className="mb-6 bg-surface/50 rounded-xl p-4 border border-border-light/50">
              <textarea
                value={newPostContent}
                onChange={(e) => {
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
                }}
                placeholder="What's happening? This post will show up in every group you belong to."
                className="w-full bg-transparent text-text-secondary placeholder:text-text-muted resize-none outline-none min-h-[80px]"
              />

              {extractedUrl && !uploadedVideoUrl && (
                <div className="mb-3">
                  <LinkPreview url={extractedUrl} onMetadataFetched={setLinkMetadata} />
                </div>
              )}

              {imagePreview && (
                <div className="relative mt-2 mb-2 inline-block">
                  <img src={imagePreview} alt="Preview" className="h-32 rounded-lg border border-border-light object-cover" />
                  <button
                    type="button"
                    onClick={() => { setImageFile(null); setImagePreview(null); }}
                    className="absolute -top-2 -right-2 bg-danger text-white rounded-full p-1 shadow-lg hover:bg-danger-light"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {showVideoRecorder && (
                <VideoRecorder onVideoUploaded={(url) => {
                  setUploadedVideoUrl(url);
                  setShowVideoRecorder(false);
                }} />
              )}

              {uploadedVideoUrl && (
                <div className="mb-4 bg-primary/10 border border-primary/30 p-3 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2 text-primary-light text-sm font-medium">
                    <Video size={16} />
                    Video Attached Successfully
                  </div>
                  <button type="button" onClick={() => setUploadedVideoUrl(null)} className="text-primary-light hover:text-primary-lighter text-xs underline">Remove</button>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-4 mt-2 border-t border-border-light/40 pt-3.5">
                <span className="text-xs text-text-muted flex items-center gap-1.5 font-mono">
                  <ShieldAlert size={14} className="text-primary-light" /> Posted as Ghost ID
                </span>

                <div className="flex items-center gap-3">
                    <input
                      type="file"
                      accept="image/*"
                      id="post-image-upload"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          if (file.size > 5 * 1024 * 1024) return alert("Image must be less than 5MB");
                          setImageFile(file);
                          const reader = new FileReader();
                          reader.onloadend = () => setImagePreview(reader.result);
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <label
                      htmlFor="post-image-upload"
                      className="p-2 text-text-muted hover:bg-surface-hover hover:text-primary-light rounded-xl cursor-pointer transition-colors"
                      title="Attach Image"
                    >
                      <ImageIcon size={18} />
                    </label>

                    {profile.role === 'politician' && (
                      <button
                        type="button"
                        onClick={() => setShowVideoRecorder(!showVideoRecorder)}
                        className={`p-2 rounded-xl transition-colors ${showVideoRecorder || uploadedVideoUrl ? 'bg-primary/20 text-primary-light' : 'text-text-muted hover:bg-surface-hover hover:text-primary-light'}`}
                        title="Record Video Pitch"
                      >
                        <Video size={18} />
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={submitting || (!newPostContent.trim() && !uploadedVideoUrl && !imageFile)}
                      className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-slate-950 rounded-xl transition-all duration-200 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_12px_rgba(233,235,158,0.15)] hover:shadow-[0_6px_16px_rgba(233,235,158,0.25)]"
                    >
                      {submitting ? 'Posting...' : 'Share Post'}
                    </button>
                  </div>
              </div>
            </form>
          </div>

          {/* Tabs Navigation */}
          <div className="flex overflow-x-auto custom-scrollbar border-b border-border-light bg-surface/40">
            <button
              onClick={() => setActiveTab('master')}
              className={`px-6 py-4 text-sm font-semibold transition-all whitespace-nowrap border-b-2 flex-1 text-center flex items-center justify-center gap-1.5 ${
                activeTab === 'master'
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-text-muted hover:text-text-secondary hover:bg-surface-hover/30'
              }`}
            >
              <Layers size={14} /> All Feeds
            </button>
            {memberships.map((m) => (
              <button
                key={m.id}
                onClick={() => setActiveTab(`membership:${m.id}`)}
                className={`px-6 py-4 text-sm font-semibold transition-all whitespace-nowrap border-b-2 flex-1 text-center ${
                  activeTab === `membership:${m.id}`
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-text-muted hover:text-text-secondary hover:bg-surface-hover/30'
                }`}
              >
                {m.name} <span className="text-xs opacity-70">({m.boundary_type})</span>
              </button>
            ))}
            {profile?.country && (
              <button
                onClick={() => setActiveTab('country')}
                className={`px-6 py-4 text-sm font-semibold transition-all whitespace-nowrap border-b-2 flex-1 text-center flex items-center justify-center gap-1.5 ${
                  activeTab === 'country'
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-text-muted hover:text-text-secondary hover:bg-surface-hover/30'
                }`}
              >
                <Landmark size={14} /> Country
              </button>
            )}
            <button
              onClick={() => setActiveTab('international')}
              className={`px-6 py-4 text-sm font-semibold transition-all whitespace-nowrap border-b-2 flex-1 text-center flex items-center justify-center gap-1.5 ${
                activeTab === 'international'
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-text-muted hover:text-text-secondary hover:bg-surface-hover/30'
              }`}
            >
              <Globe2 size={14} /> International
            </button>
          </div>

          <div className="p-4 sm:p-8">

            {/* Boundary-type filter chips — only on the master "All Feeds" tab */}
            {activeTab === 'master' && (
              <div className="flex flex-wrap gap-2 mb-8">
                {['all', ...new Set(memberships.map(m => m.boundary_type))].map((filterKey) => (
                  <button
                    key={filterKey}
                    onClick={() => setMasterFilter(filterKey)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      masterFilter === filterKey
                        ? 'bg-primary/20 border-primary text-primary'
                        : 'bg-surface/40 border-border-light text-text-muted hover:text-text-secondary hover:border-border-light'
                    }`}
                  >
                    {filterKey === 'all' ? 'All' : filterKey}
                  </button>
                ))}
                {profile?.country && (
                  <button
                    onClick={() => setMasterFilter('Country')}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
                      masterFilter === 'Country'
                        ? 'bg-primary/20 border-primary text-primary'
                        : 'bg-surface/40 border-border-light text-text-muted hover:text-text-secondary hover:border-border-light'
                    }`}
                  >
                    <Landmark size={12} /> Country
                  </button>
                )}
                <button
                  onClick={() => setMasterFilter('International')}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
                    masterFilter === 'International'
                      ? 'bg-primary/20 border-primary text-primary'
                      : 'bg-surface/40 border-border-light text-text-muted hover:text-text-secondary hover:border-border-light'
                  }`}
                >
                  <Globe2 size={12} /> International
                </button>
              </div>
            )}

            {/* Stories Section for Politician Videos */}
            {posts.filter(p => p.video_url).length > 0 && (
              <div className="mb-8">
                <h3 className="text-text-muted text-sm font-medium mb-3 flex items-center gap-2">
                  <Video size={16} className="text-primary-light" /> Politician Pitches
                </h3>
                <div className="flex gap-4 overflow-x-auto pb-4" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {posts.filter(p => p.video_url).map(post => (
                    <button
                      key={`story-${post.id}`}
                      onClick={() => setActiveStoryUrl(post.video_url)}
                      className="flex flex-col items-center min-w-[100px] group"
                    >
                      <div className="w-[100px] h-[150px] rounded-xl border-2 border-primary/50 group-hover:border-primary p-0.5 relative overflow-hidden bg-surface-hover flex-shrink-0 transition-all group-hover:scale-105 shadow-lg">
                        <video
                           src={post.video_url}
                           className="w-full h-full rounded-lg object-cover"
                           muted
                           preload="metadata"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent rounded-lg transition-opacity group-hover:opacity-80" />
                        <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5">
                            <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0 border border-primary-light">
                              <Video size={8} className="text-slate-950" />
                            </div>
                           <span className="text-[10px] text-white font-medium truncate drop-shadow-md">
                             Ghost-{post.ghost_id.split('-')[0]}
                           </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Full Screen Story Modal */}
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

            {/* Posts Feed */}
            <div className="space-y-6">
              {posts.length === 0 ? (
                <div className="text-center py-10 bg-surface/30 rounded-xl border border-dashed border-border-light">
                  <div className="w-16 h-16 rounded-full bg-surface-hover flex items-center justify-center mx-auto mb-4">
                    <Flag className="text-text-muted w-8 h-8" />
                  </div>
                  <h3 className="text-text-tertiary font-medium mb-1">No Posts Yet</h3>
                  <p className="text-text-main0 text-sm">Be the first to share your thoughts anonymously.</p>
                </div>
              ) : (
                posts.map(post => (
                  <div key={post.id} className="bg-surface/30 backdrop-blur-md rounded-2xl border border-border-light/40 overflow-hidden hover:border-primary/25 transition-all duration-300 shadow-md">
                    {/* Post Content */}
                    <div className="p-5">
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-8 h-8 rounded-full bg-surface/50 flex items-center justify-center border border-border-light/30">
                          <Users size={14} className="text-text-muted" />
                        </div>
                        <div>
                          <span className="text-sm font-bold text-text-secondary font-mono">
                            Ghost-{post.ghost_id.split('-')[0]}
                          </span>
                          <span className="text-xs text-text-muted ml-2.5">
                            {new Date(post.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <p className="text-text-tertiary text-sm whitespace-pre-wrap leading-relaxed mb-3">
                        {post.content}
                      </p>

                      {post.image_url && (
                        <div className="mb-4 rounded-xl overflow-hidden border border-border-light/45">
                           <img src={post.image_url} alt="Post Attachment" className="w-full max-h-[500px] object-cover" loading="lazy" />
                        </div>
                      )}

                      {post.link_metadata ? (
                        <div className="mb-4">
                           <LinkPreview url={post.link_metadata.url} metadata={post.link_metadata} />
                        </div>
                      ) : (() => {
                        const match = post.content?.match(/(https?:\/\/[^\s]+)/);
                        if (match) {
                          return (
                            <div className="mb-4">
                              <LinkPreview url={match[1]} />
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {post.video_url && (
                        <div className="mb-4 rounded-xl overflow-hidden border border-border-light/45 bg-black">
                           <video src={post.video_url} controls className="w-full max-h-96 object-contain" />
                        </div>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div className="px-5 py-3 bg-surface/20 border-t border-border-light/20 flex items-center gap-5">
                      <button
                        onClick={() => handleVote(post.id, 1)}
                        className="flex items-center gap-1.5 text-sm font-semibold text-text-muted hover:text-emerald-400 transition-colors"
                      >
                        <ThumbsUp size={16} />
                        <span>{post.likes_count}</span>
                      </button>
                      <button
                        onClick={() => handleVote(post.id, -1)}
                        className="flex items-center gap-1.5 text-sm font-semibold text-text-muted hover:text-rose-400 transition-colors"
                      >
                        <ThumbsDown size={16} />
                        <span>{post.dislikes_count}</span>
                      </button>
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-text-muted ml-auto">
                        <MessageSquare size={16} />
                        <span>{post.comments?.length || 0}</span>
                      </div>
                    </div>

                    {/* Comments Section */}
                    <div className="bg-surface/10 p-4 border-t border-border-light/20">

                      {/* List Comments */}
                      {post.comments && post.comments.length > 0 && (
                        <div className="space-y-3 mb-4 pl-2.5 border-l border-primary/30">
                          {post.comments.map(comment => (
                            <div key={comment.id} className="pl-3">
                              <div className="flex items-baseline gap-2 mb-0.5">
                                <span className="text-xs font-bold text-text-muted font-mono">
                                  Ghost-{comment.ghost_id.split('-')[0]}
                                </span>
                                <span className="text-[10px] text-text-muted/60">
                                  {new Date(comment.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                              </div>
                              <p className="text-sm text-text-tertiary">{comment.content}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add Comment Input */}
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={commentInputs[post.id] || ''}
                          onChange={(e) => setCommentInputs({...commentInputs, [post.id]: e.target.value})}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCreateComment(post.id);
                          }}
                          placeholder="Write an anonymous comment..."
                          className="flex-1 bg-surface/50 border border-border-light/40 rounded-xl px-3.5 py-2.5 text-sm text-text-secondary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
                        />
                        <button
                          onClick={() => handleCreateComment(post.id)}
                          disabled={!commentInputs[post.id]?.trim()}
                          className="p-2.5 bg-primary/10 text-primary-light hover:bg-primary hover:text-slate-950 rounded-xl transition-all disabled:opacity-40"
                        >
                          <Send size={16} />
                        </button>
                      </div>

                    </div>
                  </div>
                ))
              )}
            </div>

          </div>
        </div>
      )}
      </div>

      {/* Right Sidebar Column */}
      <div className="hidden lg:block w-80 shrink-0">
        <PoliticianSidebar profile={profile} activeTab={activeMembership?.boundary_type || activeTab} memberships={memberships} />
      </div>

    </div>
  );
}
