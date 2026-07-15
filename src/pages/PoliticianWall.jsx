import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import LinkPreview from '../components/LinkPreview';
import PoliticianSidebar from '../components/PoliticianSidebar';
import { MapPin, Users, ShieldAlert, ArrowLeft } from 'lucide-react';

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

  useEffect(() => {
    async function loadWall() {
      setLoading(true);
      
      // Load current user profile
      const { data: myProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(myProfile);

      // Load wall owner
      const { data: owner } = await supabase
        .from('profiles')
        .select(`
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
      }

      fetchPosts();
    }
    if (user && ghostId) loadWall();
  }, [user, ghostId]);

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
      const { error } = await supabase.from('posts').insert({
        ghost_id: profile.current_ghost_id,
        constituency: profile.constituency,
        content: newPostContent.trim(),
        wall_ghost_id: ghostId,
        link_metadata: linkMetadata
      });
      if (error) throw error;
      
      setNewPostContent('');
      setExtractedUrl(null);
      setLinkMetadata(null);
      fetchPosts();
    } catch (err) {
      console.error('Error creating post:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!wallOwner) {
    return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Wall not found.</div>;
  }

  return (
    <div className="w-full max-w-6xl mx-auto animate-fade-in pb-20 flex flex-col lg:flex-row gap-6 px-4">
      {/* Main Wall Column */}
      <div className="flex-1 max-w-3xl min-w-0">
        
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-400 hover:text-slate-200 mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to Feed
        </button>

        {/* Cover & Profile Header */}
        <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-xl mb-8">
           <div className="h-32 bg-gradient-to-r from-indigo-900 to-blue-900" />
           <div className="px-6 pb-6 relative">
              <div className="w-24 h-24 rounded-full bg-slate-800 border-4 border-slate-900 flex items-center justify-center text-3xl font-bold text-white shadow-lg absolute -top-12">
                {wallOwner.full_name ? wallOwner.full_name.charAt(0).toUpperCase() : 'P'}
              </div>
              <div className="pt-14">
                 <h1 className="text-2xl font-bold text-slate-50">{wallOwner.full_name || `Ghost-${ghostId.split('-')[0]}`}</h1>
                 <div className="flex items-center gap-2 mt-2">
                    <span className="px-2.5 py-1 rounded bg-indigo-500/20 text-indigo-300 text-xs font-semibold">
                      {wallOwner.politician_profiles?.[0]?.political_target_role || 'Representative'}
                    </span>
                    <span className="flex items-center gap-1 text-slate-400 text-sm">
                      <MapPin size={14} />
                      {wallOwner.politician_profiles?.[0]?.target_boundary_name || wallOwner.constituency}
                    </span>
                 </div>
              </div>
           </div>
        </div>

        {/* Wall Post Input */}
        <form onSubmit={handleCreatePost} className="mb-8 bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
          <textarea
            value={newPostContent}
            onChange={handlePostChange}
            placeholder={`Write something to ${wallOwner.full_name || 'this representative'}...`}
            className="w-full bg-transparent text-slate-200 placeholder:text-slate-500 resize-none outline-none min-h-[80px]"
            required
          />
          
          {extractedUrl && (
            <LinkPreview 
              url={extractedUrl} 
              onMetadataFetched={(meta) => setLinkMetadata(meta)} 
            />
          )}

          <div className="flex items-center justify-between mt-2 border-t border-slate-700/50 pt-3">
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <ShieldAlert size={12} /> Posting as Ghost ID
            </span>
            <button
              type="submit"
              disabled={submitting || !newPostContent.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {submitting ? 'Posting...' : 'Post to Wall'}
            </button>
          </div>
        </form>

        {/* Feed */}
        <div className="space-y-6">
          {posts.length === 0 ? (
             <div className="text-center py-10 text-slate-500 text-sm bg-slate-900/30 rounded-xl border border-dashed border-slate-700">
                No posts on this wall yet.
             </div>
          ) : (
            posts.map(post => (
              <div key={post.id} className="bg-slate-900/80 rounded-xl border border-slate-700/50 overflow-hidden p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                    <Users size={16} className="text-slate-400" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-200 font-mono">
                      Ghost-{post.ghost_id.split('-')[0]}
                      {post.ghost_id === ghostId && (
                         <span className="ml-2 text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded uppercase tracking-wider font-bold">Author</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">{new Date(post.created_at).toLocaleString()}</div>
                  </div>
                </div>
                
                <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed mb-3">
                  {post.content}
                </p>

                {post.link_metadata && (
                  <LinkPreview url={post.link_metadata.url} metadata={post.link_metadata} />
                )}
                
                {post.video_url && (
                  <div className="mt-3 rounded-lg overflow-hidden border border-slate-700 bg-black">
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
