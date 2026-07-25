import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import CandidacyWall from '../components/CandidacyWall';
import {
  getSeatById, getCandidatesBySeatIds, getMyCandidacies, applyForSeat,
  getSeatAdminStatus, applyForElectionAdmin, addUnregisteredCandidate
} from '../services/elections';
import { getPoliticalParties } from '../services/politicalParties';
import { getProfileRole } from '../services/profile';
import { Vote, MapPin, ArrowLeft, Users, Calendar, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function ElectionSeatPage() {
  const { seatId } = useParams();
  const { user } = useAuth();
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

    const { data: myProfile } = await getProfileRole(user.id);
    setRole(myProfile?.role || null);

    const { data: candidacies } = await getMyCandidacies(user.id);
    setMyCandidacies(candidacies || []);

    const { data: seatAdminStatus } = await getSeatAdminStatus(seatId);
    setAdminStatus(seatAdminStatus);

    if (seatRow?.map_shapes?.country) {
      const { data: partyRows } = await getPoliticalParties({ country: seatRow.map_shapes.country });
      setParties(partyRows || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (user && seatId) fetchAll();
  }, [user, seatId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    return (
      <div className="w-full flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!seat) {
    return <div className="w-full text-center py-20 text-text-muted">Seat not found.</div>;
  }

  const alreadyApplied = myCandidacies.some(c => c.seat_id === seatId);

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8">
      <div className="w-full min-w-0 max-w-6xl mx-auto">
        <button onClick={() => navigate('/elections')} className="flex items-center gap-2 text-text-muted hover:text-text-secondary mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to Elections
        </button>

        {/* Seat / Election Header */}
        <div className="relative overflow-hidden bg-surface/30 backdrop-blur-md rounded-3xl border border-border-light/45 shadow-xl mb-6 p-8">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
          <div className="relative flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 rounded-full uppercase tracking-wider">
              <Vote size={12} /> {seat.elections?.status?.replace('_', ' ')}
            </span>
            <span className="text-xs text-text-muted">{seat.elections?.name}</span>
          </div>
          <h1 className="relative text-3xl sm:text-4xl font-bold text-text-main tracking-tight">{seat.role_title}</h1>
          <div className="relative flex items-center gap-4 mt-3 flex-wrap text-sm text-text-muted">
            <span className="flex items-center gap-1.5">
              <MapPin size={14} className="text-accent" /> {seat.map_shapes?.name}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar size={14} className="text-accent" /> {seat.elections?.election_date}
            </span>
            <span className="flex items-center gap-1.5">
              <Users size={14} className="text-accent" /> {candidates.length} candidate{candidates.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Nominate Yourself */}
        {role === 'normal' && (
          <div className="mb-6 p-5 bg-primary/10 border border-primary/25 rounded-2xl flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-text-secondary">
              Want to run for this seat? Switch your account to a politician profile to nominate yourself.
            </p>
            <button
              onClick={() => navigate('/profile')}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-slate-950 font-bold rounded-lg text-sm transition-colors shrink-0"
            >
              Become a Politician
            </button>
          </div>
        )}

        {role === 'politician' && (
          <div className="mb-6 p-5 bg-primary/10 border border-primary/25 rounded-2xl flex items-center justify-between gap-4 flex-wrap">
            {alreadyApplied ? (
              <>
                <p className="text-sm text-text-secondary">You've already applied for this seat.</p>
                <button
                  onClick={() => navigate('/politician/elections')}
                  className="px-4 py-2 bg-surface-active hover:bg-border text-text-main font-semibold rounded-lg text-sm transition-colors shrink-0"
                >
                  Manage My Candidacies
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-text-secondary">Think you'd be a good fit for {seat.role_title}?</p>
                <button
                  onClick={startApplying}
                  disabled={applying}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-slate-950 font-bold rounded-lg text-sm transition-colors shrink-0 disabled:opacity-50"
                >
                  {applying ? 'Starting...' : 'Nominate Yourself'}
                </button>
              </>
            )}
          </div>
        )}
        {status && <p className="text-danger text-xs mb-6">{status}</p>}

        {/* Election Administrator */}
        {adminStatus && (
          <div className="mb-6 p-5 bg-surface/30 border border-border-light/45 rounded-2xl">
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
                  <button
                    onClick={() => setShowAddCandidateForm(true)}
                    className="px-4 py-2 bg-primary hover:bg-primary-hover text-slate-950 font-bold rounded-lg text-sm transition-colors"
                  >
                    Add a Candidate
                  </button>
                ) : (
                  <form onSubmit={submitUnregisteredCandidate} className="space-y-3 mt-3">
                    <input
                      type="text" required placeholder="Candidate's full name" value={newCandidateName}
                      onChange={e => setNewCandidateName(e.target.value)}
                      className="w-full bg-surface-hover border border-border-light rounded-lg p-2.5 text-sm text-text-main outline-none focus:border-primary"
                    />
                    <select
                      value={newCandidateParty} onChange={e => setNewCandidateParty(e.target.value)}
                      className="w-full bg-surface-hover border border-border-light rounded-lg p-2.5 text-sm text-text-main outline-none focus:border-primary"
                    >
                      <option value="">No party / Independent</option>
                      {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text" placeholder="Education (optional)" value={newCandidateEducation}
                        onChange={e => setNewCandidateEducation(e.target.value)}
                        className="w-full bg-surface-hover border border-border-light rounded-lg p-2.5 text-sm text-text-main outline-none focus:border-primary"
                      />
                      <input
                        type="text" placeholder="Hometown (optional)" value={newCandidateHometown}
                        onChange={e => setNewCandidateHometown(e.target.value)}
                        className="w-full bg-surface-hover border border-border-light rounded-lg p-2.5 text-sm text-text-main outline-none focus:border-primary"
                      />
                    </div>
                    <textarea
                      placeholder="Short bio (optional)" value={newCandidateBio} rows={2}
                      onChange={e => setNewCandidateBio(e.target.value)}
                      className="w-full bg-surface-hover border border-border-light rounded-lg p-2.5 text-sm text-text-main outline-none focus:border-primary resize-none"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="submit" disabled={addingCandidate}
                        className="px-4 py-2 bg-primary hover:bg-primary-hover text-slate-950 font-bold rounded-lg text-sm transition-colors disabled:opacity-50"
                      >
                        {addingCandidate ? 'Adding...' : 'Add Candidate'}
                      </button>
                      <button
                        type="button" onClick={() => setShowAddCandidateForm(false)}
                        className="px-4 py-2 text-text-muted hover:text-text-main text-sm font-semibold"
                      >
                        Cancel
                      </button>
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
                  <button
                    onClick={() => setShowAdminApplyForm(true)}
                    className="px-4 py-2 bg-surface-active hover:bg-border text-text-main font-semibold rounded-lg text-sm transition-colors"
                  >
                    Volunteer to Administer This Seat
                  </button>
                ) : (
                  <form onSubmit={submitElectionAdminApplication} className="space-y-3">
                    <textarea
                      required placeholder="Tell us about yourself and why you're interested..."
                      value={adminMotivation} rows={3}
                      onChange={e => setAdminMotivation(e.target.value)}
                      className="w-full bg-surface-hover border border-border-light rounded-lg p-2.5 text-sm text-text-main outline-none focus:border-primary resize-none"
                    />
                    <input
                      type="text" placeholder="Do you run any social media communities? (optional)"
                      value={adminSocialMedia} onChange={e => setAdminSocialMedia(e.target.value)}
                      className="w-full bg-surface-hover border border-border-light rounded-lg p-2.5 text-sm text-text-main outline-none focus:border-primary"
                    />
                    <input
                      type="email" required placeholder="Contact email"
                      value={adminContactEmail} onChange={e => setAdminContactEmail(e.target.value)}
                      className="w-full bg-surface-hover border border-border-light rounded-lg p-2.5 text-sm text-text-main outline-none focus:border-primary"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="submit" disabled={submittingAdminApp}
                        className="px-4 py-2 bg-primary hover:bg-primary-hover text-slate-950 font-bold rounded-lg text-sm transition-colors disabled:opacity-50"
                      >
                        {submittingAdminApp ? 'Submitting...' : 'Submit Application'}
                      </button>
                      <button
                        type="button" onClick={() => setShowAdminApplyForm(false)}
                        className="px-4 py-2 text-text-muted hover:text-text-main text-sm font-semibold"
                      >
                        Cancel
                      </button>
                    </div>
                    {adminAppStatus && <p className="text-danger text-xs">{adminAppStatus}</p>}
                  </form>
                )}
              </>
            )}
          </div>
        )}

        {/* Candidate Switcher */}
        {candidates.length === 0 ? (
          <div className="text-center py-16 bg-surface/20 rounded-2xl border border-dashed border-border-light/60 mb-8">
            <div className="w-16 h-16 rounded-full bg-surface-hover flex items-center justify-center mx-auto mb-4">
              <Vote className="text-text-muted w-8 h-8" />
            </div>
            <h3 className="text-text-tertiary font-medium mb-1">No Candidates Yet</h3>
            <p className="text-text-muted text-sm">Nobody has applied for this seat yet — be the first to run.</p>
          </div>
        ) : (
          <>
            {candidates.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2 mb-6" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {candidates.map(c => {
                  const name = c.profiles?.full_name || `Ghost-${c.profiles?.current_ghost_id?.split('-')[0]}`;
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
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-primary/20 text-primary-light' : 'bg-surface-active text-text-muted'
                      }`}>
                        <Users size={18} />
                      </div>
                      <span className={`text-sm font-semibold whitespace-nowrap ${isSelected ? 'text-primary-light' : 'text-text-secondary'}`}>
                        {name}
                      </span>
                      {c.nomination_filed && (
                        <CheckCircle2 size={14} className="text-emerald-400 shrink-0" title="Nomination papers filed" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {selectedCandidateId && <CandidacyWall candidateId={selectedCandidateId} embedded />}
          </>
        )}
      </div>
    </div>
  );
}
