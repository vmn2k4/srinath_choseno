"use client";

import React, { useState, useEffect } from "react";
import AdminSubNav from "./AdminSubNav";
import BoundaryPicker from "./BoundaryPicker";
import BoundaryMapComponent, { type MapBoundary } from "./BoundaryMapComponent";
import {
  getCountries,
  listBoundaryTypes,
  listEntityTypes,
  getMapShapesByType,
  findShapesInContainers,
  getGeojsonShapes,
} from "@/lib/services/boundaries";
import { Eye, MapPin } from "lucide-react";
import { Card, Button, Select, Checkbox, PageHeader } from "@/components/primitives";
import { createClient } from "@/lib/supabase/client";
import { getEntityTypeNameForShape } from "@/lib/utils/censusSubdivisionEntityTypes";

// Above this many matched shapes, fetching + rendering full-resolution
// geometry for all of them at once would hang the tab — show a plain name
// list instead unless the admin explicitly opts in.
const RENDER_CAP = 500;

interface BoundaryTypeRow {
  country: string;
  type_name: string;
  is_container?: boolean;
  admin_only?: boolean;
  election_eligible?: boolean;
  term_length_months?: number | null;
  term_limits?: number | null;
  voting_method?: string | null;
  description?: string | null;
}

interface ShapeMatch {
  id: number;
  name: string;
  code?: string | null;
  properties?: Record<string, unknown> | null;
}

interface EntityTypeRow {
  id: string;
  country: string;
  name: string;
  election_eligible: boolean;
}

