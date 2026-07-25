import React, { useState, useEffect } from 'react';
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
import { Plus, Trash2, Landmark, MapPin, Vote, HelpCircle, ChevronDown, ChevronUp, XCircle, Video } from 'lucide-react';

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
const CANDIDATE_STATUS_BADGE = {
  pending: 'bg-amber-500/20 text-amber-300',
  approved: 'bg-emerald-500/20 text-emerald-300',
  rejected: 'bg-danger/20 text-rose-300'
};

export default function ElectionsAdmin() {
  const { user } = useAuth();
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
  // Container types (Province, State, ...) are admin_only — they exist purely
  // to help admins scope a seat-building batch, they're never themselves a
  // real election boundary. Keep the two dropdowns mutually exclusive so
  // Province can never be picked as a seat's target type, and a real
  // election type (Federal/Municipal/...) can never be picked as a container.
  const containerTypeOptions = typesForSeatCountry.filter(t => t.admin_only);
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

    setSeats((seatRows || []).map(s => ({ ...s, candidates: candidatesBySeat[s.id] || [] })));
    setLoadingSeats(false);
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
    setPendingShapeIds(new Set());
    setContainerId(new Set());
    setSelectedRoleKeys(new Set());
    setSeatStatus('');
    setExpandedCandidateId(null);
    fetchSeats(election.id);
    fetchQuestions(election.id);
  };

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

            {/* CANDIDATE QUESTIONNAIRE */}
            <div className="p-6 bg-surface/30 backdrop-blur-md rounded-2xl border border-border-light/45 shadow-xl space-y-5">
              <div>
                <h3 className="text-lg font-bold text-text-main flex items-center gap-2"><HelpCircle size={18} className="text-primary" /> Candidate Questionnaire</h3>
                <p className="text-xs text-text-muted mt-1">
                  Every candidate must answer required questions (and can add optional written context, if you allow it) before submitting their application.
                </p>
              </div>

              {loadingQuestions ? (
                <p className="text-xs text-text-muted text-center py-4">Loading...</p>
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
                <input
                  type="text"
                  placeholder="Question text (e.g. Do you support the new transit levy?)"
                  value={newQuestionText}
                  onChange={e => setNewQuestionText(e.target.value)}
                  className="w-full p-2.5 bg-surface-hover border border-border-light text-sm text-text-main rounded-lg focus:outline-none focus:border-primary"
                />
                <div className="space-y-2">
                  {newQuestionOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder={`Option ${i + 1}`}
                        value={opt}
                        onChange={e => updateNewOptionField(i, e.target.value)}
                        className="flex-1 p-2 bg-surface-hover border border-border-light text-sm text-text-main rounded-lg focus:outline-none focus:border-primary"
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
                <button onClick={handleAddQuestion} className="flex items-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary-hover text-slate-950 font-bold rounded-lg text-sm transition-colors">
                  <Plus size={16} /> Add Question
                </button>
                {questionStatus && <p className="text-danger text-xs">{questionStatus}</p>}
              </div>
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
                    <option value="">{seatCountry ? 'Select a container type...' : 'Select a country first'}</option>
                    {containerTypeOptions.map(t => (
                      <option key={t.type_name} value={t.type_name}>{t.type_name}</option>
                    ))}
                  </select>
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
                    <select
                      value={targetType}
                      onChange={e => setTargetType(e.target.value)}
                      disabled={!seatCountry}
                      className="flex-1 min-w-[200px] p-2.5 bg-surface-hover border border-border-light text-sm text-text-main rounded-lg focus:outline-none focus:border-primary disabled:opacity-50"
                    >
                      <option value="">{seatCountry ? 'Select target boundary type...' : 'Select a country first'}</option>
                      {targetTypeOptions.map(t => (
                        <option key={t.type_name} value={t.type_name}>{t.type_name}</option>
                      ))}
                    </select>
                    <button onClick={handleFindMatching} className="px-4 py-2.5 bg-surface-active hover:bg-border text-text-main rounded-lg text-sm font-semibold transition-colors">
                      Find Matching Boundaries
                    </button>
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
                                    <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${CANDIDATE_STATUS_BADGE[c.status]}`}>
                                      {c.status}
                                    </span>
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
            </div>
          </>
        )}
      </div>
    </div>
  );
}
