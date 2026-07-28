import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import BoundaryPicker from '../../components/map/BoundaryPicker';
import AdminSubNav from '../../components/AdminSubNav';
import {
  getElections, createElection, advanceElectionStatus, getElectionRoleTypes,
  getElectionSeatsByElectionId, getElectionCandidatesBySeatIds, createElectionSeats, deleteElectionSeat,
  deleteCandidacy, reviewCandidateApplication, getElectionQuestions, createElectionQuestion,
  deleteElectionQuestion, createElectionQuestionOptions, resolveRegionNames
} from '../../services/elections';
import { getCountries, listBoundaryTypes, getMapShapesByType, findShapesInContainers } from '../../services/boundaries';
import { getCandidateSourceInfoForSeats, fetchOfficialCandidates, addFetchedCandidate } from '../../services/candidateSync';
import { Plus, Trash2, Landmark, MapPin, Vote, HelpCircle, ChevronDown, ChevronUp, XCircle, Video, ExternalLink, Download, Loader2 } from 'lucide-react';
import { Card, Button, Badge, Input, Select, Spinner, EmptyState } from '../../components/ui';

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
const CANDIDATE_STATUS_TONE = {
  pending: 'amber',
  approved: 'emerald',
  rejected: 'rose'
};
const ELECTION_STATUS_TONE = {
  draft: 'neutral',
  nominations_open: 'amber',
  active: 'emerald',
  closed: 'neutral'
};