export default function BoundaryVisualizerClient() {
  const supabase = createClient();
  const [countries, setCountries] = useState<string[]>([]);
  const [country, setCountry] = useState("");
  const [boundaryTypes, setBoundaryTypes] = useState<BoundaryTypeRow[]>([]);
  const [entityTypes, setEntityTypes] = useState<EntityTypeRow[]>([]);
  const [selectedEntityTypeNames, setSelectedEntityTypeNames] = useState<Set<string>>(new Set());
  const [containerType, setContainerType] = useState("");
  const [containerId, setContainerId] = useState<Set<number>>(new Set());
  const [targetType, setTargetType] = useState("");

  const [matches, setMatches] = useState<ShapeMatch[] | null>(null);
  const [mapBoundaries, setMapBoundaries] = useState<MapBoundary[] | null>(null);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    getCountries(supabase).then(({ data }) => setCountries((data || []).map((c) => c.name)));
    listBoundaryTypes(supabase).then(({ data }) => setBoundaryTypes((data as unknown as BoundaryTypeRow[]) || []));
    listEntityTypes(supabase).then(({ data }) => setEntityTypes((data as unknown as EntityTypeRow[]) || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const typesForCountry = country ? boundaryTypes.filter((t) => t.country === country) : [];
  // Container types (Canada's Province, USA's State, ...) exist to scope this
  // tool's search. USA's 'State' is both a container and a valid target
  // (Governor/Senator) at once — is_container and admin_only are separate
  // flags, not hardcoded per type.
  const containerTypeOptions = typesForCountry.filter((t) => t.is_container);
  // Unlike the election seat-builder, the inspector intentionally shows every
  // type here (including non-electoral ones like reserves/electoral areas) --
  // this is a read-only inspection tool, not an election-creation flow.
  const targetTypeOptions = typesForCountry.filter((t) => !t.admin_only);
  const selectedTargetTypeInfo = typesForCountry.find((t) => t.type_name === targetType);

  // entity_types splits a single boundary_type (e.g. BC's "Municipal" mixes
  // real municipalities with Indian reserves and electoral areas) -- unlike
  // the election seat-builder, everything starts checked here since this is
  // an inspection tool that should show all data by default.
  const entityTypesForCountry = country ? entityTypes.filter((t) => t.country === country) : [];
  const isShapeEntityTypeSelected = (shape: ShapeMatch) => {
    if (entityTypesForCountry.length === 0) return true;
    const categoryName = getEntityTypeNameForShape(shape.properties);
    if (!categoryName) return true;
    return selectedEntityTypeNames.has(categoryName);
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      setContainerType("");
      setContainerId(new Set());
      setTargetType("");
      setMatches(null);
      setMapBoundaries(null);
      setStatus("");
      setSelectedEntityTypeNames(new Set(entityTypes.filter((t) => t.country === country).map((t) => t.name)));
    });
  }, [country]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVisualize = async () => {
    if (!country || !targetType) {
      setStatus("Pick a country and a target boundary type first.");
      return;
    }
    setLoadingMatches(true);
    setMapBoundaries(null);
    setMatches(null);
    setStatus("");

    const containerShapeIds = [...containerId];
    const { data, error } =
      containerShapeIds.length > 0
        ? await findShapesInContainers(supabase, {
            containerShapeIds,
            targetBoundaryType: targetType,
            country,
            columns: "id, name, code, properties",
          })
        : await getMapShapesByType(supabase, {
            country,
            boundaryType: targetType,
            columns: "id, name, code, properties",
            paginated: true,
          });

    setLoadingMatches(false);
    if (error) {
      setStatus("Error: " + ((error as { message?: string }).message || "Failed to fetch shapes"));
      return;
    }

    const allRows = (data as unknown as ShapeMatch[]) || [];
    const rows = allRows.filter((shape) => isShapeEntityTypeSelected(shape));
    setMatches(rows);
    const excludedCount = allRows.length - rows.length;
    if (rows.length === 0) {
      setStatus(excludedCount > 0 ? "No matching boundaries — all excluded by the entity-type filter." : "No matching boundaries found.");
    } else if (rows.length > RENDER_CAP) {
      setStatus(
        `${rows.length} boundaries matched` +
          (excludedCount > 0 ? ` (${excludedCount} excluded by the entity-type filter)` : "") +
          ` — that's too many to render at once (cap: ${RENDER_CAP}). Showing the list below; use "Load Map Anyway" if you really want to render all of them.`
      );
    } else if (excludedCount > 0) {
      setStatus(`${rows.length} boundaries matched (${excludedCount} excluded by the entity-type filter).`);
    }
  };

  const loadGeometry = async (ids: number[]) => {
    setLoadingGeo(true);
    const { data, error } = await getGeojsonShapes(supabase, ids);
    setLoadingGeo(false);
    if (error) {
      setStatus("Error loading geometry: " + error.message);
      return;
    }
    const geoMap = new Map((data as { id: number; geojson: unknown }[] | null || []).map((g) => [g.id, g.geojson]));
    setMapBoundaries((matches || []).map((m) => ({ ...m, geojson: geoMap.get(m.id) || null })));
  };

  useEffect(() => {
    if (matches && matches.length > 0 && matches.length <= RENDER_CAP) {
      Promise.resolve().then(() => loadGeometry(matches.map((m) => m.id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches]);

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 space-y-6">
      <PageHeader icon={Eye} title="Boundary Inspector" />

      <AdminSubNav active="visualizer" />

      <Card padding="md" className="space-y-5">
        <h2 className="text-lg font-bold text-text-main">Geospatial Boundary Inspector</h2>
        <p className="text-xs text-text-muted">
          Pick a country, optionally narrow to every boundary inside a specific container (e.g. every municipality
          inside one province), and see the result directly on a map — read-only, nothing is selected or changed.
        </p>

        <div>
          <label className="block mb-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">
            Country
          </label>
          <Select value={country} onChange={(e) => setCountry(e.target.value)} className="max-w-xs text-xs">
            <option value="">Select country...</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            Container (optional — e.g. a province)
          </p>
          <Select
            value={containerType}
            onChange={(e) => {
              setContainerType(e.target.value);
              setContainerId(new Set());
            }}
            disabled={!country}
            className="max-w-xs mb-2 text-xs"
          >
            <option value="">{country ? "Container type: none" : "Select a country first"}</option>
            {containerTypeOptions.map((t) => (
              <option key={t.type_name} value={t.type_name}>
                {t.type_name}
              </option>
            ))}
          </Select>
          {containerType && (
            <>
              <p className="text-[10px] text-text-muted mb-2">
                Select none for all of {country}, one for a single {containerType}, or several to combine them.
              </p>
              <BoundaryPicker
                selectedIds={containerId}
                onChange={setContainerId}
                countryFilter={country || undefined}
                boundaryTypeFilter={[containerType]}
                height="220px"
                showMap={false}
              />
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-3 items-end pt-2 border-t border-border-light/20">
          <div>
            <label className="block mb-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">
              Target Boundary Type
            </label>
            <Select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value)}
              disabled={!country}
              className="max-w-xs text-xs"
            >
              <option value="">Select Target Boundary Type...</option>
              {targetTypeOptions.map((t) => (
                <option key={t.type_name} value={t.type_name}>
                  {t.type_name}
                </option>
              ))}
            </Select>
          </div>

          <Button size="sm" onClick={handleVisualize} disabled={!country || !targetType || loadingMatches}>
            {loadingMatches ? "Searching..." : "Visualize"}
          </Button>
        </div>

        {selectedTargetTypeInfo && (
          <div className="flex flex-wrap gap-1.5 -mt-1">
            <span
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                selectedTargetTypeInfo.election_eligible
                  ? "bg-accent/15 text-accent"
                  : "bg-surface/60 text-text-muted"
              }`}
            >
              {selectedTargetTypeInfo.election_eligible ? "Election eligible" : "Not election eligible"}
            </span>
            {selectedTargetTypeInfo.term_length_months && (
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-surface/60 text-text-muted">
                {selectedTargetTypeInfo.term_length_months}mo term
              </span>
            )}
            {selectedTargetTypeInfo.term_limits && (
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-surface/60 text-text-muted">
                {selectedTargetTypeInfo.term_limits} term limit
              </span>
            )}
            {selectedTargetTypeInfo.voting_method && (
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-surface/60 text-text-muted">
                {selectedTargetTypeInfo.voting_method}
              </span>
            )}
            {selectedTargetTypeInfo.description && (
              <span className="text-[10px] text-text-muted italic">{selectedTargetTypeInfo.description}</span>
            )}
          </div>
        )}

        {targetType && entityTypesForCountry.length > 0 && (
          <div className="pt-1">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                Entity types included (a single boundary type can mix several — e.g. real municipalities alongside
                Indian reserves and electoral areas)
              </p>
              <div className="flex gap-2 text-[10px] shrink-0">
                <button
                  onClick={() => setSelectedEntityTypeNames(new Set(entityTypesForCountry.map((t) => t.name)))}
                  className="text-primary hover:underline cursor-pointer"
                >
                  Select all
                </button>
                <button
                  onClick={() => setSelectedEntityTypeNames(new Set())}
                  className="text-primary hover:underline cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {entityTypesForCountry.map((t) => (
                <Checkbox
                  key={t.id}
                  label={t.name}
                  checked={selectedEntityTypeNames.has(t.name)}
                  onChange={(e) =>
                    setSelectedEntityTypeNames((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(t.name);
                      else next.delete(t.name);
                      return next;
                    })
                  }
                />
              ))}
            </div>
          </div>
        )}

        {status && <p className="text-xs text-text-muted">{status}</p>}

        {loadingGeo && <p className="text-xs text-text-muted">Loading geometry...</p>}

        {matches && matches.length > RENDER_CAP && !mapBoundaries && (
          <div className="space-y-3 pt-3 border-t border-border-light/20">
            <Button size="sm" variant="outline" onClick={() => loadGeometry(matches.map((m) => m.id))} disabled={loadingGeo}>
              {loadingGeo ? "Loading map..." : "Load Map Anyway"}
            </Button>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">
              {matches.length} boundaries
            </div>
            <div className="max-h-96 overflow-y-auto space-y-1.5 p-2 bg-surface/30 rounded-xl border border-border-light/20">
              {matches.map((m) => {
                const entityTypeName = getEntityTypeNameForShape(m.properties);
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-2.5 bg-surface-elevated rounded-xl border border-border-light/20 text-xs"
                  >
                    <span className="font-semibold text-text-main flex items-center gap-1.5">
                      <MapPin size={13} className="text-accent" /> {m.name}
                      {entityTypeName && (
                        <span className="px-1.5 py-0.5 rounded bg-surface/60 text-text-muted text-[10px] font-bold">
                          {entityTypeName}
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] text-text-muted">Code: {m.code || "N/A"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {mapBoundaries && (
          <div className="pt-3 border-t border-border-light/20 h-[70vh] max-h-[600px] min-h-[320px]">
            <BoundaryMapComponent boundaries={mapBoundaries} />
          </div>
        )}
      </Card>
    </div>
  );
}
