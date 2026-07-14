import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import { MapPin, Users, Building, Flag, ShieldAlert, ThumbsUp, ThumbsDown, MessageSquare, Send, Flame, Download, Video } from 'lucide-react';
import VideoRecorder from '../../components/video/VideoRecorder';

const BOUNDARY_TABS = ['Polling District', 'Federal Area', 'Country', 'International'];

export default function FeedPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Polling District');

  // Feed State
  const [posts, setPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [isCountry, setIsCountry] = useState(false);
  const [isInternational, setIsInternational] = useState(false);
  const [commentInputs, setCommentInputs] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [burning, setBurning] = useState(false);
  
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState(null);
  
  // Stories state
  const [activeStoryUrl, setActiveStoryUrl] = useState(null);

  const fetchProfile = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;

      // Fetch location IDs to ensure strict boundary filtering
      const { data: locData } = await supabase
        .from('user_locations')
        .select('*')
        .eq('profile_id', user.id)
        .maybeSingle();

      setProfile({ ...data, location: locData });
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async () => {
    try {
      // Fetch posts and their nested comments
      let query = supabase
        .from('posts')
        .select(`
          *,
          comments (*)
        `)
        .order('created_at', { ascending: false });

      if (activeTab === 'Polling District') {
        // Guard: if user has no polling district ID, show nothing (don't run a null query)
        if (!profile.location?.polling_district_id) {
          setPosts([]);
          return;
        }
        query = query
          .eq('polling_district_id', profile.location.polling_district_id)
          .is('federal_boundary_id', null)
          .eq('is_country', false)
          .eq('is_international', false);
      } else if (activeTab === 'Federal Area') {
        // Guard: if user has no federal boundary ID, show nothing
        if (!profile.location?.federal_boundary_id) {
          setPosts([]);
          return;
        }
        query = query
          .eq('federal_boundary_id', profile.location.federal_boundary_id)
          .is('polling_district_id', null)
          .eq('is_country', false)
          .eq('is_international', false);
      } else if (activeTab === 'Country') {
        query = query.eq('is_country', true);
      } else if (activeTab === 'International') {
        query = query.eq('is_international', true);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Sort comments by created_at ascending
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
  }, [user]);

  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      fetchPosts();
    }
  }, [profile, activeTab]);

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPostContent.trim() || !profile?.current_ghost_id) return;
    
    // Block posting if the required boundary ID is not set
    if (activeTab === 'Polling District' && !profile.location?.polling_district_id) {
      alert('Your Polling District location is not set. Please go to your Profile, enter your coordinates and click Save.');
      return;
    }
    if (activeTab === 'Federal Area' && !profile.location?.federal_boundary_id) {
      alert('Your Federal Area location is not set. Please go to your Profile, enter your coordinates and click Save.');
      return;
    }
    
    setSubmitting(true);
    try {
      const { error } = await supabase.from('posts').insert({
        ghost_id: profile.current_ghost_id,
        constituency: profile.constituency,
        federal_boundary_id: activeTab === 'Federal Area'
          ? profile.location?.federal_boundary_id
          : null,
        polling_district_id: activeTab === 'Polling District'
          ? profile.location?.polling_district_id
          : null,
        content: newPostContent.trim(),
        video_url: uploadedVideoUrl,
        is_country: isCountry,
        is_international: isInternational
      });
      if (error) throw error;
      setNewPostContent('');
      setUploadedVideoUrl(null);
      setShowVideoRecorder(false);
      setIsCountry(false);
      setIsInternational(false);
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
      const { error } = await supabase.rpc('vote_on_post', {
        p_post_id: postId,
        p_vote_type: voteType
      });
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
      const { error } = await supabase.from('comments').insert({
        post_id: postId,
        ghost_id: profile.current_ghost_id,
        content: content.trim()
      });
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
        const { error } = await supabase.rpc('burn_ghost_identity');
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
      const { data: userPosts, error: postError } = await supabase
        .from('posts')
        .select('id, content, created_at, likes_count, dislikes_count, comments(id)')
        .eq('ghost_id', profile.current_ghost_id);
      
      if (postError) throw postError;

      // 2. Fetch user's comments
      const { data: userComments, error: commentError } = await supabase
        .from('comments')
        .select('id, post_id, content, created_at')
        .eq('ghost_id', profile.current_ghost_id);

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
      const { error: uploadError } = await supabase.storage
        .from('user_exports')
        .upload(fileName, jsonString, {
          upsert: true,
          contentType: 'application/json'
        });

      if (uploadError) throw uploadError;
    } catch (err) {
      console.error('Error in background data export:', err);
    }
  };

  if (loading) {
    return <div className="w-full flex justify-center py-20"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (!profile) {
    return <div className="text-center py-20 text-slate-400">Please complete your profile to view your feed.</div>;
  }

  let locationDisplay = "Unknown Location";
  if (profile.role === 'politician') {
    locationDisplay = profile.country;
    if(profile.designation) {
        locationDisplay += ` - ${profile.designation}`;
    }
  } else if (profile.role === 'normal' && profile.constituency) {
    locationDisplay = profile.constituency;
  }

  return (
    <div className="w-full max-w-4xl mx-auto animate-fade-in pb-20">
      
      {/* Header Profile Summary */}
      <div className="bg-slate-800/80 backdrop-blur-md rounded-2xl border border-white/10 p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xl font-bold text-white shadow-lg shrink-0">
            {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-50">{profile.full_name || 'Anonymous User'}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-slate-400 text-sm">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                profile.role === 'politician' ? 'bg-indigo-500/20 text-indigo-300' : 
                profile.role === 'admin' ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
              }`}>
                {profile.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : 'Citizen'}
              </span>
              <span className="flex items-center gap-1">
                <MapPin size={14} />
                {locationDisplay}
              </span>
              
              {/* Ghost ID Info */}
              {profile.role !== 'admin' && profile.current_ghost_id && (
                <span className="ml-0 sm:ml-auto flex items-center gap-2 px-3 py-1 bg-slate-900/50 rounded-lg border border-slate-700 text-xs text-slate-500 font-mono">
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
            className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-lg transition-colors whitespace-nowrap text-sm font-medium disabled:opacity-50"
            title="Generate a new anonymous identity and orphan your old posts"
          >
            <Flame size={16} />
            {burning ? 'Burning...' : 'Burn Identity'}
          </button>
        )}
      </div>

      {profile.role === 'admin' && (
        <div className="mb-8 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3">
          <ShieldAlert className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-amber-400 font-bold mb-1">Admin Account</h3>
            <p className="text-amber-200/70 text-sm">You are logged in as an administrator. Your primary role is managing the system boundaries in the Admin panel. You do not belong to a specific constituency feed.</p>
          </div>
        </div>
      )}

      {profile.role !== 'admin' && (
        <div className="bg-slate-800/50 rounded-2xl border border-white/10 overflow-hidden shadow-xl">
          
          {/* Tabs Navigation */}
          <div className="flex overflow-x-auto custom-scrollbar border-b border-white/10 bg-slate-900/50">
            {BOUNDARY_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-4 text-sm font-medium transition-all whitespace-nowrap border-b-2 flex-1 text-center ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                {tab} Posts
              </button>
            ))}
          </div>

          <div className="p-4 sm:p-8">
            
            {/* Location not set warning banner */}
            {activeTab === 'Polling District' && !profile.location?.polling_district_id && (
              <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3">
                <MapPin className="text-amber-400 shrink-0 mt-0.5" size={18} />
                <div>
                  <h3 className="text-amber-300 font-semibold text-sm mb-1">Polling District Not Set</h3>
                  <p className="text-amber-200/70 text-xs">Your location has no Polling District mapped yet. Go to <a href="/profile" className="underline hover:text-amber-200">Profile Settings</a>, enter your coordinates, and click Save to activate this feed.</p>
                </div>
              </div>
            )}
            {activeTab === 'Federal Area' && !profile.location?.federal_boundary_id && (
              <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3">
                <MapPin className="text-amber-400 shrink-0 mt-0.5" size={18} />
                <div>
                  <h3 className="text-amber-300 font-semibold text-sm mb-1">Federal Area Not Set</h3>
                  <p className="text-amber-200/70 text-xs">Your Federal boundary is not mapped. Go to <a href="/profile" className="underline hover:text-amber-200">Profile Settings</a> and save your location to activate this feed.</p>
                </div>
              </div>
            )}

            {/* Create Post Input — hidden if boundary ID missing for geo tabs */}
            {(activeTab === 'Country' || activeTab === 'International' ||
              (activeTab === 'Polling District' && profile.location?.polling_district_id) ||
              (activeTab === 'Federal Area' && profile.location?.federal_boundary_id)
            ) && (
              <form onSubmit={handleCreatePost} className="mb-8 bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
              <textarea
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder={`Post anonymously in the ${activeTab} feed...`}
                className="w-full bg-transparent text-slate-200 placeholder:text-slate-500 resize-none outline-none min-h-[80px]"
                required
              />
              
              {showVideoRecorder && (
                <VideoRecorder onVideoUploaded={(url) => {
                  setUploadedVideoUrl(url);
                  setShowVideoRecorder(false);
                }} />
              )}

              {uploadedVideoUrl && (
                <div className="mb-4 bg-indigo-500/10 border border-indigo-500/30 p-3 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-300 text-sm font-medium">
                    <Video size={16} />
                    Video Attached Successfully
                  </div>
                  <button type="button" onClick={() => setUploadedVideoUrl(null)} className="text-indigo-400 hover:text-indigo-200 text-xs underline">Remove</button>
                </div>
              )}
              
              <div className="flex flex-wrap items-center gap-4 mt-2 border-t border-slate-700/50 pt-3">
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <ShieldAlert size={12} /> Posted as Ghost ID
                </span>
                
                {profile.role === 'politician' && !showVideoRecorder && !uploadedVideoUrl && (
                  <button
                    type="button"
                    onClick={() => setShowVideoRecorder(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/20 text-indigo-300 rounded-lg text-xs font-medium hover:bg-indigo-500/30 transition-colors"
                  >
                    <Video size={14} />
                    Record Pitch
                  </button>
                )}

                <div className="flex items-center gap-4 ml-auto">
                  <label className="flex items-center gap-1.5 text-sm text-slate-300 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={isCountry} 
                      onChange={(e) => setIsCountry(e.target.checked)} 
                      className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/20"
                    />
                    Country-wide
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-slate-300 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={isInternational} 
                      onChange={(e) => setIsInternational(e.target.checked)} 
                      className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/20"
                    />
                    International
                  </label>
                  <button
                    type="submit"
                    disabled={submitting || !newPostContent.trim()}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    {submitting ? 'Posting...' : 'Share Post'}
                  </button>
                </div>
              </div>
            </form>
            )}

            {/* Stories Section for Politician Videos */}
            {posts.filter(p => p.video_url).length > 0 && (
              <div className="mb-8">
                <h3 className="text-slate-400 text-sm font-medium mb-3 flex items-center gap-2">
                  <Video size={16} className="text-indigo-400" /> Politician Pitches
                </h3>
                <div className="flex gap-4 overflow-x-auto pb-4" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {posts.filter(p => p.video_url).map(post => (
                    <button 
                      key={`story-${post.id}`}
                      onClick={() => setActiveStoryUrl(post.video_url)}
                      className="flex flex-col items-center min-w-[100px] group"
                    >
                      <div className="w-[100px] h-[150px] rounded-xl border-2 border-indigo-500/50 group-hover:border-indigo-400 p-0.5 relative overflow-hidden bg-slate-800 flex-shrink-0 transition-all group-hover:scale-105 shadow-lg">
                        <video 
                           src={post.video_url} 
                           className="w-full h-full rounded-lg object-cover"
                           muted 
                           preload="metadata"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent rounded-lg transition-opacity group-hover:opacity-80" />
                        <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5">
                           <div className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center shrink-0 border border-indigo-300">
                             <Video size={8} className="text-white" />
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
                 <div className="relative max-w-sm w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700">
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
                <div className="text-center py-10 bg-slate-900/30 rounded-xl border border-dashed border-slate-700">
                  <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                    {activeTab === 'Federal' && <Flag className="text-slate-400 w-8 h-8" />}
                    {activeTab === 'Provincial' && <Building className="text-slate-400 w-8 h-8" />}
                    {activeTab === 'State' && <Building className="text-slate-400 w-8 h-8" />}
                    {activeTab === 'Municipal' && <Users className="text-slate-400 w-8 h-8" />}
                    {activeTab === 'City Ward' && <MapPin className="text-slate-400 w-8 h-8" />}
                  </div>
                  <h3 className="text-slate-300 font-medium mb-1">No Posts Yet</h3>
                  <p className="text-slate-500 text-sm">Be the first to share your thoughts anonymously.</p>
                </div>
              ) : (
                posts.map(post => (
                  <div key={post.id} className="bg-slate-900/80 rounded-xl border border-slate-700/50 overflow-hidden">
                    {/* Post Content */}
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                          <Users size={14} className="text-slate-400" />
                        </div>
                        <div>
                          <span className="text-sm font-bold text-slate-200 font-mono">
                            Ghost-{post.ghost_id.split('-')[0]}
                          </span>
                          <span className="text-xs text-slate-500 ml-2">
                            {new Date(post.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed mb-3">
                        {post.content}
                      </p>
                      
                      {post.video_url && (
                        <div className="mb-4 rounded-lg overflow-hidden border border-slate-700 bg-black">
                           <video src={post.video_url} controls className="w-full max-h-96 object-contain" />
                        </div>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div className="px-5 py-3 bg-slate-950/50 border-t border-slate-800 flex items-center gap-4">
                      <button 
                        onClick={() => handleVote(post.id, 1)}
                        className="flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-emerald-400 transition-colors"
                      >
                        <ThumbsUp size={16} />
                        <span>{post.likes_count}</span>
                      </button>
                      <button 
                        onClick={() => handleVote(post.id, -1)}
                        className="flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-red-400 transition-colors"
                      >
                        <ThumbsDown size={16} />
                        <span>{post.dislikes_count}</span>
                      </button>
                      <div className="flex items-center gap-1.5 text-sm font-medium text-slate-500 ml-auto">
                        <MessageSquare size={16} />
                        <span>{post.comments?.length || 0}</span>
                      </div>
                    </div>

                    {/* Comments Section */}
                    <div className="bg-slate-900/40 p-4 border-t border-slate-800">
                      
                      {/* List Comments */}
                      {post.comments && post.comments.length > 0 && (
                        <div className="space-y-3 mb-4 pl-2 border-l-2 border-slate-800">
                          {post.comments.map(comment => (
                            <div key={comment.id} className="pl-3">
                              <div className="flex items-baseline gap-2 mb-0.5">
                                <span className="text-xs font-bold text-slate-400 font-mono">
                                  Ghost-{comment.ghost_id.split('-')[0]}
                                </span>
                                <span className="text-[10px] text-slate-600">
                                  {new Date(comment.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                              </div>
                              <p className="text-sm text-slate-300">{comment.content}</p>
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
                          className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                        />
                        <button
                          onClick={() => handleCreateComment(post.id)}
                          disabled={!commentInputs[post.id]?.trim()}
                          className="p-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white rounded-lg transition-colors disabled:opacity-50"
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
  );
}
