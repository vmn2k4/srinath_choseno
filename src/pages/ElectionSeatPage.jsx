import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import CandidacyWall from '../components/CandidacyWall';
import { getGhostDisplayName } from '../utils/ghostName';
import {
  getSeatById, getCandidatesBySeatIds, getMyCandidacies, applyForSeat,
  getSeatAdminStatus, applyForElectionAdmin, addUnregisteredCandidate
} from '../services/elections';
import { getPoliticalParties } from '../services/politicalParties';
import { getProfileRole } from '../services/profile';
import { Vote, MapPin, Users, Calendar, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Card, Button, Badge, Input, Textarea, Select, Spinner, EmptyState } from '../components/ui';

export default function ElectionSeatPage() {
  const { seatId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [seat, setSeat] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [role, setRole] = useState(null);
  const [myCandidacies, setMyCandidacies] = useState([]);
  const [applying, setApplying] = useState(false);
  const [status, setStatus] = useState('');

  // Election administrator application
  const [adminStatus, setAdminStatus] = useState(null); // { has_approved_admin, my_application_status }
  const [showAdminApplyForm, setShowAdminApplyForm] = useState(false);
  const [adminMotivation, setAdminMotivation] = useState('');
  const [adminSocialMedia, setAdminSocialMedia] = useState('');
  const [adminContactEmail, setAdminContactEmail] = useState('');
  const [submittingAdminApp, setSubmittingAdminApp] = useState(false);
  const [adminAppStatus, setAdminAppStatus] = useState('');

  // Add an unregistered candidate (approved election admins only)
  const [showAddCandidateForm, setShowAddCandidateForm] = useState(false);
  const [parties, setParties] = useState([]);
  const [newCandidateName, setNewCandidateName] = useState('');
  const [newCandidateParty, setNewCandidateParty] = useState('');
  const [newCandidateEducation, setNewCandidateEducation] = useState('');
  const [newCandidateHometown, setNewCandidateHometown] = useState('');
  const [newCandidateBio, setNewCandidateBio] = useState('');
  const [addingCandidate, setAddingCandidate] = useState(false);
  const [addCandidateStatus, setAddCandidateStatus] = useState('');

  const fetchAll = async () => {
    setLoading(true);

    const { data: seatRow } = await getSeatById(seatId);
    setSeat(seatRow || null);

    const { data: candidateRows } = await getCandidatesBySeatIds([seatId]);
    setCandidates(candidateRows || []);
    setSelectedCandidateId((candidateRows && candidateRows[0]?.id) || null);

    // Everything below is about the signed-in visitor's own relationship to
    // this seat (their role, their applications, their admin status) — none
    // of it applies to an anonymous visitor just browsing candidates.
    if (user) {
      const { data: myProfile } = await getProfileRole(user.id);
      setRole(myProfile?.role || null);

      const { data: candidacies } = await getMyCandidacies(user.id);
      setMyCandidacies(candidacies || []);

      const { data: seatAdminStatus } = await getSeatAdminStatus(seatId);
      setAdminStatus(seatAdminStatus);
    } else {
      setRole(null);
      setMyCandidacies([]);
      setAdminStatus(null);
    }

    if (seatRow?.map_shapes?.country) {
      const { data: partyRows } = await getPoliticalParties({ country: seatRow.map_shapes.country });
      setParties(partyRows || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && seatId) fetchAll();
  }, [user, authLoading, seatId]); // eslint-disable-line react-hooks/exhaustive-deps

  const startApplying = async () => {
    setApplying(true);
    setStatus('');
    const { data, error } = await applyForSeat(seatId);
    setApplying(false);
    if (error) {
      setStatus('Error: ' + error.message);
      return;
    }
    navigate(`/apply/${data.id}`);
  };

  const submitElectionAdminApplication = async (e) => {
    e.preventDefault();
    setSubmittingAdminApp(true);
    setAdminAppStatus('');
    const { error } = await applyForElectionAdmin(seatId, {
      motivation: adminMotivation, socialMediaInfo: adminSocialMedia, contactEmail: adminContactEmail
    });
    setSubmittingAdminApp(false);
    if (error) {
      setAdminAppStatus('Error: ' + error.message);
      return;
    }
    setShowAdminApplyForm(false);
    fetchAll();
  };

  const submitUnregisteredCandidate = async (e) => {
    e.preventDefault();
    setAddingCandidate(true);
    setAddCandidateStatus('');
    const { error } = await addUnregisteredCandidate(seatId, {
      fullName: newCandidateName, partyId: newCandidateParty || null,
      education: newCandidateEducation, hometown: newCandidateHometown, bio: newCandidateBio
    });
    setAddingCandidate(false);
    if (error) {
      setAddCandidateStatus('Error: ' + error.message);
      return;
    }
    setNewCandidateName('');
    setNewCandidateParty('');
    setNewCandidateEducation('');
    setNewCandidateHometown('');
    setNewCandidateBio('');
    setShowAddCandidateForm(false);
    fetchAll();
  };

  if (loading) {
    return <Spinner fullPage />;
  }

  if (!seat) {
    return <div className="w-full text-center py-20 text-text-muted">Seat not found.</div>;
  }

  const alreadyApplied = myCandidacies.some(c => c.seat_id === seatId);

  const hasSidebar = role === 'normal' || role === 'politician' || adminStatus;

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8">
      <div className="w-full min-w-0 flex flex-col lg:flex-row gap-6 items-start">

        {/* Main column */}
        <div className="flex-1 min-w-0 w-full">
          {/* Seat / Election Header — compact single row */}
          <Card variant="hero" padding="sm" className="mb-6 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
              <Badge tone="amber" shape="pill" icon={<Vote size={12} />}>{seat.elections?.status?.replace('_', ' ')}</Badge>
              <h1 className="text-lg font-bold text-text-main tracking-tight truncate">{seat.role_title}</h1>
              <span className="text-xs text-text-muted truncate">{seat.elections?.name}</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap text-xs text-text-muted shrink-0">
              <span className="flex items-center gap-1" title={seat.map_shapes?.name}>
                <MapPin size={13} className="text-accent" /> {seat.map_shapes?.name}
              </span>
              <span className="flex items-center gap-1" title={seat.elections?.election_date}>
                <Calendar size={13} className="text-accent" /> {seat.elections?.election_date}
              </span>
              <span className="flex items-center gap-1" title={`${candidates.length} candidate${candidates.length !== 1 ? 's' : ''}`}>
                <Users size={13} className="text-accent" /> {candidates.length}
              </span>
            </div>
          </Card>

          {status && <p className="text-danger text-xs mb-6">{status}</p>}

          {/* Candidate Switcher */}
          {candidates.length === 0 ? (
            <EmptyState
              icon={Vote}
              title="No Candidates Yet"
              description="Nobody has applied for this seat yet — be the first to run."
              className="mb-8"
            />
          ) : (
            <>
              <div className="flex gap-3 overflow-x-auto pb-2 mb-6" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {candidates.map(c => {
                  const name = c.profiles?.full_name || getGhostDisplayName(c.profiles?.current_ghost_id);
                  const isSelected = c.id === selectedCandidateId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCandidateId(c.id)}
                      className={`flex items-center gap-3 shrink-0 pl-2.5 pr-4 py-2 rounded-2xl border-2 transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10 shadow-[0_0_0_3px_rgba(233,235,158,0.12)]'
                          : 'border-border-light bg-surface-hover/40 hover:border-primary/40 hover:bg-surface-hover'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${
                        isSelected ? 'bg-primary/20 text-primary-light' : 'bg-surface-active text-text-muted'
                      }`}>
                        {c.profiles?.politician_profiles?.[0]?.avatar_url ? (
                          <img src={c.profiles.politician_profiles[0].avatar_url} alt={name} className="w-full h-full object-cover" />
                        ) : (
                          <Users size={18} />
                        )}
                      </div>
                      <span className={`text-sm font-semibold whitespace-nowrap ${isSelected ? 'text-primary-light' : 'text-text-secondary'}`}>
                        {name}
                      </span>
                      {c.nomination_filed && (
                        <CheckCircle2 size={14} className="text-success shrink-0" title="Nomination papers filed" />
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedCandidateId && <CandidacyWall candidateId={selectedCandidateId} embedded />}
            </>
          )}
        </div>

        {/* Right sidebar: actions that are about the visitor's own relationship
            to this seat, not the candidates themselves — kept out of the main
            column so it doesn't push candidate content down the page. */}
        {hasSidebar && (
          <div className="w-full lg:w-72 shrink-0 space-y-4 lg:sticky lg:top-6">
            {role === 'normal' && (
              <Card padding="sm" className="bg-primary/10 border-primary/25">
                <p className="text-sm text-text-secondary mb-3">
                  Want to run for this seat? Switch your account to a politician profile to nominate yourself.
                </p>
                <Button onClick={() => navigate('/profile')} className="w-full">
                  Become a Politician
                </Button>
              </Card>
            )}

            {role === 'politician' && (
              <Card padding="sm" className="bg-primary/10 border-primary/25">
                {alreadyApplied ? (
                  <>
                    <p className="text-sm text-text-secondary mb-3">You've already applied for this seat.</p>
                    <Button variant="secondary" onClick={() => navigate('/politician/elections')} className="w-full">
                      Manage My Candidacies
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-text-secondary mb-3">Think you'd be a good fit for {seat.role_title}?</p>
                    <Button onClick={startApplying} disabled={applying} className="w-full">
                      {applying ? 'Starting...' : 'Nominate Yourself'}
                    </Button>
                  </>
                )}
              </Card>
            )}

            {adminStatus && (
              <Card variant="row" padding="sm">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck size={16} className="text-accent" />
                  <h3 className="text-sm font-bold text-text-main">Election Administrator</h3>
                </div>

                {adminStatus.my_application_status === 'approved' ? (
                  <>
                    <p className="text-sm text-text-secondary mt-2 mb-3">
                      You administer this seat. You can add a candidate who is running but hasn't registered on the platform yet.
                    </p>
                    {!showAddCandidateForm ? (
                      <Button onClick={() => setShowAddCandidateForm(true)} className="w-full">
                        Add a Candidate
                      </Button>
                    ) : (
                      <form onSubmit={submitUnregisteredCandidate} className="space-y-3 mt-3">
                        <Input
                          type="text" required placeholder="Candidate's full name" value={newCandidateName}
                          onChange={e => setNewCandidateName(e.target.value)}
                        />
                        <Select value={newCandidateParty} onChange={e => setNewCandidateParty(e.target.value)}>
                          <option value="">No party / Independent</option>
                          {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </Select>
                        <Input
                          type="text" placeholder="Education (optional)" value={newCandidateEducation}
                          onChange={e => setNewCandidateEducation(e.target.value)}
                        />
                        <Input
                          type="text" placeholder="Hometown (optional)" value={newCandidateHometown}
                          onChange={e => setNewCandidateHometown(e.target.value)}
                        />
                        <Textarea
                          placeholder="Short bio (optional)" value={newCandidateBio} rows={2}
                          onChange={e => setNewCandidateBio(e.target.value)}
                        />
                        <div className="flex items-center gap-2">
                          <Button type="submit" disabled={addingCandidate}>
                            {addingCandidate ? 'Adding...' : 'Add Candidate'}
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => setShowAddCandidateForm(false)}>
                            Cancel
                          </Button>
                        </div>
                        {addCandidateStatus && <p className="text-danger text-xs">{addCandidateStatus}</p>}
                      </form>
                    )}
                  </>
                ) : adminStatus.my_application_status === 'pending' ? (
                  <p className="text-sm text-text-secondary mt-2">Your application to administer this seat is under review.</p>
                ) : adminStatus.my_application_status === 'rejected' ? (
                  <p className="text-sm text-text-secondary mt-2">Your application to administer this seat was not approved.</p>
                ) : adminStatus.has_approved_admin ? (
                  <p className="text-sm text-text-secondary mt-2">This seat already has an election administrator.</p>
                ) : (
                  <>
                    <p className="text-sm text-text-secondary mt-2 mb-3">
                      Volunteer to moderate this seat and help add candidates who are missing from the platform.
                    </p>
                    {!showAdminApplyForm ? (
                      <Button variant="secondary" onClick={() => setShowAdminApplyForm(true)} className="w-full">
                        Volunteer to Administer This Seat
                      </Button>
                    ) : (
                      <form onSubmit={submitElectionAdminApplication} className="space-y-3">
                        <Textarea
                          required placeholder="Tell us about yourself and why you're interested..."
                          value={adminMotivation} rows={3}
                          onChange={e => setAdminMotivation(e.target.value)}
                        />
                        <Input
                          type="text" placeholder="Do you run any social media communities? (optional)"
                          value={adminSocialMedia} onChange={e => setAdminSocialMedia(e.target.value)}
                        />
                        <Input
                          type="email" required placeholder="Contact email"
                          value={adminContactEmail} onChange={e => setAdminContactEmail(e.target.value)}
                        />
                        <div className="flex items-center gap-2">
                          <Button type="submit" disabled={submittingAdminApp}>
                            {submittingAdminApp ? 'Submitting...' : 'Submit Application'}
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => setShowAdminApplyForm(false)}>
                            Cancel
                          </Button>
                        </div>
                        {adminAppStatus && <p className="text-danger text-xs">{adminAppStatus}</p>}
                      </form>
                    )}
                  </>
                )}
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
