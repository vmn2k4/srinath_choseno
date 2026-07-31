import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { MapPin, Pencil, Flame, RefreshCw, Award } from 'lucide-react';
import EditProfileFlow from './Profile/EditProfileFlow';
import { getOwnProfile, getPoliticianProfileFull, getLatestUserLocation, getUserBoundaryMemberships, calculateMyScore } from '../services/profile';
import { burnGhostIdentityViaRpc } from '../services/feed';
import { Card, Button, Badge, Spinner, PageHeader } from '../components/ui';

export default function ProfilePage() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [burning, setBurning] = useState(false);
  const [profile, setProfile] = useState(null);
  const [score, setScore] = useState(null);
  const [scoring, setScoring] = useState(false);

  const fetchProfile = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await getOwnProfile(user.id, { columns: 'role, full_name, country, constituency, current_ghost_id, cached_total_score, last_burned_at, burn_count' });

    let polData = null;
    if (data?.role === 'politician') {
      const { data: pd } = await getPoliticianProfileFull(user.id);
      polData = pd;
    }

    const { data: locRows } = await getLatestUserLocation(user.id);
    const locData = locRows?.[0] || null;

    const { data: memberships } = await getUserBoundaryMemberships(user.id);
    const matchedBoundaries = (memberships || [])
      .map(m => m.map_shapes)
      .filter(Boolean);

    setProfile({
      role: data?.role || '',
      fullName: data?.full_name || '',
      country: data?.country || '',
      constituency: data?.constituency || '',
      ghostId: data?.current_ghost_id || '',
      lastBurnedAt: data?.last_burned_at || null,
      burnCount: data?.burn_count || 0,
      politicalPartyId: polData?.political_party_id || '',
      politicalParty: polData?.political_parties?.name || '',
      education: polData?.education || '',
      hometown: polData?.hometown || '',
      bio: polData?.bio || '',
      avatarUrl: polData?.avatar_url || '',
      target_boundary_id: polData?.target_boundary_id || null,
      lat: locData?.latitude || '',
      lng: locData?.longitude || '',
      matchedBoundaries,
    });
    setScore(data?.cached_total_score ?? 0);
    setLoading(false);

    // Cached score is shown immediately above; refresh it in the background
    // so it reflects any activity since the cache was last written.
    const { data: freshScore, error: scoreError } = await calculateMyScore();
    if (!scoreError) setScore(freshScore);
  };

  useEffect(() => { fetchProfile(); }, [user?.id]);

  const burnGhostId = async () => {
    if (!confirm(`⚠️ This permanently severs all your past activity from your account. Your current civic score (${score ?? 0}) will be locked in — any likes or dislikes your past posts get after this point will no longer count. Are you sure?`)) return;
    setBurning(true);
    const { error } = await burnGhostIdentityViaRpc();
    if (error) {
      console.error('Error burning identity:', error);
      alert('Failed to burn identity. Please try again.');
    }
    await fetchProfile();
    setBurning(false);
  };

  const updateScore = async () => {
    setScoring(true);
    const { data, error } = await calculateMyScore();
    if (error) {
      console.error('Error calculating score:', error);
      alert('Failed to calculate score. Please try again.');
    } else {
      setScore(data);
    }
    setScoring(false);
  };

  const handleEditComplete = (updatedFormData) => {
    setIsEditing(false);
    fetchProfile(); // Refresh from DB to show saved values
  };

  if (loading) return <Spinner fullPage />;

  if (profile?.role === 'admin') return (
    <Card padding="lg" className="w-full max-w-none text-center mx-4 lg:mx-8">
      <h3 className="text-xl font-bold text-text-secondary mb-2">Administrator Account</h3>
      <p className="text-text-muted mb-4">You manage electoral boundaries. Your profile is locked.</p>
      <Button as="a" href="/admin">Go to Admin Portal</Button>
    </Card>
  );

  const roleLabel = profile?.role === 'normal' ? 'Citizen' : profile?.role === 'politician' ? 'Politician' : 'Not set';
  const roleTone = profile?.role === 'politician' ? 'primary' : 'accent';

  return (
    <>
      {isEditing && profile && (
        <EditProfileFlow
          initialData={profile}
          onComplete={handleEditComplete}
          onCancel={() => setIsEditing(false)}
        />
      )}

      <div className="w-full max-w-none mt-10 pb-20 animate-fade-in px-4 lg:px-8">
        <PageHeader
          title="Your Profile"
          subtitle="Manage your account details."
          action={
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              <Pencil size={15} /> Edit Profile
            </Button>
          }
        />

        <div className="space-y-6">
          {/* General Info Card */}
          <Card as="section">
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-5">General Info</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <p className="text-xs text-text-muted mb-1">Full Name</p>
                <p className="font-semibold text-text-main">{profile?.fullName || <em className="text-text-muted not-italic font-normal">Not set</em>}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted mb-1">Account Type</p>
                <Badge tone={roleTone} shape="pill" size="sm">{roleLabel}</Badge>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-text-muted mb-1">Groups You Belong To</p>
                {profile?.matchedBoundaries?.length ? (
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {profile.matchedBoundaries.map(b => (
                      <span key={b.id} className="flex items-center gap-1.5 px-3 py-1 bg-surface-hover rounded-lg border border-border-light text-xs font-semibold text-text-main">
                        <MapPin size={12} className="text-accent shrink-0" />
                        {b.name} <span className="text-text-muted font-normal">({b.boundary_type})</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="font-medium text-text-main flex items-center gap-2">
                    <MapPin size={15} className="text-accent shrink-0" />
                    <em className="text-text-muted not-italic font-normal">No groups mapped yet</em>
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* Politician Details Card */}
          {profile?.role === 'politician' && (
            <Card as="section">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-5">Political Details</h3>
              <div className="flex items-center gap-4 mb-5">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center text-xl font-bold text-text-on-primary shadow-lg shrink-0 overflow-hidden">
                  {profile?.avatarUrl ? (
                    <img src={profile.avatarUrl} alt={profile?.fullName || 'Profile'} className="w-full h-full object-cover" />
                  ) : (
                    profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : 'P'
                  )}
                </div>
                <p className="text-xs text-text-muted">Add a profile photo from Edit Profile — it's optional and shows on your public wall and candidate listings.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <p className="text-xs text-text-muted mb-1">Political Party</p>
                  <p className="font-semibold text-text-main">{profile?.politicalParty || <em className="text-text-muted not-italic font-normal">Not set</em>}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-1">Hometown</p>
                  <p className="font-semibold text-text-main">{profile?.hometown || <em className="text-text-muted not-italic font-normal">Not set</em>}</p>
                </div>
                {profile?.bio && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-text-muted mb-1">Bio / Platform</p>
                    <p className="text-text-secondary text-sm leading-relaxed">{profile.bio}</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Privacy & Ghost ID Card */}
          {profile && (
            <Card as="section">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-5">Privacy & Anonymity</h3>
              <div>
                <p className="text-xs text-text-muted mb-1">Current Ghost ID</p>
                <p className="font-mono text-xs text-text-secondary truncate">{profile?.ghostId}</p>

                <div className="mt-4 pt-4 border-t border-border-light flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-xs text-text-muted mb-1">Civic Score</p>
                    <p className="text-2xl font-bold text-text-main">{score ?? 0}</p>
                    <p className="text-xs text-text-muted mt-1">10 pts/post, 5 pts/comment, +1 per like and -1 per dislike on your posts.</p>
                  </div>
                  <Button variant="outline" onClick={updateScore} disabled={scoring}>
                    {scoring ? <><RefreshCw size={15} className="animate-spin" /> Calculating...</> : <><Award size={15} /> Update My Score</>}
                  </Button>
                </div>

                <p className="text-xs text-text-muted mt-4">
                  {profile.burnCount > 0
                    ? `Burned ${profile.burnCount} time${profile.burnCount > 1 ? 's' : ''} — last on ${new Date(profile.lastBurnedAt).toLocaleDateString()}.`
                    : 'You have never burned your Ghost ID.'}
                </p>
                <p className="text-xs text-text-muted mt-1 mb-4">Burning your Ghost ID permanently severs all links to your past posts. This cannot be undone.</p>
                <Button variant="danger" onClick={burnGhostId} disabled={burning}>
                  {burning ? <><RefreshCw size={15} className="animate-spin" /> Burning...</> : <><Flame size={15} /> Burn My Ghost ID</>}
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
