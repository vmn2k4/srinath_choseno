import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import BoundaryPicker from '../../components/map/BoundaryPicker';
import { Plus, Trash2, Landmark, MapPin, Vote } from 'lucide-react';

const STATUS_FLOW = {
  draft: 'nominations_open',
  nominations_open: 'active',
  active: 'closed'
};
const STATUS_LABEL = {
  draft: 'Open Nominations',
  nominations_open: 'Activate Election',
  active: 'Close Election'
};

export default function ElectionsAdmin() {
  const [elections, setElections] = useState([]);
  const [loadingElections, setLoadingElections] = useState(true);
  const [selectedElection, setSelectedElection] = useState(null);

  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [createStatus, setCreateStatus] = useState('');

  const [seats, setSeats] = useState([]); // [{id, role_title, map_shapes: {...}, candidateCount}]
  const [loadingSeats, setLoadingSeats] = useState(false);

  const [countries, setCountries] = useState([]);
  const [seatCountry, setSeatCountry] = useState('');
  const [boundaryTypes, setBoundaryTypes] = useState([]); // country_boundary_types
  const [containerType, setContainerType] = useState('');
  const [containerId, setContainerId] = useState(new Set());
  const [targetType, setTargetType] = useState('');
  const [pendingShapeIds, setPendingShapeIds] = useState(new Set());
  const [roleTitle, setRoleTitle] = useState('');
  const [seatStatus, setSeatStatus] = useState('');

  const fetchElections = async () => {
    setLoadingElections(true);
    const { data } = await supabase.from('elections').select('*').order('created_at', { ascending: false });
    setElections(data || []);
    setLoadingElections(false);
  };

  const fetchCountries = async () => {
    const { data } = await supabase.from('countries').select('name').order('name');
    setCountries((data || []).map(c => c.name));
  };

  const fetchBoundaryTypes = async () => {
    const { data } = await supabase.from('country_boundary_types').select('country, type_name, rank').order('country').order('rank');
    setBoundaryTypes(data || []);
  };

  useEffect(() => {
    fetchElections();
    fetchCountries();
    fetchBoundaryTypes();
  }, []);

  const typesForSeatCountry = seatCountry ? boundaryTypes.filter(t => t.country === seatCountry) : [];

  // Country scopes both the container/target-type pickers and the manual
  // seat picker below — reset any selection tied to the previous country.
  useEffect(() => {
    setTargetType('');
    setContainerType('');
    setContainerId(new Set());
    setPendingShapeIds(new Set());
  }, [seatCountry]);

  const fetchSeats = async (electionId) => {
    setLoadingSeats(true);
    const { data: seatRows } = await supabase
      .from('election_seats')
      .select('id, role_title, map_shapes(id, name, boundary_type, country)')
      .eq('election_id', electionId)
      .order('role_title');

    const seatIds = (seatRows || []).map(s => s.id);
    let candidatesBySeat = {};
    if (seatIds.length > 0) {
      const { data: candidateRows } = await supabase
        .from('election_candidates')
        .select('id, seat_id, statement, profiles(full_name, current_ghost_id)')
        .in('seat_id', seatIds);
      (candidateRows || []).forEach(c => {
        candidatesBySeat[c.seat_id] = candidatesBySeat[c.seat_id] || [];
        candidatesBySeat[c.seat_id].push(c);
      });
    }

    setSeats((seatRows || []).map(s => ({ ...s, candidates: candidatesBySeat[s.id] || [] })));
    setLoadingSeats(false);
  };

  const selectElection = (election) => {
    setSelectedElection(election);
    setPendingShapeIds(new Set());
    setContainerId(new Set());
    setRoleTitle('');
    setSeatStatus('');
    fetchSeats(election.id);
  };

  const handleCreateElection = async () => {
    if (!newName.trim() || !newDate) {
      setCreateStatus('Error: name and election date are required.');
      return;
    }
    const { data, error } = await supabase
      .from('elections')
      .insert({ name: newName.trim(), election_date: newDate })
      .select()
      .single();
    if (error) {
      setCreateStatus('Error: ' + error.message);
      return;
    }
    setNewName('');
    setNewDate('');
    setCreateStatus('');
    await fetchElections();
    selectElection(data);
  };

  const handleFindMatching = async () => {
    const containerShapeId = [...containerId][0];
    if (!containerShapeId || !targetType) {
      setSeatStatus('Pick a container boundary and a target type first.');
      return;
    }
    const { data, error } = await supabase.rpc('find_shapes_within', {
      p_container_shape_id: containerShapeId,
      p_target_boundary_type: targetType,
      p_country: seatCountry || null
    });
    if (error) {
      setSeatStatus('Error: ' + error.message);
      return;
    }
    setPendingShapeIds(prev => {
      const next = new Set(prev);
      (data || []).forEach(shape => next.add(shape.id));
      return next;
    });
    setSeatStatus(`Added ${data?.length || 0} matching boundaries to the selection below — review and deselect any stragglers before creating seats.`);
  };

  const handleCreateSeats = async () => {
    if (!roleTitle.trim() || pendingShapeIds.size === 0) {
      setSeatStatus('Error: enter a role title and select at least one boundary.');
      return;
    }
    const rows = [...pendingShapeIds].map(map_shape_id => ({
      election_id: selectedElection.id,
      map_shape_id,
      role_title: roleTitle.trim()
    }));
    const { error } = await supabase.from('election_seats').insert(rows);
    if (error) {
      setSeatStatus('Error: ' + error.message);
      return;
    }
    setPendingShapeIds(new Set());
    setContainerId(new Set());
    setRoleTitle('');
    setSeatStatus(`Created ${rows.length} seat(s).`);
    fetchSeats(selectedElection.id);
  };

  const handleDeleteSeat = async (seatId) => {
    if (!window.confirm('Delete this seat? Any candidate applications for it will be removed too.')) return;
    await supabase.from('election_seats').delete().eq('id', seatId);
    fetchSeats(selectedElection.id);
  };

  const handleDeleteCandidate = async (candidateId) => {
    if (!window.confirm('Remove this candidate from the seat?')) return;
    await supabase.from('election_candidates').delete().eq('id', candidateId);
    fetchSeats(selectedElection.id);
  };

  const advanceStatus = async () => {
    const nextStatus = STATUS_FLOW[selectedElection.status];
    if (!nextStatus) return;
    const { error } = await supabase.from('elections').update({ status: nextStatus }).eq('id', selectedElection.id);
    if (error) {
      setSeatStatus('Error: ' + error.message);
      return;
    }
    const updated = { ...selectedElection, status: nextStatus };
    setSelectedElection(updated);
    fetchElections();
  };

  return (
    <div className="w-full max-w-none grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-8 animate-fade-in p-4 lg:p-0 px-4 lg:px-8">

      {/* Admin sub-nav */}
      <div className="lg:col-span-2 flex gap-2">
        <Link to="/admin" className="px-4 py-2 rounded-xl text-sm font-semibold text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors">Boundaries</Link>
        <span className="px-4 py-2 rounded-xl text-sm font-semibold text-primary bg-primary/10 border border-primary/30">Elections</span>
      </div>

      {/* LEFT: Elections list + create */}
      <div className="p-6 bg-surface/30 backdrop-blur-md rounded-2xl border border-border-light/45 shadow-xl self-start space-y-5">
        <h2 className="text-xl font-bold text-text-main flex items-center gap-2"><Vote size={20} className="text-primary" /> Elections</h2>

        <div className="space-y-2.5 p-3 bg-surface/40 rounded-xl border border-border-light/30">
          <input
            type="text"
            placeholder="Election name (e.g. 2028 Municipal Elections)"
            className="w-full p-2.5 bg-surface-hover border border-border-light text-sm text-text-main rounded-lg focus:outline-none focus:border-primary"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <input
            type="date"
            className="w-full p-2.5 bg-surface-hover border border-border-light text-sm text-text-main rounded-lg focus:outline-none focus:border-primary"
            value={newDate}
            onChange={e => setNewDate(e.target.value)}
          />
          <button onClick={handleCreateElection} className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary-hover text-slate-950 font-bold rounded-lg text-sm transition-colors">
            <Plus size={16} /> Create Election
          </button>
          {createStatus && <p className="text-danger text-xs">{createStatus}</p>}
        </div>

        <div className="space-y-2">
          {loadingElections ? (
            <p className="text-xs text-text-muted text-center py-4">Loading...</p>
          ) : elections.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-4">No elections yet.</p>
          ) : (
            elections.map(e => (
              <button
                key={e.id}
                onClick={() => selectElection(e)}
                className={`w-full text-left p-3 rounded-xl border transition-colors ${selectedElection?.id === e.id ? 'bg-primary/10 border-primary/40' : 'bg-surface/30 border-border-light/30 hover:bg-surface-hover'}`}
              >
                <p className="text-sm font-bold text-text-secondary truncate">{e.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-text-muted">{e.election_date}</span>
                  <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                    e.status === 'draft' ? 'bg-surface-active text-text-muted' :
                    e.status === 'nominations_open' ? 'bg-amber-500/20 text-amber-300' :
                    e.status === 'active' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-500/20 text-slate-300'
                  }`}>{e.status.replace('_', ' ')}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* RIGHT: Selected election detail */}
      <div className="space-y-6">
        {!selectedElection ? (
          <div className="p-10 bg-surface/20 rounded-2xl border border-dashed border-border-light/60 text-center text-text-muted text-sm">
            Select or create an election to manage its seats.
          </div>
        ) : (
          <>
            <div className="p-6 bg-surface/30 backdrop-blur-md rounded-2xl border border-border-light/45 shadow-xl flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-xl font-bold text-text-main">{selectedElection.name}</h2>
                <p className="text-xs text-text-muted mt-1">{selectedElection.election_date} · Status: <span className="font-semibold text-text-secondary">{selectedElection.status.replace('_', ' ')}</span></p>
              </div>
              {STATUS_FLOW[selectedElection.status] && (
                <button onClick={advanceStatus} className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-slate-950 font-bold rounded-xl text-sm transition-colors">
                  {STATUS_LABEL[selectedElection.status]}
                </button>
              )}
            </div>

            {selectedElection.status === 'draft' && (
              <div className="p-6 bg-surface/30 backdrop-blur-md rounded-2xl border border-border-light/45 shadow-xl space-y-5">
                <h3 className="text-lg font-bold text-text-main flex items-center gap-2"><Landmark size={18} className="text-primary" /> Build Seats</h3>

                <div>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Country</p>
                  <select
                    value={seatCountry}
                    onChange={e => setSeatCountry(e.target.value)}
                    className="w-full max-w-xs p-2.5 bg-surface-hover border border-border-light text-sm text-text-main rounded-lg focus:outline-none focus:border-primary"
                  >
                    <option value="">Select country...</option>
                    {countries.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">1. Auto-select by container (optional)</p>
                  <select
                    value={containerType}
                    onChange={e => { setContainerType(e.target.value); setContainerId(new Set()); }}
                    disabled={!seatCountry}
                    className="w-full max-w-xs mb-2 p-2.5 bg-surface-hover border border-border-light text-sm text-text-main rounded-lg focus:outline-none focus:border-primary disabled:opacity-50"
                  >
                    <option value="">{seatCountry ? 'Container type: all types' : 'Select a country first'}</option>
                    {typesForSeatCountry.map(t => (
                      <option key={t.type_name} value={t.type_name}>{t.type_name}</option>
                    ))}
                  </select>
                  <BoundaryPicker
                    mode="single"
                    selectedIds={containerId}
                    onChange={setContainerId}
                    countryFilter={seatCountry || undefined}
                    boundaryTypeFilter={containerType ? [containerType] : undefined}
                    height="280px"
                  />
                  <div className="flex flex-wrap gap-3 mt-3">
                    <select
                      value={targetType}
                      onChange={e => setTargetType(e.target.value)}
                      disabled={!seatCountry}
                      className="flex-1 min-w-[200px] p-2.5 bg-surface-hover border border-border-light text-sm text-text-main rounded-lg focus:outline-none focus:border-primary disabled:opacity-50"
                    >
                      <option value="">{seatCountry ? 'Select target boundary type...' : 'Select a country first'}</option>
                      {typesForSeatCountry.map(t => (
                        <option key={t.type_name} value={t.type_name}>{t.type_name}</option>
                      ))}
                    </select>
                    <button onClick={handleFindMatching} className="px-4 py-2.5 bg-surface-active hover:bg-border text-text-main rounded-lg text-sm font-semibold transition-colors">
                      Find Matching Boundaries
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">2. Review / manually add seat boundaries</p>
                  <BoundaryPicker mode="multi" selectedIds={pendingShapeIds} onChange={setPendingShapeIds} countryFilter={seatCountry || undefined} height="320px" />
                  <p className="text-xs text-text-muted mt-2">{pendingShapeIds.size} boundary(ies) selected</p>
                </div>

                <div className="flex flex-wrap gap-3 items-center pt-2 border-t border-border-light/30">
                  <input
                    type="text"
                    placeholder="Role title for these seats (e.g. Mayor)"
                    className="flex-1 min-w-[220px] p-2.5 bg-surface-hover border border-border-light text-sm text-text-main rounded-lg focus:outline-none focus:border-primary"
                    value={roleTitle}
                    onChange={e => setRoleTitle(e.target.value)}
                  />
                  <button onClick={handleCreateSeats} className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-slate-950 font-bold rounded-lg text-sm transition-colors">
                    Create Seats for Selected
                  </button>
                </div>
                {seatStatus && <p className="text-xs text-primary-light">{seatStatus}</p>}
              </div>
            )}

            <div className="p-6 bg-surface/30 backdrop-blur-md rounded-2xl border border-border-light/45 shadow-xl">
              <h3 className="text-lg font-bold text-text-main mb-4">Seats ({seats.length})</h3>
              {loadingSeats ? (
                <p className="text-xs text-text-muted text-center py-6">Loading...</p>
              ) : seats.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-6">No seats defined yet.</p>
              ) : (
                <div className="space-y-3">
                  {seats.map(seat => (
                    <div key={seat.id} className="p-3.5 bg-surface/40 rounded-xl border border-border-light/30">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <MapPin size={14} className="text-accent shrink-0" />
                          <span className="font-bold text-text-secondary text-sm truncate">{seat.role_title} — {seat.map_shapes?.name}</span>
                          <span className="text-[10px] text-text-muted shrink-0">({seat.map_shapes?.boundary_type})</span>
                        </div>
                        {selectedElection.status === 'draft' && (
                          <button onClick={() => handleDeleteSeat(seat.id)} className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors shrink-0">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      {seat.candidates.length > 0 && (
                        <div className="mt-2.5 pl-6 space-y-1.5">
                          {seat.candidates.map(c => (
                            <div key={c.id} className="flex items-center justify-between text-xs">
                              <span className="text-text-muted">{c.profiles?.full_name || `Ghost-${c.profiles?.current_ghost_id?.split('-')[0]}`}</span>
                              <button onClick={() => handleDeleteCandidate(c.id)} className="text-text-muted hover:text-danger transition-colors">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
