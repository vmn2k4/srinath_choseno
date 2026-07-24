import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import BoundaryPicker from '../../components/map/BoundaryPicker';
import { fetchAllPages } from '../../utils/fetchAllPages';
import { GitBranch, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function RedistrictingPanel({ preselectedBatch, onRetired }) {
  const [countries, setCountries] = useState([]);
  const [countryFilter, setCountryFilter] = useState('');
  const [uploads, setUploads] = useState([]);
  const [focusUploadId, setFocusUploadId] = useState('');
  const [boundaryTypes, setBoundaryTypes] = useState([]);
  const [focusType, setFocusType] = useState('');
  const [selectedShapeIds, setSelectedShapeIds] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [affectedCount, setAffectedCount] = useState(null);

  useEffect(() => {
    supabase.from('countries').select('name').order('name')
      .then(({ data }) => setCountries((data || []).map(c => c.name)));
    supabase.from('boundary_uploads').select('id, name, country').order('created_at', { ascending: false })
      .then(({ data }) => setUploads(data || []));
    supabase.from('country_boundary_types').select('country, type_name').order('country').order('type_name')
      .then(({ data }) => setBoundaryTypes(data || []));
  }, []);

  // Reset any selection tied to the previous country whenever the filter changes.
  useEffect(() => {
    setFocusUploadId('');
    setFocusType('');
  }, [countryFilter]);

  const uploadsForCountry = countryFilter ? uploads.filter(u => u.country === countryFilter) : uploads;
  // Unlike the upload-batch list, "Select by Type" only makes sense once a
  // country is chosen (the dropdown is disabled until then) — no unscoped
  // "all types across all countries" fallback here.
  const typesForCountry = countryFilter ? boundaryTypes.filter(t => t.country === countryFilter) : [];

  useEffect(() => {
    if (preselectedBatch) setFocusUploadId(preselectedBatch.id);
  }, [preselectedBatch]);

  const resetSelection = (ids) => {
    setSelectedShapeIds(ids);
    setAffectedCount(null);
    setStatus('');
  };

  const loadBatchOwnShapes = async () => {
    if (!focusUploadId) return;
    setBusy(true);
    const { data, error } = await fetchAllPages((from, to) =>
      supabase.from('map_shapes').select('id').eq('upload_id', focusUploadId).is('retired_at', null).order('id').range(from, to)
    );
    setBusy(false);
    if (error) {
      setStatus('Error: ' + error.message);
      return;
    }
    resetSelection(new Set((data || []).map(s => s.id)));
  };

  const loadByType = async () => {
    if (!focusType || !countryFilter) return;
    setBusy(true);
    const { data, error } = await fetchAllPages((from, to) =>
      supabase.from('map_shapes').select('id').eq('country', countryFilter).eq('boundary_type', focusType).is('retired_at', null).order('id').range(from, to)
    );
    setBusy(false);
    if (error) {
      setStatus('Error: ' + error.message);
      return;
    }
    resetSelection(new Set((data || []).map(s => s.id)));
  };

  const suggestReplaced = async () => {
    if (!focusUploadId) return;
    setBusy(true);
    const { data, error } = await fetchAllPages((from, to) =>
      supabase.rpc('suggest_replaced_shapes', { p_upload_id: focusUploadId }).range(from, to)
    );
    setBusy(false);
    if (error) {
      setStatus('Error: ' + error.message);
      return;
    }
    resetSelection(new Set((data || []).map(s => s.id)));
    setStatus(`Found ${data?.length || 0} existing boundaries that overlap this upload — review before retiring.`);
  };

  const previewImpact = async () => {
    if (selectedShapeIds.size === 0) return;
    setBusy(true);
    const { data, error } = await fetchAllPages((from, to) =>
      supabase.rpc('preview_retirement_coverage_gap', { p_shape_ids: [...selectedShapeIds] }).range(from, to)
    );
    setBusy(false);
    if (error) {
      setStatus('Error: ' + error.message);
      return;
    }
    setAffectedCount(data?.length || 0);
  };

  const confirmRetire = async () => {
    if (selectedShapeIds.size === 0) return;
    if (!window.confirm(`Retire ${selectedShapeIds.size} boundary(ies)? They'll stop matching new members but stay intact for any elections/posts that already reference them.`)) return;
    setBusy(true);
    const { error } = await supabase.rpc('retire_shapes', { p_shape_ids: [...selectedShapeIds] });
    setBusy(false);
    if (error) {
      setStatus('Error: ' + error.message);
      return;
    }
    const count = selectedShapeIds.size;
    resetSelection(new Set());
    setStatus(`Retired ${count} boundary(ies).`);
    onRetired?.();
  };

  const confirmDelete = async () => {
    if (selectedShapeIds.size === 0) return;
    if (!window.confirm(`Permanently delete ${selectedShapeIds.size} boundary(ies)? This cannot be undone.`)) return;
    setBusy(true);
    const { error } = await supabase.rpc('delete_shapes', { p_shape_ids: [...selectedShapeIds] });
    setBusy(false);
    if (error) {
      if (error.message.startsWith('RETIRE_REQUIRED')) {
        setStatus(error.message.replace('RETIRE_REQUIRED: ', '') + ' Use "Confirm Retirement" instead to preserve that history.');
      } else {
        setStatus('Error: ' + error.message);
      }
      return;
    }
    const count = selectedShapeIds.size;
    resetSelection(new Set());
    setStatus(`Permanently deleted ${count} boundary(ies).`);
    onRetired?.();
  };

  return (
    <div className="p-8 bg-surface/30 backdrop-blur-md rounded-2xl border border-border-light/45 shadow-xl space-y-5">
      <h2 className="text-2xl font-bold text-text-main flex items-center gap-2"><GitBranch size={20} className="text-primary" /> Redistricting</h2>
      <p className="text-sm text-text-muted">
        Use this when boundaries change: upload the new data first, then use it here to figure out — and retire — whatever it replaces. Nothing is ever auto-applied; every suggestion is a starting point you review.
      </p>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="min-w-[180px]">
          <label className="block mb-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">Country</label>
          <select
            value={countryFilter}
            onChange={e => setCountryFilter(e.target.value)}
            className="w-full p-2.5 bg-surface-hover border border-border-light text-sm text-text-main rounded-lg focus:outline-none focus:border-primary"
          >
            <option value="">All countries</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className="block mb-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">Focus Upload Batch</label>
          <select
            value={focusUploadId}
            onChange={e => setFocusUploadId(e.target.value)}
            className="w-full p-2.5 bg-surface-hover border border-border-light text-sm text-text-main rounded-lg focus:outline-none focus:border-primary"
          >
            <option value="">Select an upload...</option>
            {uploadsForCountry.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <button onClick={loadBatchOwnShapes} disabled={!focusUploadId || busy} className="px-4 py-2.5 bg-surface-active hover:bg-border text-text-main rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
          Load This Batch's Own Boundaries
        </button>
        <button onClick={suggestReplaced} disabled={!focusUploadId || busy} className="px-4 py-2.5 bg-surface-active hover:bg-border text-text-main rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
          Suggest What This Batch Replaces
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-end pt-1 border-t border-border-light/20">
        <div className="flex-1 min-w-[220px]">
          <label className="block mb-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">
            Select by Type <span className="text-text-muted/60 normal-case font-normal">(for legacy boundaries with no upload batch)</span>
          </label>
          <select
            value={focusType}
            onChange={e => setFocusType(e.target.value)}
            disabled={!countryFilter}
            className="w-full p-2.5 bg-surface-hover border border-border-light text-sm text-text-main rounded-lg focus:outline-none focus:border-primary disabled:opacity-50"
          >
            <option value="">{countryFilter ? 'Select a boundary type...' : 'Select a country first'}</option>
            {typesForCountry.map(t => (
              <option key={t.type_name} value={t.type_name}>{t.type_name}</option>
            ))}
          </select>
        </div>
        <button onClick={loadByType} disabled={!focusType || !countryFilter || busy} className="px-4 py-2.5 bg-surface-active hover:bg-border text-text-main rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
          Select All of This Type
        </button>
      </div>

      <div>
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
          Boundaries to retire ({selectedShapeIds.size} selected) — edit freely, or hand-pick with no batch at all
        </p>
        <BoundaryPicker mode="multi" selectedIds={selectedShapeIds} onChange={resetSelection} countryFilter={countryFilter || undefined} height="320px" />
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border-light/30">
        <button onClick={previewImpact} disabled={selectedShapeIds.size === 0 || busy} className="px-5 py-2.5 bg-surface-active hover:bg-border text-text-main rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
          Preview Impact
        </button>
        <button onClick={confirmRetire} disabled={selectedShapeIds.size === 0 || busy} className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-slate-950 font-bold rounded-lg text-sm transition-colors disabled:opacity-50">
          Confirm Retirement
        </button>
        <button onClick={confirmDelete} disabled={selectedShapeIds.size === 0 || busy} className="px-5 py-2.5 bg-danger/15 hover:bg-danger/25 text-danger-light border border-danger/30 font-bold rounded-lg text-sm transition-colors disabled:opacity-50">
          Delete Selected Permanently
        </button>
      </div>

      {affectedCount !== null && (
        <div className={`flex items-start gap-2 p-3 rounded-xl border text-sm ${affectedCount > 0 ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'}`}>
          {affectedCount > 0 ? <AlertTriangle size={16} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={16} className="shrink-0 mt-0.5" />}
          <span>
            {affectedCount > 0
              ? `${affectedCount} user(s) currently in these boundaries have no other active coverage of this type — they'll lose local coverage until you upload a replacement for their area. Not blocked, just worth checking before you confirm.`
              : 'No users would lose coverage — every affected user is already covered by another active boundary of this type.'}
          </span>
        </div>
      )}

      {status && <p className="text-xs text-primary-light">{status}</p>}
    </div>
  );
}
