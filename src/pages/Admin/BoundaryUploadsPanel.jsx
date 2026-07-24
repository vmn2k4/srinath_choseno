import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { Trash2, ChevronDown, ChevronUp, Pencil, Check, X, GitBranch, PlayCircle } from 'lucide-react';

export default function BoundaryUploadsPanel({ onRedistrictBatch, onResumeUpload, countryFilter }) {
  const [uploads, setUploads] = useState([]);
  const [shapeCounts, setShapeCounts] = useState({}); // upload_id -> { active, retired }
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedShapes, setExpandedShapes] = useState([]);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [status, setStatus] = useState({}); // upload_id -> message
  const [shapeSearch, setShapeSearch] = useState('');

  const SHAPE_LIST_CAP = 200;

  const fetchUploads = async () => {
    setLoading(true);
    let query = supabase
      .from('boundary_uploads')
      .select('id, name, country, boundary_type, created_at, expected_count, completed_at')
      .order('created_at', { ascending: false });
    if (countryFilter) query = query.eq('country', countryFilter);
    const { data: uploadRows } = await query;
    setUploads(uploadRows || []);

    // Exact counts per batch via head requests (no row payload, no default
    // 1000-row cap) — a plain unbounded select silently truncates and would
    // under-report the count for any batch larger than that.
    const counts = {};
    await Promise.all((uploadRows || []).map(async (u) => {
      const [{ count: active }, { count: retired }] = await Promise.all([
        supabase.from('map_shapes').select('id', { count: 'exact', head: true }).eq('upload_id', u.id).is('retired_at', null),
        supabase.from('map_shapes').select('id', { count: 'exact', head: true }).eq('upload_id', u.id).not('retired_at', 'is', null)
      ]);
      counts[u.id] = { active: active || 0, retired: retired || 0 };
    }));
    setShapeCounts(counts);
    setLoading(false);
  };

  useEffect(() => {
    fetchUploads();
  }, [countryFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleExpand = async (uploadId) => {
    if (expandedId === uploadId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(uploadId);
    setShapeSearch('');
    await loadExpandedShapes(uploadId, '');
  };

  const loadExpandedShapes = async (uploadId, search) => {
    let query = supabase
      .from('map_shapes')
      .select('id, name, retired_at')
      .eq('upload_id', uploadId)
      .order('name')
      .limit(SHAPE_LIST_CAP);
    if (search.trim()) query = query.ilike('name', `%${search.trim()}%`);
    const { data } = await query;
    setExpandedShapes(data || []);
  };

  const handleShapeSearch = (uploadId, value) => {
    setShapeSearch(value);
    loadExpandedShapes(uploadId, value);
  };

  const startRename = (upload) => {
    setRenamingId(upload.id);
    setRenameValue(upload.name);
  };

  const saveRename = async (uploadId) => {
    if (!renameValue.trim()) return;
    await supabase.from('boundary_uploads').update({ name: renameValue.trim() }).eq('id', uploadId);
    setRenamingId(null);
    fetchUploads();
  };

  const handleDelete = async (uploadId) => {
    if (!window.confirm('Permanently delete this entire upload batch? This cannot be undone.')) return;
    setStatus(prev => ({ ...prev, [uploadId]: '' }));
    const { error } = await supabase.rpc('delete_boundary_upload', { p_upload_id: uploadId });
    if (error) {
      if (error.message.startsWith('RETIRE_REQUIRED')) {
        setStatus(prev => ({
          ...prev,
          [uploadId]: error.message.replace('RETIRE_REQUIRED: ', '') + ' Use "Retire This Batch" instead to preserve that history.'
        }));
      } else {
        setStatus(prev => ({ ...prev, [uploadId]: 'Error: ' + error.message }));
      }
      return;
    }
    fetchUploads();
    if (expandedId === uploadId) setExpandedId(null);
  };

  return (
    <div className="p-8 bg-surface/30 backdrop-blur-md rounded-2xl border border-border-light/45 shadow-xl">
      <h2 className="text-2xl font-bold text-text-main mb-1">Upload Batches</h2>
      <p className="text-sm text-text-muted mb-6">
        Every upload is grouped here. Delete a batch outright if nothing has used it yet — otherwise retire it instead to preserve election/post history.
      </p>

      {loading ? (
        <div className="text-center text-text-muted py-6">Loading...</div>
      ) : uploads.length === 0 ? (
        <div className="text-center text-text-muted py-6 bg-surface/20 rounded-2xl border border-dashed border-border-light/60">
          No tracked uploads yet — batches created before this feature aren't included.
        </div>
      ) : (
        <div className="space-y-3">
          {uploads.map(u => {
            const counts = shapeCounts[u.id] || { active: 0, retired: 0 };
            const isExpanded = expandedId === u.id;
            return (
              <div key={u.id} className="border border-border-light/30 rounded-xl overflow-hidden bg-surface/20">
                <div className="p-3.5 flex items-center justify-between gap-3">
                  <button onClick={() => toggleExpand(u.id)} className="flex-1 flex items-center gap-2 text-left min-w-0">
                    {isExpanded ? <ChevronUp size={16} className="text-text-muted shrink-0" /> : <ChevronDown size={16} className="text-text-muted shrink-0" />}
                    <div className="min-w-0">
                      {renamingId === u.id ? (
                        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                          <input
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            className="p-1.5 bg-surface-hover border border-border-light rounded-lg text-sm text-text-main outline-none focus:border-primary"
                            autoFocus
                          />
                          <button onClick={() => saveRename(u.id)} className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded"><Check size={14} /></button>
                          <button onClick={() => setRenamingId(null)} className="p-1 text-text-muted hover:bg-surface-hover rounded"><X size={14} /></button>
                        </div>
                      ) : (
                        <p className="font-bold text-text-secondary text-sm truncate">{u.name}</p>
                      )}
                      <p className="text-[11px] text-text-muted mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>{new Date(u.created_at).toLocaleDateString()} · {u.country} — {u.boundary_type} · {counts.active} active{counts.retired > 0 ? `, ${counts.retired} retired` : ''}</span>
                        {!u.completed_at && (
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                            Incomplete{u.expected_count ? ` — ${counts.active + counts.retired}/${u.expected_count}` : ''}
                          </span>
                        )}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    {!u.completed_at && (
                      <button onClick={() => onResumeUpload(u)} className="p-2 text-text-muted hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors" title="Resume this upload">
                        <PlayCircle size={14} />
                      </button>
                    )}
                    {renamingId !== u.id && (
                      <button onClick={() => startRename(u)} className="p-2 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-lg transition-colors" title="Rename">
                        <Pencil size={14} />
                      </button>
                    )}
                    <button onClick={() => onRedistrictBatch(u)} className="p-2 text-text-muted hover:text-primary-light hover:bg-primary/10 rounded-lg transition-colors" title="Redistrict / Retire this batch">
                      <GitBranch size={14} />
                    </button>
                    <button onClick={() => handleDelete(u.id)} className="p-2 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors" title="Delete this batch">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {status[u.id] && (
                  <div className="px-3.5 pb-3 text-xs text-amber-300">{status[u.id]}</div>
                )}

                {isExpanded && (
                  <div className="border-t border-border-light/20 p-3">
                    {counts.active + counts.retired > SHAPE_LIST_CAP && (
                      <input
                        type="text"
                        placeholder="Search shapes in this batch..."
                        value={shapeSearch}
                        onChange={e => handleShapeSearch(u.id, e.target.value)}
                        className="w-full mb-2 p-1.5 bg-surface-hover border border-border-light rounded-lg text-xs text-text-main outline-none focus:border-primary"
                      />
                    )}
                    <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
                      {expandedShapes.length === 0 ? (
                        <p className="text-xs text-text-muted text-center py-2">No shapes match.</p>
                      ) : (
                        expandedShapes.map(s => (
                          <div key={s.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-surface/30">
                            <span className="text-text-secondary truncate">{s.name}</span>
                            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded shrink-0 ${s.retired_at ? 'bg-slate-500/20 text-slate-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                              {s.retired_at ? 'Retired' : 'Active'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                    {expandedShapes.length === SHAPE_LIST_CAP && !shapeSearch && (
                      <p className="text-[11px] text-text-muted mt-1.5">Showing first {SHAPE_LIST_CAP} of {counts.active + counts.retired} — search to find a specific one.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
