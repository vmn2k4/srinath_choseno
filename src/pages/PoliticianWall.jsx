import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import LinkPreview from '../components/LinkPreview';
import PoliticianSidebar from '../components/PoliticianSidebar';
import { MapPin, Users, ShieldAlert, ArrowLeft, Heart, QrCode, X, Image as ImageIcon } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

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

  useEffect(() => {
    let supportChannel = null;

    async function loadWall() {
      setLoading(true);
      
      // Load current user profile
      const { data: myProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(myProfile);

      // Load wall owner
      const { data: owner } = await supabase
        .from('profiles')
        .select(`
           id,
           current_ghost_id,
           full_name,
           role,
           constituency,
           politician_profiles (
             political_target_role,
             target_boundary_name
           )
        `)
        .eq('current_ghost_id', ghostId)
        .single();
        
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
    const { data: mySupport } = await supabase
      .from('politician_supporters')
      .select('supporter_id')
      .eq('politician_id', politicianId)
      .eq('supporter_id', user.id)
      .maybeSingle();
      
    setIsSupporting(!!mySupport);
    fetchSupportCount(politicianId);
  };

  const fetchSupportCount = async (politicianId) => {
    const { count } = await supabase
      .from('politician_supporters')
      .select('*', { count: 'exact', head: true })
      .eq('politician_id', politicianId);
      
    setSupportCount(count || 0);
  };

  const toggleSupport = async () => {
    if (!wallOwner) return;
    
    if (isSupporting) {
      // Withdraw support
      setIsSupporting(false);
      setSupportCount(prev => Math.max(0, prev - 1));
      await supabase
        .from('politician_supporters')
        .delete()
        .eq('politician_id', wallOwner.id)
        .eq('supporter_id', user.id);
    } else {
      // Add support
      setIsSupporting(true);
      setSupportCount(prev => prev + 1);
      await supabase
        .from('politician_supporters')
        .insert({
          politician_id: wallOwner.id,
          supporter_id: user.id
        });
    }
  };

  const loadSupportersDashboard = async () => {
    setShowSupporters(true);
    const { data } = await supabase
      .from('politician_supporters')
      .select(`
        created_at,
        profiles!politician_supporters_supporter_id_fkey (
          full_name,
          current_ghost_id
        )
      `)
      .eq('politician_id', wallOwner.id)
      .order('created_at', { ascending: false });
      
    if (data) setSupportersList(data);
  };

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`*, comments (*)`)
        .or(`ghost_id.eq.${ghostId},wall_ghost_id.eq.${ghostId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const sortedPosts = data.map(post => ({
        ...post,
        comments: post.comments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      }));
      setPosts(sortedPosts);
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
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${profile.current_ghost_id}-${Date.now()}.${fileExt}`;
        const filePath = `posts/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('post-images')
          .upload(filePath, imageFile);
          
        if (uploadError) {
          console.error('Upload error:', uploadError);
          alert('Failed to upload image.');
          setSubmitting(false);
          return;
        }
        
        const { data: { publicUrl } } = supabase.storage
          .from('post-images')
          .getPublicUrl(filePath);
          
        finalImageUrl = publicUrl;
      }

      const { error } = await supabase.from('posts').insert({
        ghost_id: profile.current_ghost_id,
        constituency: profile.constituency,
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
    <div className="w-full max-w-3xl mx-auto animate-fade-in pb-20 px-4">
      {/* Main Wall Column */}
      <div className="w-full min-w-0">
        
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-text-muted hover:text-text-secondary mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to Feed
        </button>

        {/* Cover & Profile Header */}
        <div className="bg-surface rounded-2xl border border-border shadow-xl mb-8 relative">
           <div className="h-32 bg-gradient-to-r from-indigo-900 to-blue-900 rounded-t-2xl" />
           <div className="px-6 pb-6 relative">
              <div className="w-24 h-24 rounded-full bg-surface-hover border-4 border-slate-900 flex items-center justify-center text-3xl font-bold text-white shadow-lg absolute -top-12">
                {wallOwner.full_name ? wallOwner.full_name.charAt(0).toUpperCase() : 'P'}
              </div>
              <div className="pt-14">
                 <h1 className="text-2xl font-bold text-text-main">{wallOwner.full_name || `Ghost-${ghostId.split('-')[0]}`}</h1>
                 <div className="flex items-center gap-2 mt-2">
                    <span className="px-2.5 py-1 rounded bg-primary/20 text-primary-lighter text-xs font-semibold">
                      {wallOwner.politician_profiles?.[0]?.political_target_role || 'Representative'}
                    </span>
                    <span className="flex items-center gap-1 text-text-muted text-sm">
                      <MapPin size={14} />
                      {wallOwner.politician_profiles?.[0]?.target_boundary_name || wallOwner.constituency}
                    </span>
                 </div>
              </div>

              {/* Support & Actions Section */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={toggleSupport}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                      isSupporting 
                        ? 'bg-danger/10 text-danger-light border border-danger/30 hover:bg-danger/20' 
                        : 'bg-surface-hover text-text-tertiary border border-border-light hover:bg-surface-active hover:text-white'
                    }`}
                  >
                    <Heart size={18} className={isSupporting ? "fill-current" : ""} />
                    {isSupporting ? 'Supported' : 'I Support'}
                  </button>
                  <div className="text-text-muted text-sm font-medium">
                    {supportCount.toLocaleString()} Supporter{supportCount !== 1 ? 's' : ''}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {wallOwner.id === user.id && (
                    <button 
                      onClick={loadSupportersDashboard}
                      className="flex items-center gap-2 px-4 py-2 bg-primary/20 text-primary-light hover:bg-primary/30 hover:text-primary-lighter border border-primary/30 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Users size={16} /> View Supporters
                    </button>
                  )}
                  <div className="group relative">
                    <button type="button" className="p-2.5 bg-surface-hover text-text-tertiary hover:bg-surface-active rounded-lg border border-border-light transition-colors">
                      <QrCode size={18} />
                    </button>
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white p-3 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 transform origin-top-right">
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

        {/* Feed */}
        <div className="space-y-6">
          {posts.length === 0 ? (
             <div className="text-center py-10 text-text-main0 text-sm bg-surface/30 rounded-xl border border-dashed border-border-light">
                No posts on this wall yet.
             </div>
          ) : (
            posts.map(post => (
              <div key={post.id} className="bg-surface/80 rounded-xl border border-border-light/50 overflow-hidden p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-surface-active flex items-center justify-center">
                    <Users size={16} className="text-text-muted" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-text-secondary font-mono">
                      Ghost-{post.ghost_id.split('-')[0]}
                      {post.ghost_id === ghostId && (
                         <span className="ml-2 text-[10px] bg-primary/20 text-primary-light px-2 py-0.5 rounded uppercase tracking-wider font-bold">Author</span>
                      )}
                    </div>
                    <div className="text-xs text-text-main0">{new Date(post.created_at).toLocaleString()}</div>
                  </div>
                </div>
                
                <p className="text-text-tertiary text-sm whitespace-pre-wrap leading-relaxed mb-3">
                  {post.content}
                </p>

                {post.image_url && (
                  <div className="mb-4 rounded-lg overflow-hidden border border-border-light">
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
                  <div className="mt-3 rounded-lg overflow-hidden border border-border-light bg-black">
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
