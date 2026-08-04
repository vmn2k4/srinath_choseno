"use client";

import React, { useState, useEffect } from "react";
import AdminSubNav from "./AdminSubNav";
import {
  getCountries,
  listBoundaryTypes,
  getMapShapesByType,
  findShapesInContainers,
  getGeojsonShapes,
} from "@/lib/services/boundaries";
import { Eye, MapPin } from "lucide-react";
import { Card, Button, Select, PageHeader } from "@/components/primitives";
import { createClient } from "@/lib/supabase/client";

const RENDER_CAP = 500;

export default function BoundaryVisualizerClient() {
  const supabase = createClient();
  const [countries, setCountries] = useState<string[]>([]);
  const [country, setCountry] = useState("");
  const [boundaryTypes, setBoundaryTypes] = useState<any[]>([]);
  const [targetType, setTargetType] = useState("");

  const [matches, setMatches] = useState<any[] | null>(null);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    getCountries(supabase).then(({ data }) =>
      setCountries((data || []).map((c: any) => c.name))
    );
    listBoundaryTypes(supabase).then(({ data }) =>
      setBoundaryTypes(data || [])
    );
  }, [supabase]);

  const typesForCountry = country
    ? boundaryTypes.filter((t) => t.country === country)
    : [];

  const handleVisualize = async () => {
    if (!country || !targetType) {
      setStatus("Pick a country and a target boundary type first.");
      return;
    }
    setLoadingMatches(true);
    setMatches(null);
    setStatus("");

    const { data, error } = await getMapShapesByType(supabase, {
      country,
      boundaryType: targetType,
      columns: "id, name, shape_code",
      paginated: true,
    });

    setLoadingMatches(false);
    if (error) {
      setStatus("Error: " + ((error as any).message || "Failed to fetch shapes"));
      return;
    }

    setMatches(data || []);
    if ((data || []).length === 0) {
      setStatus("No matching boundaries found.");
    } else if (data && data.length > RENDER_CAP) {
      setStatus(
        `${data.length} boundaries matched — showing list below (cap: ${RENDER_CAP}).`
      );
    }
  };

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 space-y-6">
      <PageHeader icon={Eye} title="Boundary Inspector" />

      <AdminSubNav active="visualizer" />

      <Card padding="md" className="space-y-4">
        <h2 className="text-lg font-bold text-text-main">
          Geospatial Boundary Inspector
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <Select value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">Select Country...</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>

          <Select
            value={targetType}
            onChange={(e) => setTargetType(e.target.value)}
            disabled={!country}
          >
            <option value="">Select Target Boundary Type...</option>
            {typesForCountry.map((t) => (
              <option key={t.type_name} value={t.type_name}>
                {t.type_name}
              </option>
            ))}
          </Select>
        </div>

        <Button
          size="sm"
          onClick={handleVisualize}
          disabled={!country || !targetType || loadingMatches}
        >
          {loadingMatches ? "Searching..." : "Inspect Boundaries"}
        </Button>

        {status && <p className="text-xs text-text-muted">{status}</p>}

        {matches && matches.length > 0 && (
          <div className="space-y-3 pt-3 border-t border-border-light/20">
            <h3 className="text-xs font-bold text-text-main">
              Matched Shapes ({matches.length})
            </h3>
            <div className="max-h-96 overflow-y-auto space-y-1.5 p-2 bg-surface/30 rounded-xl border border-border-light/20">
              {matches.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-2.5 bg-surface-elevated rounded-xl border border-border-light/20 text-xs"
                >
                  <span className="font-semibold text-text-main flex items-center gap-1.5">
                    <MapPin size={13} className="text-accent" /> {m.name}
                  </span>
                  <span className="text-[11px] text-text-muted">
                    Code: {m.shape_code || "N/A"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