export default function ElectionsAdmin() {
  const { user } = useAuth();
  // Selecting an election is kept in the URL (?election=<id>) so it survives
  // navigating away and back -- this page previously reset to "nothing
  // selected" on every remount (a plain route, not a tab, so leaving and
  // returning always unmounts it), forcing a full reselect + reload even
  // though the seat list can take a while to fetch for a large election.
  const [searchParams, setSearchParams] = useSearchParams();
  const [elections, setElections] = useState([]);
  const [loadingElections, setLoadingElections] = useState(true);
  const [selectedElection, setSelectedElection] = useState(null);

  // Candidate questionnaire (per election)
  const [questions, setQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionOptions, setNewQuestionOptions] = useState(['', '']);
  const [newQuestionRequired, setNewQuestionRequired] = useState(true);
  const [newQuestionAllowContext, setNewQuestionAllowContext] = useState(false);
  const [newQuestionVisible, setNewQuestionVisible] = useState(true);
  const [questionStatus, setQuestionStatus] = useState('');

  // Which submitted application (by candidate id) is expanded for review
  const [expandedCandidateId, setExpandedCandidateId] = useState(null);

  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [createStatus, setCreateStatus] = useState('');

  const [seats, setSeats] = useState([]); // [{id, role_title, map_shapes: {...}, candidateCount}]
  const [loadingSeats, setLoadingSeats] = useState(false);

  // Official candidate data (docs/ELECTION_DATA_SOURCES.md) -- candidateSourceInfo
  // is keyed by seat id: { jurisdiction, status, url, label }. fetchResultsBySeat
  // holds the live "Fetch candidates" preview once an admin requests it for a
  // given seat: { loading, error, candidates, sourceUrl, eventName, status }.
  const [candidateSourceInfo, setCandidateSourceInfo] = useState(new Map());
  const [fetchResultsBySeat, setFetchResultsBySeat] = useState({});
  const [addingCandidateKey, setAddingCandidateKey] = useState(null); // `${seatId}:${candidateName}` while an add is in flight

  const [countries, setCountries] = useState([]);
  const [seatCountry, setSeatCountry] = useState('');
  const [boundaryTypes, setBoundaryTypes] = useState([]); // country_boundary_types
  const [containerType, setContainerType] = useState('');
  const [containerId, setContainerId] = useState(new Set());
  const [targetType, setTargetType] = useState('');
  const [pendingShapeIds, setPendingShapeIds] = useState(new Set());
  const [roleTypes, setRoleTypes] = useState([]); // election_role_types rows for seatCountry+targetType
  const [selectedRoleKeys, setSelectedRoleKeys] = useState(new Set());
  const [seatStatus, setSeatStatus] = useState('');

  const fetchElections = async () => {
    setLoadingElections(true);
    const { data } = await getElections();
    setElections(data || []);
    setLoadingElections(false);
  };

  const fetchCountries = async () => {
    const { data } = await getCountries();
    setCountries((data || []).map(c => c.name));
  };

  const fetchBoundaryTypes = async () => {
    const { data } = await listBoundaryTypes();
    setBoundaryTypes(data || []);
  };

  useEffect(() => {
    fetchElections();
    fetchCountries();
    fetchBoundaryTypes();
  }, []);

  const typesForSeatCountry = seatCountry ? boundaryTypes.filter(t => t.country === seatCountry) : [];
  // Container types (Canada's Province, ...) exist purely to help admins
  // scope a seat-building batch. USA's 'State' is BOTH a container (like
  // Province) AND a real target (Governor/U.S. Senator seats attach to it
  // directly) -- is_container and admin_only are deliberately separate flags
  // (20260729000017) so a type can be one, the other, or both; this split is
  // driven by those columns rather than hardcoded per type.
  const containerTypeOptions = typesForSeatCountry.filter(t => t.is_container);
  const targetTypeOptions = typesForSeatCountry.filter(t => !t.admin_only);

  // Country scopes both the container/target-type pickers and the manual
  // seat picker below — reset any selection tied to the previous country.
  useEffect(() => {
    setTargetType('');
    setContainerType('');
    setContainerId(new Set());
    setPendingShapeIds(new Set());
  }, [seatCountry]);

  // Target type scopes both the shape selection and the role catalog — reset
  // both when it changes so a stale selection from a different boundary type
  // (e.g. Municipal roles left checked after switching to Federal) can't leak
  // into seat creation.
  useEffect(() => {
    setPendingShapeIds(new Set());
    setSelectedRoleKeys(new Set());
  }, [targetType]);

  useEffect(() => {
    if (!seatCountry || !targetType) {
      setRoleTypes([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await getElectionRoleTypes(seatCountry, targetType);
      if (!cancelled) setRoleTypes(data || []);
    })();
    return () => { cancelled = true; };
  }, [seatCountry, targetType]);

  // Checkbox labels always show the default (region_override='') title —
  // a single seat-creation batch can span multiple regions (e.g. Ontario and
  // Quebec ridings picked together), so the actual per-seat title is resolved
  // per shape in handleCreateSeats, not assumed uniform across the batch.
  const roleOptions = roleTypes.filter(r => r.region_override === '');

  const toggleRoleKey = (key) => {
    setSelectedRoleKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const resolveRoleTitle = (roleKey, regionName) => {
    const override = regionName && roleTypes.find(r => r.role_key === roleKey && r.region_override === regionName);
    if (override) return override.role_title;
    const fallback = roleTypes.find(r => r.role_key === roleKey && r.region_override === '');
    return fallback ? fallback.role_title : roleKey;
  };

  const fetchSeats = async (electionId) => {
    setLoadingSeats(true);
    // A single container-driven batch (e.g. every Municipal seat across two
    // provinces) routinely produces thousands of seats — the service
    // functions below paginate past Supabase/PostgREST's default 1000-row
    // cap via fetchAllPages internally.
    const { data: seatRows } = await getElectionSeatsByElectionId(electionId);

    const seatIds = (seatRows || []).map(s => s.id);
    let candidatesBySeat = {};
    if (seatIds.length > 0) {
      const { data: candidateRows } = await getElectionCandidatesBySeatIds(seatIds);
      (candidateRows || []).forEach(c => {
        candidatesBySeat[c.seat_id] = candidatesBySeat[c.seat_id] || [];
        const sortedAnswers = [...(c.election_candidate_answers || [])]
          .sort((a, b) => (a.election_questions?.rank ?? 0) - (b.election_questions?.rank ?? 0));
        candidatesBySeat[c.seat_id].push({ ...c, election_candidate_answers: sortedAnswers });
      });
    }

    const nextSeats = (seatRows || []).map(s => ({ ...s, candidates: candidatesBySeat[s.id] || [] }));
    setSeats(nextSeats);
    setLoadingSeats(false);
    setFetchResultsBySeat({});

    // Batched (2 queries total, not one per seat) -- see
    // getCandidateSourceInfoForSeats's comment for why that matters here.
    const sourceInfo = await getCandidateSourceInfoForSeats(nextSeats);
    setCandidateSourceInfo(sourceInfo);
  };

  const handleFetchCandidates = async (seatId) => {
    setFetchResultsBySeat(prev => ({ ...prev, [seatId]: { loading: true } }));
    const result = await fetchOfficialCandidates(seatId);
    setFetchResultsBySeat(prev => ({ ...prev, [seatId]: { loading: false, ...result } }));
  };

  const handleAddFetchedCandidate = async (seat, candidate) => {
    const key = `${seat.id}:${candidate.name}`;
    setAddingCandidateKey(key);
    const { error } = await addFetchedCandidate(seat.id, seat.map_shapes?.country, candidate);
    setAddingCandidateKey(null);
    if (error) {
      alert('Error adding candidate: ' + error.message);
      return;
    }
    await fetchSeats(selectedElection.id);
  };

  const fetchQuestions = async (electionId) => {
    setLoadingQuestions(true);
    const { data } = await getElectionQuestions(electionId);
    setQuestions((data || []).map(q => ({
      ...q,
      election_question_options: [...(q.election_question_options || [])].sort((a, b) => a.rank - b.rank)
    })));
    setLoadingQuestions(false);
  };

  const selectElection = (election) => {
    setSelectedElection(election);
    setSearchParams({ election: election.id }, { replace: true });
    setPendingShapeIds(new Set());
    setContainerId(new Set());
    setSelectedRoleKeys(new Set());
    setSeatStatus('');
    setExpandedCandidateId(null);
    fetchSeats(election.id);
    fetchQuestions(election.id);
  };

  // Restores the ?election= selection on mount/return, once the elections
  // list has loaded far enough to look it up -- guarded on selectedElection
  // being unset so this never fights a manual click.
  useEffect(() => {
    if (selectedElection || elections.length === 0) return;
    const wanted = searchParams.get('election');
    if (!wanted) return;
    const match = elections.find(e => e.id === wanted);
    if (match) selectElection(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elections]);

  const handleCreateElection = async () => {
    if (!newName.trim() || !newDate) {
      setCreateStatus('Error: name and election date are required.');
      return;
    }
    const { data, error } = await createElection({ name: newName.trim(), electionDate: newDate });
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
    if (!targetType) {
      setSeatStatus('Pick a target type first.');
      return;
    }
    const containerShapeIds = [...containerId];

    // find_shapes_in_containers reads the precomputed shape_containers cache
    // (no live geometry join) and accepts multiple container ids at once, so
    // one or several provinces/states can be matched in a single action.
    // Leaving no container selected means "every {targetType} in
    // {seatCountry}" — since container shapes of one type partition a
    // country, that's equivalent to picking every container of that type.
    const { data, error } = containerShapeIds.length > 0
      ? await findShapesInContainers({ containerShapeIds, targetBoundaryType: targetType, country: seatCountry })
      : await getMapShapesByType({ country: seatCountry, boundaryType: targetType, paginated: true });
    if (error) {
      setSeatStatus('Error: ' + error.message);
      return;
    }
    setPendingShapeIds(prev => {
      const next = new Set(prev);
      (data || []).forEach(shape => next.add(shape.id));
      return next;
    });
    const scopeLabel = containerShapeIds.length > 0
      ? `${containerShapeIds.length} selected container(s)`
      : `all of ${seatCountry}`;
    setSeatStatus(`Added ${data?.length || 0} matching boundaries (from ${scopeLabel}) to the selection below — review and deselect any stragglers before creating seats.`);
  };

  const handleCreateSeats = async () => {
    if (selectedRoleKeys.size === 0 || pendingShapeIds.size === 0) {
      setSeatStatus('Error: select at least one role and one boundary.');
      return;
    }
    const shapeIds = [...pendingShapeIds];
    const { data: regionRows, error: regionError } = await resolveRegionNames(shapeIds, seatCountry);
    if (regionError) {
      setSeatStatus('Error: ' + regionError.message);
      return;
    }
    const regionByShape = new Map((regionRows || []).map(r => [r.map_shape_id, r.region_name]));

    const rows = [];
    shapeIds.forEach(map_shape_id => {
      const regionName = regionByShape.get(map_shape_id);
      selectedRoleKeys.forEach(roleKey => {
        rows.push({
          election_id: selectedElection.id,
          map_shape_id,
          role_title: resolveRoleTitle(roleKey, regionName)
        });
      });
    });

    const { error } = await createElectionSeats(rows);
    if (error) {
      setSeatStatus('Error: ' + error.message);
      return;
    }
    setPendingShapeIds(new Set());
    setContainerId(new Set());
    setSelectedRoleKeys(new Set());
    setSeatStatus(`Created ${rows.length} seat(s).`);
    fetchSeats(selectedElection.id);
  };

  const handleDeleteSeat = async (seatId) => {
    if (!window.confirm('Delete this seat? Any candidate applications for it will be removed too.')) return;
    await deleteElectionSeat(seatId);
    fetchSeats(selectedElection.id);
  };

  const handleDeleteCandidate = async (candidateId) => {
    if (!window.confirm('Remove this candidate from the seat?')) return;
    await deleteCandidacy(candidateId);
    fetchSeats(selectedElection.id);
  };

  const handleReviewCandidate = async (candidateId, approve) => {
    const { error } = await reviewCandidateApplication(candidateId, { approve, reviewedBy: user.id });
    if (error) {
      alert('Error: ' + error.message);
      return;
    }
    fetchSeats(selectedElection.id);
  };

  const updateNewOptionField = (i, val) => {
    setNewQuestionOptions(prev => prev.map((o, idx) => (idx === i ? val : o)));
  };
  const addNewOptionField = () => setNewQuestionOptions(prev => [...prev, '']);
  const removeNewOptionField = (i) => setNewQuestionOptions(prev => prev.filter((_, idx) => idx !== i));

  const handleAddQuestion = async () => {
    const opts = newQuestionOptions.map(o => o.trim()).filter(Boolean);
    if (!newQuestionText.trim() || opts.length < 2) {
      setQuestionStatus('Error: question text and at least 2 options are required.');
      return;
    }
    const { data: q, error } = await createElectionQuestion({
      election_id: selectedElection.id,
      question_text: newQuestionText.trim(),
      required: newQuestionRequired,
      allow_context: newQuestionAllowContext,
      visible_to_public: newQuestionVisible,
      rank: questions.length
    });
    if (error) {
      setQuestionStatus('Error: ' + error.message);
      return;
    }

    const { error: optErr } = await createElectionQuestionOptions(opts.map((option_text, i) => ({ question_id: q.id, option_text, rank: i })));
    if (optErr) {
      setQuestionStatus('Error: ' + optErr.message);
      return;
    }

    setNewQuestionText('');
    setNewQuestionOptions(['', '']);
    setNewQuestionRequired(true);
    setNewQuestionAllowContext(false);
    setNewQuestionVisible(true);
    setQuestionStatus('');
    fetchQuestions(selectedElection.id);
  };

  const handleDeleteQuestion = async (questionId) => {
    if (!window.confirm('Delete this question? Any candidate answers to it will be removed too.')) return;
    await deleteElectionQuestion(questionId);
    fetchQuestions(selectedElection.id);
  };

  const advanceStatus = async () => {
    const nextStatus = STATUS_FLOW[selectedElection.status];
    if (!nextStatus) return;
    const { error } = await advanceElectionStatus(selectedElection.id, nextStatus);
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

      <AdminSubNav active="elections" className="lg:col-span-2" />

      {/* LEFT: Elections list + create */}
      <Card padding="md" className="self-start space-y-5">
        <h2 className="text-xl font-bold text-text-main flex items-center gap-2"><Vote size={20} className="text-primary" /> Elections</h2>

        <Card variant="row" padding="sm" className="space-y-2.5">
          <Input
            type="text"
            size="sm"
            placeholder="Election name (e.g. 2028 Municipal Elections)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <Input
            type="date"
            size="sm"
            value={newDate}
            onChange={e => setNewDate(e.target.value)}
          />
          <Button onClick={handleCreateElection} className="w-full">
            <Plus size={16} /> Create Election
          </Button>
          {createStatus && <p className="text-danger text-xs">{createStatus}</p>}
        </Card>

        <div className="space-y-2">
          {loadingElections ? (
            <div className="flex justify-center py-4"><Spinner size="sm" /></div>
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
                  <Badge tone={ELECTION_STATUS_TONE[e.status] || 'neutral'}>{e.status.replace('_', ' ')}</Badge>
                </div>
              </button>
            ))
          )}
        </div>
      </Card>

      {/* RIGHT: Selected election detail */}
      <div className="space-y-6">
        {!selectedElection ? (
          <EmptyState description="Select or create an election to manage its seats." className="py-10" />
        ) : (
          <>
            <Card className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-xl font-bold text-text-main">{selectedElection.name}</h2>
                <p className="text-xs text-text-muted mt-1">{selectedElection.election_date} · Status: <span className="font-semibold text-text-secondary">{selectedElection.status.replace('_', ' ')}</span></p>
              </div>
              {STATUS_FLOW[selectedElection.status] && (
                <Button onClick={advanceStatus}>
                  {STATUS_LABEL[selectedElection.status]}
                </Button>
              )}
            </Card>

            {/* CANDIDATE QUESTIONNAIRE */}
            <Card className="space-y-5">
              <div>
                <h3 className="text-lg font-bold text-text-main flex items-center gap-2"><HelpCircle size={18} className="text-primary" /> Candidate Questionnaire</h3>
                <p className="text-xs text-text-muted mt-1">
                  Every candidate must answer required questions (and can add optional written context, if you allow it) before submitting their application.
                </p>
              </div>

              {loadingQuestions ? (
                <div className="flex justify-center py-4"><Spinner size="sm" /></div>
              ) : questions.length === 0 ? (
                <p className="text-xs text-text-muted">No questions configured yet — candidates will only need to submit a statement and intro video.</p>
              ) : (
                <div className="space-y-2.5">
                  {questions.map((q, i) => (
                    <div key={q.id} className="p-3.5 bg-surface/40 rounded-xl border border-border-light/30">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-text-secondary">{i + 1}. {q.question_text}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {q.required && <span className="text-[9px] bg-amber-500/15 text-amber-300 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Required</span>}
                            {q.allow_context && <span className="text-[9px] bg-primary/15 text-primary-light px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Context allowed</span>}
                            {!q.visible_to_public && <span className="text-[9px] bg-slate-500/20 text-slate-300 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Hidden from voters</span>}
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {q.election_question_options.map(o => (
                              <span key={o.id} className="text-xs px-2 py-1 bg-surface-hover/60 border border-border-light/30 rounded text-text-tertiary">{o.option_text}</span>
                            ))}
                          </div>
                        </div>
                        <button onClick={() => handleDeleteQuestion(q.id)} className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors shrink-0">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-3 border-t border-border-light/30 space-y-3">
                <Input
                  type="text"
                  size="sm"
                  placeholder="Question text (e.g. Do you support the new transit levy?)"
                  value={newQuestionText}
                  onChange={e => setNewQuestionText(e.target.value)}
                />
                <div className="space-y-2">
                  {newQuestionOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        type="text"
                        size="sm"
                        placeholder={`Option ${i + 1}`}
                        value={opt}
                        onChange={e => updateNewOptionField(i, e.target.value)}
                        className="flex-1"
                      />
                      {newQuestionOptions.length > 2 && (
                        <button onClick={() => removeNewOptionField(i)} className="p-1.5 text-text-muted hover:text-danger transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button onClick={addNewOptionField} className="text-xs font-semibold text-primary-light hover:text-primary transition-colors flex items-center gap-1">
                    <Plus size={13} /> Add option
                  </button>
                </div>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
                    <input type="checkbox" checked={newQuestionRequired} onChange={e => setNewQuestionRequired(e.target.checked)} />
                    Required
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
                    <input type="checkbox" checked={newQuestionAllowContext} onChange={e => setNewQuestionAllowContext(e.target.checked)} />
                    Allow written context
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
                    <input type="checkbox" checked={newQuestionVisible} onChange={e => setNewQuestionVisible(e.target.checked)} />
                    Visible to voters
                  </label>
                </div>
                <Button onClick={handleAddQuestion}>
                  <Plus size={16} /> Add Question
                </Button>
                {questionStatus && <p className="text-danger text-xs">{questionStatus}</p>}
              </div>
            </Card>

            {selectedElection.status === 'draft' && (
              <Card className="space-y-5">
                <h3 className="text-lg font-bold text-text-main flex items-center gap-2"><Landmark size={18} className="text-primary" /> Build Seats</h3>

                <div>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Country</p>
                  <Select value={seatCountry} onChange={e => setSeatCountry(e.target.value)} size="sm" className="max-w-xs">
                    <option value="">Select country...</option>
                    {countries.map(c => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </div>

                <div>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">1. Auto-select by container (optional)</p>
                  <Select
                    value={containerType}
                    onChange={e => { setContainerType(e.target.value); setContainerId(new Set()); }}
                    disabled={!seatCountry}
                    size="sm"
                    className="max-w-xs mb-2"
                  >
                    <option value="">{seatCountry ? 'Select a container type...' : 'Select a country first'}</option>
                    {containerTypeOptions.map(t => (
                      <option key={t.type_name} value={t.type_name}>{t.type_name}</option>
                    ))}
                  </Select>
                  {containerType && (
                    <>
                      <p className="text-[10px] text-text-muted mb-2">
                        Select none for all of {seatCountry}, one for a single {containerType}, or several to combine them.
                      </p>
                      <BoundaryPicker
                        selectedIds={containerId}
                        onChange={setContainerId}
                        countryFilter={seatCountry || undefined}
                        boundaryTypeFilter={[containerType]}
                        height="220px"
                        showMap={false}
                      />
                    </>
                  )}
                  <div className="flex flex-wrap gap-3 mt-3">
                    <Select
                      value={targetType}
                      onChange={e => setTargetType(e.target.value)}
                      disabled={!seatCountry}
                      size="sm"
                      className="flex-1 min-w-[200px]"
                    >
                      <option value="">{seatCountry ? 'Select target boundary type...' : 'Select a country first'}</option>
                      {targetTypeOptions.map(t => (
                        <option key={t.type_name} value={t.type_name}>{t.type_name}</option>
                      ))}
                    </Select>
                    <Button variant="secondary" size="sm" onClick={handleFindMatching}>
                      Find Matching Boundaries
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">2. Review on map / manually add or remove seat boundaries</p>
                  {!targetType ? (
                    <p className="text-xs text-text-muted">Select a target boundary type above first.</p>
                  ) : (
                    <BoundaryPicker
                      selectedIds={pendingShapeIds}
                      onChange={setPendingShapeIds}
                      countryFilter={seatCountry || undefined}
                      boundaryTypeFilter={[targetType]}
                      height="420px"
                    />
                  )}
                  <p className="text-xs text-text-muted mt-2">{pendingShapeIds.size} boundary(ies) selected</p>
                </div>

                <div className="pt-2 border-t border-border-light/30">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">3. Select role(s) for these seats</p>
                  {!targetType ? (
                    <p className="text-xs text-text-muted">Select a target boundary type above first.</p>
                  ) : roleOptions.length === 0 ? (
                    <p className="text-xs text-text-muted">No roles catalogued yet for {seatCountry} / {targetType}.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {roleOptions.map(r => (
                        <label
                          key={r.role_key}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                            selectedRoleKeys.has(r.role_key)
                              ? 'bg-primary/15 border-primary/40 text-primary-light font-semibold'
                              : 'bg-surface-hover/60 border-border-light text-text-muted hover:bg-surface-hover'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={selectedRoleKeys.has(r.role_key)}
                            onChange={() => toggleRoleKey(r.role_key)}
                          />
                          {r.role_title}
                        </label>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-text-muted mt-1.5">
                    Regional titles (e.g. Ontario → MPP) are applied automatically per boundary when seats are created.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 items-center pt-2 border-t border-border-light/30">
                  <Button onClick={handleCreateSeats}>
                    Create Seats for Selected
                  </Button>
                </div>
                {seatStatus && <p className="text-xs text-primary-light">{seatStatus}</p>}
              </Card>
            )}

            <Card>
              <h3 className="text-lg font-bold text-text-main mb-4">Seats ({seats.length})</h3>
              {loadingSeats ? (
                <div className="flex justify-center py-6"><Spinner size="sm" /></div>
              ) : seats.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-6">No seats defined yet.</p>
              ) : (
                <div className="space-y-3">
                  {seats.map(seat => (
                    <div key={seat.id} className="p-3.5 bg-surface/40 rounded-xl border border-border-light/30">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <MapPin size={14} className="text-accent shrink-0" />
                          <span className="font-bold text-text-secondary text-sm truncate">{seat.role_title} — {seat.map_shapes?.name}</span>
                          <span className="text-[10px] text-text-muted shrink-0">({seat.map_shapes?.boundary_type})</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {(() => {
                            const info = candidateSourceInfo.get(seat.id);
                            if (!info || info.status === 'unsupported') return null;
                            if (info.status === 'no_event') {
                              return <span className="text-[10px] text-text-muted italic">{info.label}</span>;
                            }
                            return (
                              <>
                                {info.url && (
                                  <a
                                    href={info.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={info.status === 'active' ? `Official candidate list — ${info.label}` : info.label}
                                    className="p-1.5 text-text-muted hover:text-primary-light hover:bg-primary/10 rounded-lg transition-colors"
                                  >
                                    <ExternalLink size={13} />
                                  </a>
                                )}
                                {info.status === 'active' && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleFetchCandidates(seat.id)}
                                    disabled={fetchResultsBySeat[seat.id]?.loading}
                                  >
                                    {fetchResultsBySeat[seat.id]?.loading
                                      ? <Loader2 size={13} className="animate-spin" />
                                      : <Download size={13} />}
                                    Fetch candidates
                                  </Button>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        {selectedElection.status === 'draft' && (
                          <button onClick={() => handleDeleteSeat(seat.id)} className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors shrink-0">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      {fetchResultsBySeat[seat.id] && !fetchResultsBySeat[seat.id].loading && (
                        <div className="mt-2.5 pl-6 p-3 bg-surface-hover/30 rounded-lg border border-border-light/20 text-xs">
                          {fetchResultsBySeat[seat.id].error ? (
                            <p className="text-danger">Error: {fetchResultsBySeat[seat.id].error}</p>
                          ) : fetchResultsBySeat[seat.id].status === 'no_candidates_yet' ? (
                            <p className="text-text-muted italic">No candidates confirmed yet on the official source ({fetchResultsBySeat[seat.id].eventName}).</p>
                          ) : fetchResultsBySeat[seat.id].status === 'no_event' ? (
                            <p className="text-text-muted italic">No known election event for this jurisdiction yet.</p>
                          ) : fetchResultsBySeat[seat.id].candidates?.length > 0 ? (
                            <>
                              <p className="text-text-muted mb-2">
                                {fetchResultsBySeat[seat.id].eventName} — {fetchResultsBySeat[seat.id].candidates.length} candidate(s) on the official source:
                              </p>
                              <div className="space-y-1.5">
                                {fetchResultsBySeat[seat.id].candidates.map(c => {
                                  const alreadyHere = seat.candidates.some(existing =>
                                    (existing.profiles?.full_name || '').trim().toLowerCase() === c.name.trim().toLowerCase()
                                  );
                                  const key = `${seat.id}:${c.name}`;
                                  return (
                                    <div key={key} className="flex items-center justify-between gap-2 py-1">
                                      <span className="text-text-secondary">
                                        {c.name} {c.party && <span className="text-text-muted">— {c.party}</span>}
                                        {c.elected && <Badge tone="emerald" className="ml-1.5">Elected</Badge>}
                                      </span>
                                      {alreadyHere ? (
                                        <span className="text-[10px] text-emerald-400 font-semibold uppercase shrink-0">Already added</span>
                                      ) : (
                                        <button
                                          onClick={() => handleAddFetchedCandidate(seat, c)}
                                          disabled={addingCandidateKey === key}
                                          className="p-1 text-text-muted hover:text-primary-light hover:bg-primary/10 rounded transition-colors shrink-0"
                                          title="Add to Choseno"
                                        >
                                          {addingCandidateKey === key ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          ) : (
                            <p className="text-text-muted italic">No candidates found.</p>
                          )}
                        </div>
                      )}

                      {seat.candidates.length > 0 && (
                        <div className="mt-2.5 pl-6 space-y-2">
                          {seat.candidates.map(c => {
                            const name = c.profiles?.full_name || `Ghost-${c.profiles?.current_ghost_id?.split('-')[0]}`;
                            const isExpanded = expandedCandidateId === c.id;
                            const canReview = !!c.submitted_at;
                            return (
                              <div key={c.id} className="text-xs bg-surface/30 rounded-lg border border-border-light/20">
                                <div className="flex items-center justify-between gap-2 p-2">
                                  <button
                                    onClick={() => setExpandedCandidateId(isExpanded ? null : c.id)}
                                    className="flex items-center gap-1.5 text-text-secondary hover:text-text-main transition-colors min-w-0"
                                  >
                                    {isExpanded ? <ChevronUp size={13} className="shrink-0" /> : <ChevronDown size={13} className="shrink-0" />}
                                    <span className="truncate">{name}</span>
                                  </button>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <Badge tone={CANDIDATE_STATUS_TONE[c.status]}>{c.status}</Badge>
                                    {!c.submitted_at && (
                                      <span className="text-[9px] text-text-muted uppercase font-bold">Draft — not submitted</span>
                                    )}
                                    {/* Candidates auto-approve on submit now -- only moderation
                                        (rejecting a live candidacy) remains an admin action. */}
                                    {canReview && c.status !== 'rejected' && (
                                      <button onClick={() => handleReviewCandidate(c.id, false)} className="p-1 text-text-muted hover:text-danger transition-colors" title="Reject">
                                        <XCircle size={14} />
                                      </button>
                                    )}
                                    <button onClick={() => handleDeleteCandidate(c.id)} className="text-text-muted hover:text-danger transition-colors" title="Remove candidate">
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>

                                {isExpanded && (
                                  <div className="p-3 pt-0 space-y-3 border-t border-border-light/20 mt-1">
                                    {c.statement && (
                                      <div>
                                        <p className="text-[9px] text-text-muted uppercase font-bold tracking-wider mb-1">Why running</p>
                                        <p className="text-text-tertiary whitespace-pre-wrap">{c.statement}</p>
                                      </div>
                                    )}
                                    {c.intro_video_url ? (
                                      <div>
                                        <p className="text-[9px] text-text-muted uppercase font-bold tracking-wider mb-1 flex items-center gap-1"><Video size={11} /> Intro Video</p>
                                        <video src={c.intro_video_url} controls className="w-full max-h-64 rounded-lg bg-black" />
                                      </div>
                                    ) : (
                                      <p className="text-text-muted italic">No intro video uploaded yet.</p>
                                    )}
                                    {c.election_candidate_answers.length === 0 ? (
                                      <p className="text-text-muted italic">No questionnaire answers yet.</p>
                                    ) : (
                                      <div className="space-y-2">
                                        {c.election_candidate_answers.map(a => (
                                          <div key={a.id} className="p-2 bg-surface-hover/30 rounded-lg">
                                            <p className="font-semibold text-text-secondary">{a.election_questions?.question_text}</p>
                                            <p className="text-primary-light mt-0.5">{a.election_question_options?.option_text}</p>
                                            {a.context_text && <p className="text-text-muted mt-1 italic">"{a.context_text}"</p>}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
