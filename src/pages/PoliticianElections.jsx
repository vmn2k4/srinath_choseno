import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getOpenSeatsNearShapeIds, getMyCandidacies, findOpenSeatsInContainer, applyForSeat, deleteCandidacy,
  getMyElectionAdminApplications
} from '../services/elections';
import { getCountries, listBoundaryTypes, getMapShapesByType } from '../services/boundaries';
import { getUserBoundaryShapeIds } from '../services/profile';
import { Vote, MapPin, ExternalLink, FileEdit, Search, X } from 'lucide-react';
import { Card, Button, Badge, Select, Spinner, EmptyState, PageHeader } from '../components/ui';

const STATUS_COPY = {
  pending: { label: 'Pending Review', tone: 'amber' },
  approved: { label: 'Approved', tone: 'emerald' },
  rejected: { label: 'Not Approved', tone: 'rose' }
};

export default function PoliticianElections() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [openSeats, setOpenSeats] = useState([]); // seats in the politician's own boundaries
  const [myCandidacies, setMyCandidacies] = useState([]);
  const [myAdminApplications, setMyAdminApplications] = useState([]);
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

    const { data: memberships } = await getUserBoundaryShapeIds(user.id);
    const shapeIds = (memberships || []).map(m => m.map_shape_id);
    setMyShapeIds(new Set(shapeIds));

    // Nominations stay open through the election date itself, across both
    // the nominations_open and active statuses — matches apply_for_seat's
    // own check, so a seat that appears here never gets rejected on submit.
    // Scoped to the politician's own boundaries by default — "browse a
    // different area" below is how they see anything wider than that.
    if (shapeIds.length > 0) {
      const { data: seats } = await getOpenSeatsNearShapeIds(shapeIds);
      setOpenSeats(seats || []);
    } else {
      setOpenSeats([]);
    }

    const { data: candidacies } = await getMyCandidacies(user.id);
    setMyCandidacies(candidacies || []);

    const { data: adminApps } = await getMyElectionAdminApplications(user.id);
    setMyAdminApplications(adminApps || []);

    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchAll();
    getCountries().then(({ data }) => setCountries((data || []).map(c => c.name)));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setBrowseContainerType('');
    setContainers([]);
    setBrowseContainerId('');
    setBrowseSeats(null);
    if (!browseCountry) {
      setContainerTypes([]);
      return;
    }
    // is_container, not admin_only -- USA's 'State' is a valid "browse by"
    // container here too, even though it's no longer admin_only (see
    // 20260729000017; ElectionsAdmin.jsx has the matching comment).
    listBoundaryTypes({ country: browseCountry, isContainer: true, columns: 'type_name' })
      .then(({ data }) => setContainerTypes((data || []).map(t => t.type_name)));
  }, [browseCountry]);

  useEffect(() => {
    setBrowseContainerId('');
    setBrowseSeats(null);
    if (!browseCountry || !browseContainerType) {
      setContainers([]);
      return;
    }
    getMapShapesByType({ country: browseCountry, boundaryType: browseContainerType, columns: 'id, name', orderBy: 'name' })
      .then(({ data }) => setContainers(data || []));
  }, [browseCountry, browseContainerType]);

  const searchContainer = async () => {
    if (!browseContainerId) return;
    setBrowseLoading(true);
    setBrowseStatus('');
    const { data, error } = await findOpenSeatsInContainer(Number(browseContainerId));
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
    const { data, error } = await applyForSeat(seatId);
    setApplyingSeatId(null);
    if (error) {
      setStatus('Error: ' + error.message);
      return;
    }
    navigate(`/apply/${data.id}`);
  };

  const withdraw = async (candidateId) => {
    if (!window.confirm('Withdraw this candidacy?')) return;
    await deleteCandidacy(candidateId);
    fetchAll();
  };

  if (loading) {
    return <Spinner fullPage />;
  }

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 space-y-10">
      <PageHeader icon={Vote} title="Elections" />

      {/* My Candidacies */}
      <section>
        <h2 className="text-lg font-bold text-text-secondary mb-4">My Candidacies</h2>
        {myCandidacies.length === 0 ? (
          <EmptyState description="You haven't applied to any seats yet." />
        ) : (
          <div className="space-y-3">
            {myCandidacies.map(c => {
              const statusInfo = STATUS_COPY[c.status] || STATUS_COPY.pending;
              return (
                <Card key={c.id} variant="row" padding="sm" className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-bold text-text-secondary text-sm">{c.election_seats?.role_title} — {c.election_seats?.map_shapes?.name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-text-muted">
                        {c.election_seats?.elections?.name} · {c.election_seats?.elections?.status?.replace('_', ' ')}
                      </span>
                      {c.submitted_at ? (
                        <Badge tone={statusInfo.tone}>{statusInfo.label}</Badge>
                      ) : (
                        <Badge tone="neutral">Draft — not submitted</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => navigate(`/apply/${c.id}`)}>
                      <FileEdit size={13} /> {c.submitted_at ? 'Edit Application' : 'Continue Application'}
                    </Button>
                    {c.status === 'approved' && (
                      <Button variant="outline" size="sm" onClick={() => navigate(`/candidacy/${c.id}`)}>
                        <ExternalLink size={13} /> Campaign Page
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => withdraw(c.id)} className="hover:text-danger hover:bg-danger/10">
                      Withdraw
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* My Election-Administrator Applications */}
      {myAdminApplications.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-text-secondary mb-4">My Election-Administrator Applications</h2>
          <div className="space-y-3">
            {myAdminApplications.map(a => {
              const statusInfo = STATUS_COPY[a.status] || STATUS_COPY.pending;
              return (
                <Card key={a.id} variant="row" padding="sm" className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-bold text-text-secondary text-sm">{a.election_seats?.role_title} — {a.election_seats?.map_shapes?.name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-text-muted">{a.election_seats?.elections?.name}</span>
                      <Badge tone={statusInfo.tone}>{statusInfo.label}</Badge>
                    </div>
                  </div>
                  {a.status === 'approved' && (
                    <Button variant="outline" size="sm" onClick={() => navigate(`/elections/seat/${a.seat_id}`)}>
                      <ExternalLink size={13} /> Manage Seat
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Open Seats near me */}
      <section>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-lg font-bold text-text-secondary">Open Seats Near You</h2>
          <Button variant="secondary" size="sm" onClick={() => setBrowsing(!browsing)}>
            <Search size={13} /> {browsing ? 'Hide' : 'Browse a Different Area'}
          </Button>
        </div>

        {openSeats.length === 0 ? (
          <EmptyState description="No elections are currently accepting nominations for any group you belong to." />
        ) : (
          <div className="space-y-3">
            {openSeats.map(seat => {
              const alreadyApplied = myCandidacySeatIds.has(seat.id);
              return (
                <Card key={seat.id} variant="row" padding="sm">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-bold text-text-secondary text-sm">{seat.role_title} — {seat.map_shapes?.name}</p>
                      <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1.5">
                        <MapPin size={12} /> {seat.elections?.name} · {seat.elections?.election_date}
                      </p>
                    </div>
                    {alreadyApplied ? (
                      <span className="text-xs font-semibold text-success">Applied ✓</span>
                    ) : (
                      <Button size="sm" onClick={() => startApplying(seat.id)} disabled={applyingSeatId === seat.id}>
                        {applyingSeatId === seat.id ? 'Starting...' : 'Apply'}
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
        {status && <p className="text-danger text-xs mt-3">{status}</p>}
      </section>

      {/* Browse a different area */}
      {browsing && (
        <Card as="section" variant="dashed" padding="lg" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-text-secondary">Browse a Different Area</h2>
            <Button variant="ghost" size="sm" onClick={() => setBrowsing(false)}>
              <X size={16} />
            </Button>
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block mb-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">Country</label>
              <Select size="sm" value={browseCountry} onChange={e => setBrowseCountry(e.target.value)}>
                <option value="">Select country...</option>
                {countries.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">Province / State</label>
              <Select size="sm" value={browseContainerType} onChange={e => setBrowseContainerType(e.target.value)} disabled={!browseCountry}>
                <option value="">{browseCountry ? 'Select type...' : 'Select a country first'}</option>
                {containerTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">&nbsp;</label>
              <Select size="sm" value={browseContainerId} onChange={e => setBrowseContainerId(e.target.value)} disabled={!browseContainerType}>
                <option value="">{browseContainerType ? `Select a ${browseContainerType}...` : 'Select a type first'}</option>
                {containers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <Button size="sm" onClick={searchContainer} disabled={!browseContainerId || browseLoading}>
              {browseLoading ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {browseStatus && <p className="text-xs text-text-muted">{browseStatus}</p>}

          {browseSeats && browseSeats.length > 0 && (
            <div className="space-y-3 pt-2">
              {browseSeats.map(seat => {
                const alreadyApplied = myCandidacySeatIds.has(seat.seat_id);
                return (
                  <Card key={seat.seat_id} variant="row" padding="sm">
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
                        <span className="text-xs font-semibold text-success">Applied ✓</span>
                      ) : (
                        <Button size="sm" onClick={() => startApplying(seat.seat_id)} disabled={applyingSeatId === seat.seat_id}>
                          {applyingSeatId === seat.seat_id ? 'Starting...' : 'Apply'}
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
