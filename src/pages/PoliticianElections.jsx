import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Vote, MapPin, ExternalLink, FileEdit, Search, X } from 'lucide-react';

const STATUS_COPY = {
  pending: { label: 'Pending Review', className: 'bg-amber-500/20 text-amber-300' },
  approved: { label: 'Approved', className: 'bg-emerald-500/20 text-emerald-300' },
  rejected: { label: 'Not Approved', className: 'bg-danger/20 text-rose-300' }
};

export default function PoliticianElections() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [openSeats, setOpenSeats] = useState([]); // seats in the politician's own boundaries
  const [myCandidacies, setMyCandidacies] = useState([]);
  const [myShapeIds, setMyShapeIds] = useState(new Set());
  const [applyingSeatId, setApplyingSeatId] = useState(null);
  const [status, setStatus] = useState('');

  // "Browse a different area" — country + province/state container filter,
  // for a politician who wants to run somewhere other than where they live.
  const [browsing, setBrowsing] = useState(false);
  const [countries, setCountries] = useState([]);
  const [browseCountry, setBrowseCountry] = useState('');
  const [containerTypes, setContainerTypes] = useState([]);
  const [browseContainerType, setBrowseContainerType] = useState('');
  const [containers, setContainers] = useState([]);
  const [browseContainerId, setBrowseContainerId] = useState('');
  const [browseSeats, setBrowseSeats] = useState(null); // null = no search run yet
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseStatus, setBrowseStatus] = useState('');

  const fetchAll = async () => {
    setLoading(true);

    const { data: memberships } = await supabase
      .from('user_boundary_memberships')
      .select('map_shape_id')
      .eq('profile_id', user.id);
    const shapeIds = (memberships || []).map(m => m.map_shape_id);
    setMyShapeIds(new Set(shapeIds));

    // Nominations stay open through the election date itself, across both
    // the nominations_open and active statuses — matches apply_for_seat's
    // own check, so a seat that appears here never gets rejected on submit.
    // Scoped to the politician's own boundaries by default — "browse a
    // different area" below is how they see anything wider than that.
    if (shapeIds.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: seats } = await supabase
        .from('election_seats')
        .select('id, role_title, map_shape_id, map_shapes(name, boundary_type, country), elections!inner(id, name, election_date, status)')
        .in('map_shape_id', shapeIds)
        .in('elections.status', ['nominations_open', 'active'])
        .gte('elections.election_date', today)
        .order('role_title');
      setOpenSeats(seats || []);
    } else {
      setOpenSeats([]);
    }

    const { data: candidacies } = await supabase
      .from('election_candidates')
      .select('id, statement, seat_id, status, submitted_at, election_seats(role_title, map_shapes(name), elections(name, status))')
      .eq('politician_id', user.id)
      .order('created_at', { ascending: false });
    setMyCandidacies(candidacies || []);

    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchAll();
    supabase.from('countries').select('name').order('name')
      .then(({ data }) => setCountries((data || []).map(c => c.name)));
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setBrowseContainerType('');
    setContainers([]);
    setBrowseContainerId('');
    setBrowseSeats(null);
    if (!browseCountry) {
      setContainerTypes([]);
      return;
    }
    supabase
      .from('country_boundary_types')
      .select('type_name')
      .eq('country', browseCountry)
      .eq('admin_only', true)
      .order('rank')
      .then(({ data }) => setContainerTypes((data || []).map(t => t.type_name)));
  }, [browseCountry]);

  useEffect(() => {
    setBrowseContainerId('');
    setBrowseSeats(null);
    if (!browseCountry || !browseContainerType) {
      setContainers([]);
      return;
    }
    supabase
      .from('map_shapes')
      .select('id, name')
      .eq('country', browseCountry)
      .eq('boundary_type', browseContainerType)
      .is('retired_at', null)
      .order('name')
      .then(({ data }) => setContainers(data || []));
  }, [browseCountry, browseContainerType]);

  const searchContainer = async () => {
    if (!browseContainerId) return;
    setBrowseLoading(true);
    setBrowseStatus('');
    const { data, error } = await supabase.rpc('find_open_seats_in_container', {
      p_container_shape_id: Number(browseContainerId)
    });
    setBrowseLoading(false);
    if (error) {
      setBrowseStatus('Error: ' + error.message);
      return;
    }
    setBrowseSeats(data || []);
    if ((data || []).length === 0) {
      setBrowseStatus('No open seats found there.');
    }
  };

  const myCandidacySeatIds = new Set(myCandidacies.map(c => c.seat_id));

  // Starting an application creates the (draft, status='pending') candidacy
  // row immediately, then hands off to the dedicated application page for
  // the questionnaire + intro video — nothing here makes the candidate
  // publicly visible yet, that only happens once an admin approves.
  const startApplying = async (seatId) => {
    setApplyingSeatId(seatId);
    setStatus('');
    const { data, error } = await supabase.rpc('apply_for_seat', {
      p_seat_id: seatId,
      p_statement: null
    });
    setApplyingSeatId(null);
    if (error) {
      setStatus('Error: ' + error.message);
      return;
    }
    navigate(`/apply/${data.id}`);
  };

  const withdraw = async (candidateId) => {
    if (!window.confirm('Withdraw this candidacy?')) return;
    await supabase.from('election_candidates').delete().eq('id', candidateId);
    fetchAll();
  };

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 space-y-10">
      <div className="flex items-center gap-3">
        <Vote className="text-primary" size={24} />
        <h1 className="text-2xl font-bold text-text-main">Elections</h1>
      </div>

      {/* My Candidacies */}
      <section>
        <h2 className="text-lg font-bold text-text-secondary mb-4">My Candidacies</h2>
        {myCandidacies.length === 0 ? (
          <p className="text-sm text-text-muted bg-surface/20 rounded-xl border border-dashed border-border-light/60 p-6 text-center">
            You haven't applied to any seats yet.
          </p>
        ) : (
          <div className="space-y-3">
            {myCandidacies.map(c => {
              const statusInfo = STATUS_COPY[c.status] || STATUS_COPY.pending;
              return (
                <div key={c.id} className="p-4 bg-surface/30 rounded-xl border border-border-light/35 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-bold text-text-secondary text-sm">{c.election_seats?.role_title} — {c.election_seats?.map_shapes?.name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-text-muted">
                        {c.election_seats?.elections?.name} · {c.election_seats?.elections?.status?.replace('_', ' ')}
                      </span>
                      {c.submitted_at ? (
                        <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${statusInfo.className}`}>{statusInfo.label}</span>
                      ) : (
                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-surface-active text-text-muted">Draft — not submitted</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => navigate(`/apply/${c.id}`)} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-active hover:bg-border text-text-main rounded-lg text-xs font-semibold transition-colors">
                      <FileEdit size={13} /> {c.submitted_at ? 'Edit Application' : 'Continue Application'}
                    </button>
                    {c.status === 'approved' && (
                      <button onClick={() => navigate(`/candidacy/${c.id}`)} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary-light hover:bg-primary/20 rounded-lg text-xs font-semibold transition-colors">
                        <ExternalLink size={13} /> Campaign Page
                      </button>
                    )}
                    <button onClick={() => withdraw(c.id)} className="px-3 py-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg text-xs font-semibold transition-colors">
                      Withdraw
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Open Seats near me */}
      <section>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-lg font-bold text-text-secondary">Open Seats Near You</h2>
          <button
            onClick={() => setBrowsing(!browsing)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-active hover:bg-border text-text-main rounded-lg text-xs font-semibold transition-colors"
          >
            <Search size={13} /> {browsing ? 'Hide' : 'Browse a Different Area'}
          </button>
        </div>

        {openSeats.length === 0 ? (
          <p className="text-sm text-text-muted bg-surface/20 rounded-xl border border-dashed border-border-light/60 p-6 text-center">
            No elections are currently accepting nominations for any group you belong to.
          </p>
        ) : (
          <div className="space-y-3">
            {openSeats.map(seat => {
              const alreadyApplied = myCandidacySeatIds.has(seat.id);
              return (
                <div key={seat.id} className="p-4 bg-surface/30 rounded-xl border border-border-light/35">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-bold text-text-secondary text-sm">{seat.role_title} — {seat.map_shapes?.name}</p>
                      <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1.5">
                        <MapPin size={12} /> {seat.elections?.name} · {seat.elections?.election_date}
                      </p>
                    </div>
                    {alreadyApplied ? (
                      <span className="text-xs font-semibold text-emerald-400">Applied ✓</span>
                    ) : (
                      <button
                        onClick={() => startApplying(seat.id)}
                        disabled={applyingSeatId === seat.id}
                        className="px-4 py-2 bg-primary hover:bg-primary-hover text-slate-950 font-bold rounded-lg text-xs transition-colors disabled:opacity-50"
                      >
                        {applyingSeatId === seat.id ? 'Starting...' : 'Apply'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {status && <p className="text-danger text-xs mt-3">{status}</p>}
      </section>

      {/* Browse a different area */}
      {browsing && (
        <section className="p-5 bg-surface/20 rounded-2xl border border-border-light/40 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-text-secondary">Browse a Different Area</h2>
            <button onClick={() => setBrowsing(false)} className="p-1 text-text-muted hover:text-text-main rounded-lg">
              <X size={16} />
            </button>
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block mb-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">Country</label>
              <select
                value={browseCountry}
                onChange={e => setBrowseCountry(e.target.value)}
                className="p-2.5 bg-surface-hover border border-border-light text-sm text-text-main rounded-lg focus:outline-none focus:border-primary"
              >
                <option value="">Select country...</option>
                {countries.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">Province / State</label>
              <select
                value={browseContainerType}
                onChange={e => setBrowseContainerType(e.target.value)}
                disabled={!browseCountry}
                className="p-2.5 bg-surface-hover border border-border-light text-sm text-text-main rounded-lg focus:outline-none focus:border-primary disabled:opacity-50"
              >
                <option value="">{browseCountry ? 'Select type...' : 'Select a country first'}</option>
                {containerTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">&nbsp;</label>
              <select
                value={browseContainerId}
                onChange={e => setBrowseContainerId(e.target.value)}
                disabled={!browseContainerType}
                className="p-2.5 bg-surface-hover border border-border-light text-sm text-text-main rounded-lg focus:outline-none focus:border-primary disabled:opacity-50"
              >
                <option value="">{browseContainerType ? `Select a ${browseContainerType}...` : 'Select a type first'}</option>
                {containers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button
              onClick={searchContainer}
              disabled={!browseContainerId || browseLoading}
              className="px-4 py-2.5 bg-primary hover:bg-primary-hover text-slate-950 font-bold rounded-lg text-xs transition-colors disabled:opacity-50"
            >
              {browseLoading ? 'Searching...' : 'Search'}
            </button>
          </div>

          {browseStatus && <p className="text-xs text-text-muted">{browseStatus}</p>}

          {browseSeats && browseSeats.length > 0 && (
            <div className="space-y-3 pt-2">
              {browseSeats.map(seat => {
                const alreadyApplied = myCandidacySeatIds.has(seat.seat_id);
                return (
                  <div key={seat.seat_id} className="p-4 bg-surface/30 rounded-xl border border-border-light/35">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-bold text-text-secondary text-sm">
                          {seat.role_title} — {seat.shape_name}
                          <span className="text-[10px] text-text-muted font-normal ml-1.5">({seat.boundary_type})</span>
                        </p>
                        <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1.5">
                          <MapPin size={12} /> {seat.election_name} · {seat.election_date}
                        </p>
                      </div>
                      {alreadyApplied ? (
                        <span className="text-xs font-semibold text-emerald-400">Applied ✓</span>
                      ) : (
                        <button
                          onClick={() => startApplying(seat.seat_id)}
                          disabled={applyingSeatId === seat.seat_id}
                          className="px-4 py-2 bg-primary hover:bg-primary-hover text-slate-950 font-bold rounded-lg text-xs transition-colors disabled:opacity-50"
                        >
                          {applyingSeatId === seat.seat_id ? 'Starting...' : 'Apply'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
