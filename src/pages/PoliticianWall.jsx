import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import LinkPreview from '../components/LinkPreview';
import PoliticianSidebar from '../components/PoliticianSidebar';
import WallPostFeed from '../components/wall/WallPostFeed';
import { MapPin, Users, ShieldAlert, ArrowLeft, Heart, QrCode, X, Image as ImageIcon } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { getOwnProfile } from '../services/profile';
import {
  getWallOwnerProfile, getSupportStatus, getSupporterCount, withdrawSupport, addSupport,
  getSupportersList, getWallPosts, createWallPost
} from '../services/politicianWall';
import { uploadPostImage, createComment } from '../services/feed';

export default function PoliticianWall() {
  const { ghostId } = useParams();
  const { user, session } = useAuth();
  const navigate = useNavigate();

  const [wallOwner, setWallOwner] = useState(null);
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPostContent, setNewPostContent] = useState('');
  const [extractedUrl, setExtractedUrl] = useState(null);
  const [linkMetadata, setLinkMetadata] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [supportCount, setSupportCount] = useState(0);
  const [isSupporting, setIsSupporting] = useState(false);
  const [showSupporters, setShowSupporters] = useState(false);
  const [supportersList, setSupportersList] = useState([]);
  
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  // 'all' | 'mine' | 'reviews' — lets the owner separate their own posts from
  // visitor reviews so they can find and respond to feedback quickly.
  const [activeTab, setActiveTab] = useState('all');
  const [commentInputs, setCommentInputs] = useState({});

  useEffect(() => {
    let supportChannel = null;

    async function loadWall() {
      setLoading(true);
      
      // Load current user profile
      const { data: myProfile } = await getOwnProfile(user.id);
      setProfile(myProfile);

      // Load wall owner
      const { data: owner } = await getWallOwnerProfile(ghostId);

      if (owner) {
        setWallOwner(owner);
        checkSupportStatus(owner.id);
        
        // Real-time subscription for support count
        supportChannel = supabase.channel(`support-${owner.id}-${Date.now()}`)
          .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'politician_supporters',
            filter: `politician_id=eq.${owner.id}`
          }, () => {
            fetchSupportCount(owner.id);
          })
          .subscribe();
      }

      fetchPosts();
    }
    
    if (user && ghostId) loadWall();

    return () => {
      if (supportChannel) {
        supabase.removeChannel(supportChannel);
      }
    };
  }, [user, ghostId]);

  const checkSupportStatus = async (politicianId) => {
    // Check if current user supports
    const { data: mySupport } = await getSupportStatus(politicianId, user.id);

    setIsSupporting(!!mySupport);
    fetchSupportCount(politicianId);
  };

  const fetchSupportCount = async (politicianId) => {
    const { count } = await getSupporterCount(politicianId);

    setSupportCount(count || 0);
  };

  const toggleSupport = async () => {
    if (!wallOwner) return;

    if (isSupporting) {
      // Withdraw support
      setIsSupporting(false);
      setSupportCount(prev => Math.max(0, prev - 1));
      await withdrawSupport(wallOwner.id, user.id);
    } else {
      // Add support
      setIsSupporting(true);
      setSupportCount(prev => prev + 1);
      await addSupport(wallOwner.id, user.id);
    }
  };

  const loadSupportersDashboard = async () => {
    setShowSupporters(true);
    const { data } = await getSupportersList(wallOwner.id);

    if (data) setSupportersList(data);
  };

  const fetchPosts = async () => {
    try {
      const { data, error } = await getWallPosts(ghostId);

      if (error) throw error;

      // Comment pin-to-top ordering (owner's replies always lead) is handled
      // by WallPostFeed itself, keyed off ownerGhostId.
      setPosts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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
    if (!newPostContent.trim() || !profile?.current_ghost_id) return;
    
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

      const { error } = await createWallPost({
        ghost_id: profile.current_ghost_id,
        content: newPostContent.trim(),
        wall_ghost_id: ghostId,
        link_metadata: linkMetadata,
        image_url: finalImageUrl
      });
      if (error) throw error;
      
      setNewPostContent('');
      setExtractedUrl(null);
      setLinkMetadata(null);
      setImageFile(null);
      setImagePreview(null);
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
    return (
      <div className="w-full flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!wallOwner) {
    return <div className="w-full text-center py-20 text-text-muted">Wall not found.</div>;
  }

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8">
      {/* Main Wall Column */}
      <div className="w-full min-w-0">
        
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-text-muted hover:text-text-secondary mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to Feed
        </button>

        {/* Cover & Profile Header */}
        <div className="bg-surface/30 backdrop-blur-md rounded-2xl border border-border-light/45 shadow-xl mb-8 relative">
           <div className="h-32 bg-gradient-to-br from-vintage-grape via-surface to-coffee-bean rounded-t-2xl border-b border-border-light/20" />
           <div className="px-6 pb-6 relative">
              <div className="w-24 h-24 rounded-full bg-surface/80 border-4 border-surface flex items-center justify-center text-3xl font-bold text-text-main shadow-lg absolute -top-12">
                {wallOwner.full_name ? wallOwner.full_name.charAt(0).toUpperCase() : 'P'}
              </div>
              <div className="pt-14">
                 <h1 className="text-2xl font-bold text-text-main">{wallOwner.full_name || `Ghost-${ghostId.split('-')[0]}`}</h1>
                 <div className="flex items-center gap-2 mt-2">
                    <span className="px-2.5 py-1 rounded bg-primary/20 text-primary-light text-xs font-bold uppercase tracking-wider">
                      {wallOwner.politician_profiles?.[0]?.political_target_role || 'Representative'}
                    </span>
                    <span className="flex items-center gap-1 text-text-muted text-sm">
                      <MapPin size={14} className="text-accent" />
                      {wallOwner.politician_profiles?.[0]?.target_boundary_name || wallOwner.constituency}
                    </span>
                 </div>
              </div>

              {/* Support & Actions Section */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border-light/35 pt-6">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={toggleSupport}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 ${
                      isSupporting 
                        ? 'bg-danger/20 text-danger-light border border-danger/40 hover:bg-danger/30' 
                        : 'bg-surface-hover/80 text-text-secondary border border-border-light hover:bg-surface-active hover:text-text-main'
                    }`}
                  >
                    <Heart size={16} className={isSupporting ? "fill-current text-danger" : ""} />
                    {isSupporting ? 'Supported' : 'I Support'}
                  </button>
                  <div className="text-text-muted text-sm font-semibold">
                    {supportCount.toLocaleString()} Supporter{supportCount !== 1 ? 's' : ''}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {wallOwner.id === user.id && (
                    <button 
                      onClick={loadSupportersDashboard}
                      className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary-light hover:bg-primary hover:text-slate-950 border border-primary/35 rounded-xl text-sm font-bold transition-all"
                    >
                      <Users size={16} /> View Supporters
                    </button>
                  )}
                  <div className="group relative">
                    <button type="button" className="p-2.5 bg-surface-hover/80 text-text-muted hover:text-text-main hover:bg-surface-active rounded-xl border border-border-light transition-colors">
                      <QrCode size={18} />
                    </button>
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white p-3 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 transform origin-top-right border border-slate-100">
                      <p className="text-center text-slate-800 text-xs font-bold mb-2 uppercase tracking-wide">Scan to Visit</p>
                      <div className="bg-white p-1 rounded-lg flex justify-center">
                        <QRCodeSVG value={window.location.href} size={150} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
           </div>
        </div>

        {/* Supporters Dashboard Modal */}
        {showSupporters && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface border border-border-light rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-surface/50">
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <Heart size={18} className="text-danger fill-danger" /> Supporter Dashboard
                </h3>
                <button onClick={() => setShowSupporters(false)} className="text-text-muted hover:text-white p-1 rounded-lg hover:bg-surface-hover">
                  <X size={20} />
                </button>
              </div>
              <div className="p-5 overflow-y-auto flex-1">
                {supportersList.length === 0 ? (
                  <p className="text-center text-text-main0 py-8">No supporters yet.</p>
                ) : (
                  <div className="space-y-3">
                    {supportersList.map((sup, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-surface-hover/50 border border-border-light/50">
                        <div className="w-10 h-10 rounded-full bg-surface-active flex items-center justify-center text-text-tertiary font-bold shrink-0">
                          {sup.profiles?.full_name ? sup.profiles.full_name.charAt(0).toUpperCase() : 'A'}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-text-secondary text-sm truncate">
                            {sup.profiles?.full_name || 'Anonymous Citizen'}
                          </div>
                          <div className="text-xs text-text-main0 font-mono">
                            Ghost-{sup.profiles?.current_ghost_id?.split('-')[0] || 'Unknown'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Wall Post Input */}
        <form onSubmit={handleCreatePost} className="mb-8 bg-surface/50 rounded-xl p-4 border border-border-light/50">
          <textarea
            value={newPostContent}
            onChange={handlePostChange}
            placeholder={`Write something to ${wallOwner.full_name || 'this representative'}...`}
            className="w-full bg-transparent text-text-secondary placeholder:text-text-muted resize-none outline-none min-h-[80px]"
            required={!imageFile}
          />
          
          {extractedUrl && (
            <LinkPreview 
              url={extractedUrl} 
              onMetadataFetched={(meta) => setLinkMetadata(meta)} 
            />
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

          <div className="flex items-center justify-between mt-2 border-t border-border-light/50 pt-3">
            <span className="text-xs text-text-dark flex items-center gap-1">
              <ShieldAlert size={12} /> Posting as Ghost ID
            </span>
            <div className="flex items-center gap-2">
              <input 
                type="file" 
                accept="image/*" 
                id="wall-image-upload" 
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
                htmlFor="wall-image-upload"
                className="p-2 text-text-muted hover:bg-surface-hover hover:text-primary-light rounded-lg cursor-pointer transition-colors"
                title="Attach Image"
              >
                <ImageIcon size={18} />
              </label>

              <button
                type="submit"
                disabled={submitting || (!newPostContent.trim() && !imageFile)}
                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium disabled:opacity-50"
              >
                {submitting ? 'Posting...' : 'Post anonymously'}
              </button>
            </div>
          </div>
        </form>

        {/* Tabs — let the owner separate their own posts from visitor reviews */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'all', label: 'All' },
            { key: 'mine', label: wallOwner.id === user.id ? 'My Posts' : `${wallOwner.full_name || 'Their'} Posts` },
            { key: 'reviews', label: 'Reviews & Comments' }
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                activeTab === t.key
                  ? 'bg-primary/15 text-primary-light border border-primary/40'
                  : 'bg-surface-hover/40 text-text-muted border border-border-light/30 hover:bg-surface-hover'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Feed */}
        <WallPostFeed
          posts={posts.filter(post => {
            if (activeTab === 'mine') return post.ghost_id === ghostId;
            if (activeTab === 'reviews') return post.ghost_id !== ghostId;
            return true;
          })}
          ownerGhostId={ghostId}
          ownerBadgeLabel="Author"
          viewerIsOwner={wallOwner.id === user.id}
          emptyMessage={activeTab === 'mine' ? 'No posts yet.' : activeTab === 'reviews' ? 'No reviews yet.' : 'No posts on this wall yet.'}
          commentInputs={commentInputs}
          onCommentInputChange={(postId, value) => setCommentInputs({ ...commentInputs, [postId]: value })}
          onSubmitComment={handleCreateComment}
        />
      </div>

    </div>
  );
}
