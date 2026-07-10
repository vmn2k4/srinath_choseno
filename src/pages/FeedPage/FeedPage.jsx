import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import { MapPin, Users, Building, Flag, ShieldAlert } from 'lucide-react';

// Define the hierarchy of boundary types we want to show as tabs
const BOUNDARY_TABS = ['Federal', 'Provincial', 'State', 'Municipal', 'City Ward'];

export default function FeedPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Federal');

  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (error) throw error;
        setProfile(data);
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [user]);

  if (loading) {
    return <div className="w-full flex justify-center py-20"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (!profile) {
    return <div className="text-center py-20 text-slate-400">Please complete your profile to view your feed.</div>;
  }

  // Determine the display string for the user's location based on role
  let locationDisplay = "Unknown Location";
  if (profile.role === 'politician') {
    locationDisplay = profile.country; // Politicians might operate at a country level or specific designation
    if(profile.designation) {
        locationDisplay += ` - ${profile.designation}`;
    }
  } else if (profile.role === 'normal' && profile.constituency) {
    locationDisplay = profile.constituency;
  }

  return (
    <div className="w-full max-w-4xl mx-auto animate-fade-in">
      
      {/* Header Profile Summary */}
      <div className="bg-slate-800/80 backdrop-blur-md rounded-2xl border border-white/10 p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xl font-bold text-white shadow-lg">
            {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-50">{profile.full_name || 'Anonymous User'}</h1>
            <div className="flex items-center gap-2 mt-1 text-slate-400 text-sm">
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
            </div>
          </div>
        </div>
      </div>

      {/* Admin Warning (Admins shouldn't really use the feed, but we show a message if they do) */}
      {profile.role === 'admin' && (
        <div className="mb-8 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3">
          <ShieldAlert className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-amber-400 font-bold mb-1">Admin Account</h3>
            <p className="text-amber-200/70 text-sm">You are logged in as an administrator. Your primary role is managing the system boundaries in the Admin panel. You do not belong to a specific constituency.</p>
          </div>
        </div>
      )}

      {/* Main Feed Content (Only for citizens and politicians) */}
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

          {/* Tab Content Area */}
          <div className="p-8 min-h-[400px] flex flex-col items-center justify-center text-center">
            
            <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center mb-4">
              {activeTab === 'Federal' && <Flag className="text-slate-400 w-8 h-8" />}
              {activeTab === 'Provincial' && <Building className="text-slate-400 w-8 h-8" />}
              {activeTab === 'State' && <Building className="text-slate-400 w-8 h-8" />}
              {activeTab === 'Municipal' && <Users className="text-slate-400 w-8 h-8" />}
              {activeTab === 'City Ward' && <MapPin className="text-slate-400 w-8 h-8" />}
            </div>
            
            <h2 className="text-xl font-bold text-slate-200 mb-2">
              {activeTab} Feed
            </h2>
            
            <p className="text-slate-400 max-w-md mb-6">
              This area will display posts, updates, and discussions relevant to your {activeTab.toLowerCase()} constituency level.
            </p>

            <div className="p-4 bg-slate-900/50 rounded-lg border border-dashed border-slate-600 text-sm text-slate-500 w-full max-w-md">
              (Empty state: No posts available for {activeTab} level yet)
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
