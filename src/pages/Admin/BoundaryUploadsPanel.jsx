import React, { useState, useEffect } from 'react';
import {
  listBoundaryUploads, countMapShapesByUploadId, getMapShapesForUploadRow,
  renameBoundaryUpload, deleteBoundaryUpload
} from '../../services/boundaries';
import { Trash2, ChevronDown, ChevronUp, Pencil, Check, X, GitBranch, PlayCircle } from 'lucide-react';
import { Card, Badge, Input, Spinner, EmptyState } from '../../components/ui';

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
    const { data: uploadRows } = await listBoundaryUploads({ country: countryFilter });
    setUploads(uploadRows || []);

    // Exact counts per batch via head requests (no row payload, no default
    // 1000-row cap) — a plain unbounded select silently truncates and would
    // under-report the count for any batch larger than that.
    const counts = {};
    await Promise.all((uploadRows || []).map(async (u) => {
      const [{ count: active }, { count: retired }] = await Promise.all([
        countMapShapesByUploadId(u.id, { retired: false }),
        countMapShapesByUploadId(u.id, { retired: true })
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
    const { data } = await getMapShapesForUploadRow(uploadId, { nameSearch: search, limit: SHAPE_LIST_CAP });
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
    await renameBoundaryUpload(uploadId, renameValue.trim());
    setRenamingId(null);
    fetchUploads();
  };

  const handleDelete = async (uploadId) => {
    if (!window.confirm('Permanently delete this entire upload batch? This cannot be undone.')) return;
    setStatus(prev => ({ ...prev, [uploadId]: '' }));
    const { error } = await deleteBoundaryUpload(uploadId);
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
    <Card padding="lg">
      <h2 className="text-2xl font-bold text-text-main mb-1">Upload Batches</h2>
      <p className="text-sm text-text-muted mb-6">
        Every upload is grouped here. Delete a batch outright if nothing has used it yet — otherwise retire it instead to preserve election/post history.
      </p>

      {loading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : uploads.length === 0 ? (
        <EmptyState description="No tracked uploads yet — batches created before this feature aren't included." />
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
                          <Input
                            size="sm"
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
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
                          <Badge tone="amber">
                            Incomplete{u.expected_count ? ` — ${counts.active + counts.retired}/${u.expected_count}` : ''}
                          </Badge>
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
                      <Input
                        type="text"
                        size="sm"
                        placeholder="Search shapes in this batch..."
                        value={shapeSearch}
                        onChange={e => handleShapeSearch(u.id, e.target.value)}
                        className="mb-2"
                      />
                    )}
                    <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
                      {expandedShapes.length === 0 ? (
                        <p className="text-xs text-text-muted text-center py-2">No shapes match.</p>
                      ) : (
                        expandedShapes.map(s => (
                          <div key={s.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-surface/30">
                            <span className="text-text-secondary truncate">{s.name}</span>
                            <Badge tone={s.retired_at ? 'neutral' : 'emerald'} className="shrink-0">
                              {s.retired_at ? 'Retired' : 'Active'}
                            </Badge>
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
    </Card>
  );
}
