"use client";

import React, { useState, useEffect } from "react";
import {
  getCountries,
  listBoundaryUploads,
  listBoundaryTypes,
  getMapShapeIdsByUploadId,
  getMapShapesByType,
  suggestReplacedShapes,
  previewRetirementCoverageGap,
  retireShapes,
} from "@/lib/services/boundaries";
import { GitBranch } from "lucide-react";
import { Card, Button, Select } from "@/components/primitives";
import { createClient } from "@/lib/supabase/client";

interface RedistrictingPanelProps {
  preselectedBatch?: any;
  onRetired?: () => void;
}

export default function RedistrictingPanel({
  preselectedBatch,
  onRetired,
}: RedistrictingPanelProps) {
  const supabase = createClient();
  const [countries, setCountries] = useState<string[]>([]);
  const [countryFilter, setCountryFilter] = useState("");
  const [uploads, setUploads] = useState<any[]>([]);
  const [focusUploadId, setFocusUploadId] = useState<string>("");
  const [boundaryTypes, setBoundaryTypes] = useState<any[]>([]);
  const [focusType, setFocusType] = useState<string>("");
  const [selectedShapeIds, setSelectedShapeIds] = useState<Set<number>>(
    new Set()
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [affectedCount, setAffectedCount] = useState<number | null>(null);

  useEffect(() => {
    getCountries(supabase).then(({ data }) =>
      setCountries((data || []).map((c: any) => c.name))
    );
    listBoundaryUploads(supabase, { columns: "id, name, country" }).then(
      ({ data }) => setUploads(data || [])
    );
    listBoundaryTypes(supabase, {
      columns: "country, type_name",
      orderBy: "type_name",
    }).then(({ data }) => setBoundaryTypes((data as any[]) || []));
  }, [supabase]);

  useEffect(() => {
    Promise.resolve().then(() => {
      setFocusUploadId("");
      setFocusType("");
    });
  }, [countryFilter]);

  const uploadsForCountry = countryFilter
    ? uploads.filter((u) => u.country === countryFilter)
    : uploads;
  const typesForCountry = countryFilter
    ? boundaryTypes.filter((t) => t.country === countryFilter)
    : [];

  useEffect(() => {
    if (preselectedBatch) Promise.resolve().then(() => setFocusUploadId(String(preselectedBatch.id)));
  }, [preselectedBatch]);

  const resetSelection = (ids: Set<number>) => {
    setSelectedShapeIds(ids);
    setAffectedCount(null);
    setStatus("");
  };

  const loadBatchOwnShapes = async () => {
    if (!focusUploadId) return;
    setBusy(true);
    const { data, error } = await getMapShapeIdsByUploadId(
      supabase,
      Number(focusUploadId)
    );
    setBusy(false);
    if (error) {
      setStatus("Error: " + ((error as any).message || "Operation failed"));
      return;
    }
    resetSelection(new Set((data || []).map((s: any) => s.id)));
  };

  const loadByType = async () => {
    if (!focusType || !countryFilter) return;
    setBusy(true);
    const { data, error } = await getMapShapesByType(supabase, {
      country: countryFilter,
      boundaryType: focusType,
      paginated: true,
    });
    setBusy(false);
    if (error) {
      setStatus("Error: " + ((error as any).message || "Operation failed"));
      return;
    }
    resetSelection(new Set((data || []).map((s: any) => s.id)));
  };

  const suggestReplaced = async () => {
    if (!focusUploadId) return;
    setBusy(true);
    const { data, error } = await suggestReplacedShapes(
      supabase,
      Number(focusUploadId)
    );
    setBusy(false);
    if (error) {
      setStatus("Error: " + ((error as any).message || "Operation failed"));
      return;
    }
    resetSelection(new Set((data || []).map((s: any) => s.id)));
    setStatus(
      `Found ${data?.length || 0} existing boundaries that overlap this upload.`
    );
  };

  const previewImpact = async () => {
    if (selectedShapeIds.size === 0) return;
    setBusy(true);
    const { data, error } = await previewRetirementCoverageGap(
      supabase,
      [...selectedShapeIds]
    );
    setBusy(false);
    if (error) {
      setStatus("Error: " + ((error as any).message || "Operation failed"));
      return;
    }
    setAffectedCount(data?.length || 0);
  };

  const confirmRetire = async () => {
    if (selectedShapeIds.size === 0) return;
    setBusy(true);
    const { error } = await retireShapes(supabase, [...selectedShapeIds]);
    setBusy(false);
    if (error) {
      setStatus("Error: " + ((error as any).message || "Operation failed"));
      return;
    }
    setStatus(`Successfully retired ${selectedShapeIds.size} shapes.`);
    setSelectedShapeIds(new Set());
    if (onRetired) onRetired();
  };

  return (
    <Card padding="md" className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-text-main flex items-center gap-2">
          <GitBranch size={20} className="text-primary" /> Boundary Redistricting
        </h2>
        <p className="text-xs text-text-muted">
          Retire obsolete shapes or replace boundary sets when redistricting occurs.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <Select
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
        >
          <option value="">Filter Country...</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>

        <Select
          value={focusUploadId}
          onChange={(e) => setFocusUploadId(e.target.value)}
        >
          <option value="">Select Upload Batch...</option>
          {uploadsForCountry.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>

        <Select
          value={focusType}
          onChange={(e) => setFocusType(e.target.value)}
          disabled={!countryFilter}
        >
          <option value="">Select Boundary Type...</option>
          {typesForCountry.map((t) => (
            <option key={t.type_name} value={t.type_name}>
              {t.type_name}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <Button
          size="sm"
          variant="outline"
          onClick={loadBatchOwnShapes}
          disabled={!focusUploadId || busy}
        >
          Load Batch Shapes
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={loadByType}
          disabled={!focusType || !countryFilter || busy}
        >
          Load By Type
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={suggestReplaced}
          disabled={!focusUploadId || busy}
        >
          Suggest Overlapping
        </Button>
      </div>

      {selectedShapeIds.size > 0 && (
        <div className="p-4 bg-primary/10 border border-primary/30 rounded-2xl space-y-3 text-xs">
          <p className="font-bold text-text-main">
            Selected for Action: {selectedShapeIds.size} shapes
          </p>

          <div className="flex items-center gap-3">
            <Button size="sm" onClick={previewImpact} disabled={busy}>
              Preview Impact
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={confirmRetire}
              disabled={busy}
              className="text-danger hover:border-danger"
            >
              Retire Selected Shapes
            </Button>
          </div>

          {affectedCount != null && (
            <p className="text-xs text-text-muted">
              Users with memberships affected: {affectedCount}
            </p>
          )}
        </div>
      )}

      {status && <p className="text-xs text-text-muted">{status}</p>}
    </Card>
  );
}
