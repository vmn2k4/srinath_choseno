import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { MapPin, Pencil, Flame, RefreshCw } from 'lucide-react';
import EditProfileFlow from './Profile/EditProfileFlow';
import { getOwnProfile, getPoliticianProfileFull, getLatestUserLocation, getUserBoundaryMemberships, burnGhostIdRaw, upsertProfileCore } from '../services/profile';
import { Card, Button, Badge, Spinner, PageHeader } from '../components/ui';

export default function ProfilePage() {
  const { session } = useAuth();
  const user = session?.user;

  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [burning, setBurning] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);
  const [profile, setProfile] = useState(null);

  const fetchProfile = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await getOwnProfile(user.id, { columns: 'role, full_name, country, constituency, current_ghost_id' });

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
      politicalPartyId: polData?.political_party_id || '',
      politicalParty: polData?.political_parties?.name || '',
      education: polData?.education || '',
      hometown: polData?.hometown || '',
      bio: polData?.bio || '',
      target_boundary_id: polData?.target_boundary_id || null,
      lat: locData?.latitude || '',
      lng: locData?.longitude || '',
      matchedBoundaries,
    });
    setLoading(false);
  };

  useEffect(() => { fetchProfile(); }, [user]);

  const burnGhostId = async () => {
    if (!confirm('⚠️ This permanently severs all your past activity from your account. Are you sure?')) return;
    setBurning(true);
    await burnGhostIdRaw(user.id);
    await fetchProfile();
    setBurning(false);
  };

  const handleEditComplete = (updatedFormData) => {
    setIsEditing(false);
    fetchProfile(); // Refresh from DB to show saved values
  };

  // One-click downgrade back to a citizen account — no dedicated politician
  // fields need clearing, just the role flip (mirrors the "Become a
  // Politician" prompts citizens see everywhere; politicians had no
  // reciprocal one-click way back).
  const switchToCitizen = async () => {
    if (!confirm('Switch back to a Citizen account? You\'ll no longer be able to manage a public wall or nominate yourself for seats.')) return;
    setSwitchingRole(true);
    await upsertProfileCore(user.id, {
      role: 'normal',
      fullName: profile.fullName,
      country: profile.country,
      constituency: profile.constituency
    });
    await fetchProfile();
    setSwitchingRole(false);
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
              <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest">Political Details</h3>
                <Button variant="ghost" size="sm" onClick={switchToCitizen} disabled={switchingRole} className="border border-border-light">
                  {switchingRole ? 'Switching...' : 'Switch to Citizen Account'}
                </Button>
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
          {profile?.role !== 'politician' && (
            <Card as="section">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-5">Privacy & Anonymity</h3>
              <div>
                <p className="text-xs text-text-muted mb-1">Current Ghost ID</p>
                <p className="font-mono text-xs text-text-secondary truncate">{profile?.ghostId}</p>
                <p className="text-xs text-text-muted mt-2 mb-4">Burning your Ghost ID permanently severs all links to your past posts. This cannot be undone.</p>
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
