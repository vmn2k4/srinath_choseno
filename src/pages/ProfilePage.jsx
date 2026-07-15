import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { MapPin, Pencil, Loader2, Flame, RefreshCw } from 'lucide-react';
import EditProfileFlow from './Profile/EditProfileFlow';

export default function ProfilePage() {
  const { session } = useAuth();
  const user = session?.user;

  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [burning, setBurning] = useState(false);
  const [profile, setProfile] = useState(null);

  const fetchProfile = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('role, full_name, country, constituency, current_ghost_id')
      .eq('id', user.id)
      .single();

    let polData = null;
    if (data?.role === 'politician') {
      const { data: pd } = await supabase
        .from('politician_profiles')
        .select('political_target_role, target_boundary_id, target_boundary_name, political_party, bio')
        .eq('id', user.id)
        .maybeSingle();
      polData = pd;
    }

    const { data: locData } = await supabase
      .from('user_locations')
      .select('latitude, longitude, federal_boundary_id, polling_district_id')
      .eq('profile_id', user.id)
      .maybeSingle();

    setProfile({
      role: data?.role || '',
      fullName: data?.full_name || '',
      country: data?.country || '',
      constituency: data?.constituency || '',
      ghostId: data?.current_ghost_id || '',
      politicalTargetRole: polData?.political_target_role || '',
      politicalParty: polData?.political_party || '',
      bio: polData?.bio || '',
      target_boundary_id: polData?.target_boundary_id || null,
      lat: locData?.latitude || '',
      lng: locData?.longitude || '',
      polling_district_id: locData?.polling_district_id || null,
      federal_boundary_id: locData?.federal_boundary_id || null,
    });
    setLoading(false);
  };

  useEffect(() => { fetchProfile(); }, [user]);

  const burnGhostId = async () => {
    if (!confirm('⚠️ This permanently severs all your past activity from your account. Are you sure?')) return;
    setBurning(true);
    const newGhostId = crypto.randomUUID();
    await supabase.from('profiles').update({ current_ghost_id: newGhostId }).eq('id', user.id);
    await fetchProfile();
    setBurning(false);
  };

  const handleEditComplete = (updatedFormData) => {
    setIsEditing(false);
    fetchProfile(); // Refresh from DB to show saved values
  };

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="animate-spin text-primary-light" size={32} />
    </div>
  );

  if (profile?.role === 'admin') return (
    <div className="w-full max-w-2xl mx-auto mt-10 p-8 bg-surface rounded-2xl border border-border text-center">
      <h3 className="text-xl font-bold text-text-secondary mb-2">Administrator Account</h3>
      <p className="text-text-muted mb-4">You manage electoral boundaries. Your profile is locked.</p>
      <a href="/admin" className="inline-block px-6 py-3 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover transition-colors">Go to Admin Portal</a>
    </div>
  );

  const roleLabel = profile?.role === 'normal' ? 'Citizen' : profile?.role === 'politician' ? 'Politician' : 'Not set';
  const roleColor = profile?.role === 'politician' ? 'bg-primary/20 text-primary-lighter' : 'bg-accent/20 text-blue-300';

  return (
    <>
      {isEditing && profile && (
        <EditProfileFlow
          initialData={profile}
          onComplete={handleEditComplete}
          onCancel={() => setIsEditing(false)}
        />
      )}

      <div className="w-full max-w-2xl mx-auto mt-10 pb-20 animate-fade-in px-4">
        {/* Page Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-text-main">Your Profile</h2>
            <p className="text-text-muted text-sm mt-0.5">Manage your account details.</p>
          </div>
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary-lighter hover:bg-primary/20 border border-primary/30 rounded-xl transition-colors font-medium text-sm"
          >
            <Pencil size={15} /> Edit Profile
          </button>
        </div>

        <div className="space-y-4">
          {/* General Info Card */}
          <section className="p-6 bg-surface rounded-2xl border border-border">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-5">General Info</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <p className="text-xs text-text-muted mb-1">Full Name</p>
                <p className="font-semibold text-text-main">{profile?.fullName || <em className="text-text-muted not-italic font-normal">Not set</em>}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted mb-1">Account Type</p>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${roleColor}`}>{roleLabel}</span>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-text-muted mb-1">Jurisdiction / Constituency</p>
                <p className="font-medium text-text-main flex items-center gap-2">
                  <MapPin size={15} className="text-text-muted shrink-0" />
                  {profile?.constituency || <em className="text-text-muted not-italic font-normal">Not mapped yet</em>}
                </p>
              </div>
            </div>
          </section>

          {/* Politician Details Card */}
          {profile?.role === 'politician' && (
            <section className="p-6 bg-surface rounded-2xl border border-border">
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-5">Political Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <p className="text-xs text-text-muted mb-1">Target Office</p>
                  <p className="font-semibold text-text-main">{profile?.politicalTargetRole || <em className="text-text-muted not-italic font-normal">Not set</em>}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-1">Political Party</p>
                  <p className="font-semibold text-text-main">{profile?.politicalParty || <em className="text-text-muted not-italic font-normal">Independent</em>}</p>
                </div>
                {profile?.bio && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-text-muted mb-1">Bio / Platform</p>
                    <p className="text-text-secondary text-sm leading-relaxed">{profile.bio}</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Privacy & Ghost ID Card */}
          {profile?.role !== 'politician' && (
            <section className="p-6 bg-surface rounded-2xl border border-border">
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-5">Privacy & Anonymity</h3>
              <div>
                <p className="text-xs text-text-muted mb-1">Current Ghost ID</p>
                <p className="font-mono text-xs text-text-secondary truncate">{profile?.ghostId}</p>
                <p className="text-xs text-text-muted mt-2 mb-4">Burning your Ghost ID permanently severs all links to your past posts. This cannot be undone.</p>
                <button
                  onClick={burnGhostId}
                  disabled={burning}
                  className="flex items-center gap-2 px-4 py-2 bg-danger/10 text-danger-light hover:bg-danger/20 border border-danger/30 rounded-xl transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {burning ? <><RefreshCw size={15} className="animate-spin" /> Burning...</> : <><Flame size={15} /> Burn My Ghost ID</>}
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
