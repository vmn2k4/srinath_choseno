"use client";

import React, { useState, useEffect } from "react";
import {
  listBoundaryUploads,
  countMapShapesByUploadId,
  getMapShapesForUploadRow,
  renameBoundaryUpload,
  deleteBoundaryUpload,
} from "@/lib/services/boundaries";
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Check,
  X,
  GitBranch,
  PlayCircle,
  Trash2,
} from "lucide-react";
import {
  Card,
  Badge,
  Button,
  Input,
  Spinner,
  EmptyState,
  ConfirmDialog,
} from "@/components/primitives";
import { createClient } from "@/lib/supabase/client";

const SHAPE_LIST_CAP = 200;

interface BoundaryUploadsPanelProps {
  onRedistrictBatch?: (upload: any) => void;
  onResumeUpload?: (upload: any) => void;
  countryFilter?: string;
}

export default function BoundaryUploadsPanel({
  onRedistrictBatch,
  onResumeUpload,
  countryFilter,
}: BoundaryUploadsPanelProps) {
  const supabase = createClient();
  const [uploads, setUploads] = useState<any[]>([]);
  const [shapeCounts, setShapeCounts] = useState<
    Record<string, { active: number; retired: number }>
  >({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedShapes, setExpandedShapes] = useState<any[]>([]);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [status, setStatus] = useState<Record<number, string>>({});
  const [shapeSearch, setShapeSearch] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  const fetchUploads = async () => {
    setLoading(true);
    const { data: uploadRows } = await listBoundaryUploads(supabase, {
      country: countryFilter,
    });
    setUploads(uploadRows || []);

    const counts: Record<string, { active: number; retired: number }> = {};
    await Promise.all(
      (uploadRows || []).map(async (u: any) => {
        const [{ count: active }, { count: retired }] = await Promise.all([
          countMapShapesByUploadId(supabase, u.id, { retired: false }),
          countMapShapesByUploadId(supabase, u.id, { retired: true }),
        ]);
        counts[u.id] = { active: active || 0, retired: retired || 0 };
      })
    );
    setShapeCounts(counts);
    setLoading(false);
  };

  useEffect(() => {
    Promise.resolve().then(() => fetchUploads());
  }, [countryFilter, supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleExpand = async (uploadId: number) => {
    if (expandedId === uploadId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(uploadId);
    setShapeSearch("");
    await loadExpandedShapes(uploadId, "");
  };

  const loadExpandedShapes = async (uploadId: number, search: string) => {
    const { data } = await getMapShapesForUploadRow(supabase, uploadId, {
      nameSearch: search,
      limit: SHAPE_LIST_CAP,
    });
    setExpandedShapes(data || []);
  };

  const handleShapeSearch = (uploadId: number, value: string) => {
    setShapeSearch(value);
    loadExpandedShapes(uploadId, value);
  };

  const startRename = (upload: any) => {
    setRenamingId(upload.id);
    setRenameValue(upload.name);
  };

  const saveRename = async (uploadId: number) => {
    if (!renameValue.trim()) return;
    await renameBoundaryUpload(supabase, uploadId, renameValue.trim());
    setRenamingId(null);
    fetchUploads();
  };

  const handleDelete = (uploadId: number) => {
    setDeleteTargetId(uploadId);
  };

  const confirmDelete = async () => {
    const uploadId = deleteTargetId;
    setDeleteTargetId(null);
    if (uploadId == null) return;
    setStatus((prev) => ({ ...prev, [uploadId]: "" }));
    const { error } = await deleteBoundaryUpload(supabase, uploadId);
    if (error) {
      if (error.message.startsWith("RETIRE_REQUIRED")) {
        setStatus((prev) => ({
          ...prev,
          [uploadId]:
            error.message.replace("RETIRE_REQUIRED: ", "") +
            ' Use "Retire This Batch" instead to preserve that history.',
        }));
      } else {
        setStatus((prev) => ({
          ...prev,
          [uploadId]: "Error: " + error.message,
        }));
      }
      return;
    }
    fetchUploads();
    if (expandedId === uploadId) setExpandedId(null);
  };

  if (loading) return <Spinner fullPage />;

  return (
    <>
    <Card padding="md" className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-text-main">Upload Batches</h2>
        <p className="text-xs text-text-muted">
          Review shapefile upload history and active/retired boundary batches.
        </p>
      </div>

      {uploads.length === 0 ? (
        <EmptyState
          title="No Upload Batches"
          description="No geospatial boundary shapefiles uploaded yet."
        />
      ) : (
        <div className="space-y-3">
          {uploads.map((u) => {
            const isExpanded = expandedId === u.id;
            const counts = shapeCounts[u.id] || { active: 0, retired: 0 };
            const isRenaming = renamingId === u.id;

            return (
              <div
                key={u.id}
                className="p-4 bg-surface/30 border border-border-light/30 rounded-2xl space-y-3 text-xs"
              >
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    {isRenaming ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          className="text-xs py-1"
                        />
                        <Button
                          size="sm"
                          onClick={() => saveRename(u.id)}
                          className="p-1"
                        >
                          <Check size={14} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setRenamingId(null)}
                          className="p-1"
                        >
                          <X size={14} />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="font-bold text-text-main text-sm">
                          {u.name}
                        </span>
                        <button
                          onClick={() => startRename(u)}
                          className="text-text-muted hover:text-text-main p-0.5 cursor-pointer"
                        >
                          <Pencil size={12} />
                        </button>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge tone="accent">
                      {counts.active} Active Shapes
                    </Badge>

                    {u.status === "in_progress" && onResumeUpload && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onResumeUpload(u)}
                        className="gap-1 text-xs"
                      >
                        <PlayCircle size={13} /> Resume Upload
                      </Button>
                    )}

                    {onRedistrictBatch && counts.active > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRedistrictBatch(u)}
                        className="gap-1 text-xs"
                      >
                        <GitBranch size={13} /> Redistrict
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(u.id)}
                      className="p-1 text-danger hover:text-danger-light"
                    >
                      <Trash2 size={16} />
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleExpand(u.id)}
                      className="p-1"
                    >
                      {isExpanded ? (
                        <ChevronUp size={16} />
                      ) : (
                        <ChevronDown size={16} />
                      )}
                    </Button>
                  </div>
                </div>

                {status[u.id] && (
                  <p className="text-xs text-danger">{status[u.id]}</p>
                )}

                {isExpanded && (
                  <div className="pt-3 border-t border-border-light/20 space-y-3">
                    <Input
                      placeholder="Filter shapes by name..."
                      value={shapeSearch}
                      onChange={(e) => handleShapeSearch(u.id, e.target.value)}
                      className="text-xs"
                    />

                    <div className="max-h-60 overflow-y-auto space-y-1.5">
                      {expandedShapes.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between p-2 bg-surface-elevated rounded-xl border border-border-light/20 text-[11px]"
                        >
                          <span className="font-medium text-text-main">
                            {s.name}
                          </span>
                          <span className="text-text-muted">
                            Code: {s.shape_code || "N/A"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
    <ConfirmDialog
      open={deleteTargetId != null}
      title="Delete this upload batch?"
      message="Permanently delete this entire upload batch? This cannot be undone."
      onConfirm={confirmDelete}
      onCancel={() => setDeleteTargetId(null)}
    />
    </>
  );
}
