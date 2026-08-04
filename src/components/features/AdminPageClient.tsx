"use client";

import React, { useState, useEffect, useMemo } from "react";
import AdminSubNav from "./AdminSubNav";
import BoundaryUploadsPanel from "./BoundaryUploadsPanel";
import RedistrictingPanel from "./RedistrictingPanel";
import {
  getCountries,
  createCountry,
  listBoundaryTypes,
  createBoundaryType,
  createStandardBoundaryTypeSet,
  deleteBoundaryType,
} from "@/lib/services/boundaries";
import {
  listPoliticalPartiesAllCountries,
  createPoliticalParty,
  deletePoliticalParty,
} from "@/lib/services/politicalParties";
import {
  Card,
  Button,
  Badge,
  Input,
  Select,
  Spinner,
  PageHeader,
  ConfirmDialog,
} from "@/components/primitives";
import { Trash2, Plus, Globe, Layers, Flag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface CountryRow {
  name: string;
  code: string | null;
  flag_emoji: string | null;
}
interface BoundaryTypeRow {
  id: number;
  country: string;
  type_name: string;
  rank: number;
}
interface PartyRow {
  id: number;
  country: string;
  name: string;
  rank: number;
}
interface UploadBatch {
  id: number;
}

export default function AdminPageClient() {
  const supabase = createClient();
  const [redistrictBatch, setRedistrictBatch] = useState<UploadBatch | null>(null);
  const [countryRows, setCountryRows] = useState<CountryRow[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [newCountryName, setNewCountryName] = useState("");
  const [newCountryCode, setNewCountryCode] = useState("");
  const [newCountryFlag, setNewCountryFlag] = useState("");
  const [countryStatus, setCountryStatus] = useState("");

  const [boundaryTypes, setBoundaryTypes] = useState<BoundaryTypeRow[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [newTypeCountry, setNewTypeCountry] = useState("");
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeRank, setNewTypeRank] = useState("");
  const [typeStatus, setTypeStatus] = useState("");

  const [partyRows, setPartyRows] = useState<PartyRow[]>([]);
  const [loadingParties, setLoadingParties] = useState(true);
  const [newPartyCountry, setNewPartyCountry] = useState("");
  const [newPartyName, setNewPartyName] = useState("");
  const [partyStatus, setPartyStatus] = useState("");

  const [confirmTarget, setConfirmTarget] = useState<
    { kind: "type"; id: number } | { kind: "party"; id: number } | null
  >(null);

  const fetchCountries = async () => {
    if (countryRows.length > 0) setLoadingCountries(true);
    const { data } = await getCountries(supabase);
    setCountryRows(data || []);
    setLoadingCountries(false);
  };

  const fetchBoundaryTypes = async () => {
    if (boundaryTypes.length > 0) setLoadingTypes(true);
    const { data } = await listBoundaryTypes(supabase, {
      columns: "id, country, type_name, rank",
    });
    setBoundaryTypes((data as unknown as BoundaryTypeRow[]) || []);
    setLoadingTypes(false);
  };

  const fetchParties = async () => {
    if (partyRows.length > 0) setLoadingParties(true);
    const { data } = await listPoliticalPartiesAllCountries(supabase);
    setPartyRows(data || []);
    setLoadingParties(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCountries();
    fetchBoundaryTypes();
    fetchParties();
  }, [supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  const countries = useMemo(
    () => countryRows.map((c) => c.name),
    [countryRows]
  );

  const handleAddCountry = async () => {
    if (!newCountryName.trim()) {
      setCountryStatus("Error: Country name is required.");
      return;
    }
    const { error } = await createCountry(supabase, {
      name: newCountryName.trim(),
      code: newCountryCode.trim() ? newCountryCode.trim().toUpperCase() : null,
      flagEmoji: newCountryFlag.trim() || null,
    });
    if (error) {
      setCountryStatus("Error: " + error.message);
      return;
    }
    setCountryStatus("");
    setNewCountryName("");
    setNewCountryCode("");
    setNewCountryFlag("");
    fetchCountries();
  };

  const handleAddStandardSet = async () => {
    if (!newTypeCountry) return;
    const { error } = await createStandardBoundaryTypeSet(
      supabase,
      newTypeCountry
    );
    if (error) {
      setTypeStatus("Error: " + error.message);
      return;
    }
    setTypeStatus("");
    fetchBoundaryTypes();
  };

  const handleAddType = async () => {
    if (!newTypeCountry || !newTypeName.trim() || !newTypeRank) {
      setTypeStatus("Error: Country, type name, and rank are required.");
      return;
    }
    const rankNum = parseInt(newTypeRank, 10);
    if (isNaN(rankNum) || rankNum < 1) {
      setTypeStatus("Error: Rank must be a positive integer.");
      return;
    }
    const { error } = await createBoundaryType(supabase, {
      country: newTypeCountry,
      typeName: newTypeName.trim(),
      rank: rankNum,
    });
    if (error) {
      setTypeStatus("Error: " + error.message);
      return;
    }
    setTypeStatus("");
    setNewTypeName("");
    setNewTypeRank("");
    fetchBoundaryTypes();
  };

  const handleDeleteType = (typeId: number) => {
    setConfirmTarget({ kind: "type", id: typeId });
  };

  const handleAddParty = async () => {
    if (!newPartyCountry || !newPartyName.trim()) {
      setPartyStatus("Error: Country and party name are required.");
      return;
    }
    const { error } = await createPoliticalParty(supabase, {
      country: newPartyCountry,
      name: newPartyName.trim(),
    });
    if (error) {
      setPartyStatus("Error: " + error.message);
      return;
    }
    setPartyStatus("");
    setNewPartyName("");
    fetchParties();
  };

  const handleDeleteParty = (partyId: number) => {
    setConfirmTarget({ kind: "party", id: partyId });
  };

  const handleConfirmDelete = async () => {
    if (!confirmTarget) return;
    if (confirmTarget.kind === "type") {
      await deleteBoundaryType(supabase, confirmTarget.id);
      fetchBoundaryTypes();
    } else {
      await deletePoliticalParty(supabase, confirmTarget.id);
      fetchParties();
    }
    setConfirmTarget(null);
  };

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 space-y-8">
      <PageHeader
        title="Admin Portal"
        subtitle="Geospatial boundary hierarchy, shapefile uploads, and platform settings."
      />

      <AdminSubNav active="boundaries" />

      {/* Country Registry */}
      <Card padding="md" className="space-y-4">
        <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
          <Globe size={18} className="text-primary" /> Supported Countries
        </h2>

        <div className="flex flex-wrap gap-2 items-center">
          <Input
            placeholder="Country Name"
            value={newCountryName}
            onChange={(e) => setNewCountryName(e.target.value)}
            className="text-xs w-44"
          />
          <Input
            placeholder="ISO Code (e.g. CA)"
            value={newCountryCode}
            onChange={(e) => setNewCountryCode(e.target.value)}
            className="text-xs w-28"
          />
          <Input
            placeholder="Flag 🇨🇦"
            value={newCountryFlag}
            onChange={(e) => setNewCountryFlag(e.target.value)}
            className="text-xs w-20"
          />
          <Button size="sm" onClick={handleAddCountry} className="gap-1 text-xs">
            <Plus size={14} /> Add Country
          </Button>
        </div>

        {countryStatus && (
          <p className="text-xs text-danger">{countryStatus}</p>
        )}

        {loadingCountries ? (
          <Spinner />
        ) : (
          <div className="flex flex-wrap gap-2 pt-2">
            {countryRows.map((c, idx) => (
              <span
                key={c.code || c.name || idx}
                className="px-3 py-1.5 bg-surface/40 border border-border-light/30 rounded-xl text-xs font-semibold text-text-main flex items-center gap-1.5"
              >
                {c.flag_emoji} {c.name} {c.code && <Badge tone="accent">{c.code}</Badge>}
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* Boundary Types */}
      <Card padding="md" className="space-y-4">
        <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
          <Layers size={18} className="text-primary" /> Boundary Types & Ranks
        </h2>

        <div className="flex flex-wrap gap-2 items-center">
          <Select
            value={newTypeCountry}
            onChange={(e) => setNewTypeCountry(e.target.value)}
            className="text-xs w-44"
          >
            <option value="">Select Country...</option>
            {countries.map((c, idx) => (
              <option key={`${c}-${idx}`} value={c}>
                {c}
              </option>
            ))}
          </Select>

          <Input
            placeholder="Type Name (e.g. Municipal)"
            value={newTypeName}
            onChange={(e) => setNewTypeName(e.target.value)}
            className="text-xs w-44"
          />
          <Input
            placeholder="Rank (1=Broad, 3=Local)"
            value={newTypeRank}
            onChange={(e) => setNewTypeRank(e.target.value)}
            className="text-xs w-36"
          />

          <Button size="sm" onClick={handleAddType} className="gap-1 text-xs">
            <Plus size={14} /> Add Type
          </Button>

          {newTypeCountry && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddStandardSet}
              className="text-xs"
            >
              Seed Standard Tiers
            </Button>
          )}
        </div>

        {typeStatus && <p className="text-xs text-danger">{typeStatus}</p>}

        {loadingTypes ? (
          <Spinner />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
            {boundaryTypes.map((t, idx) => (
              <div
                key={t.id || `${t.country}-${t.type_name}-${idx}`}
                className="flex items-center justify-between p-3 bg-surface/30 border border-border-light/20 rounded-xl text-xs"
              >
                <div>
                  <span className="font-bold text-text-main">{t.type_name}</span>
                  <span className="text-text-muted ml-2">
                    ({t.country} · Rank {t.rank})
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteType(t.id)}
                  className="text-text-muted hover:text-danger p-1 cursor-pointer"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Political Parties */}
      <Card padding="md" className="space-y-4">
        <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
          <Flag size={18} className="text-primary" /> Recognized Political Parties
        </h2>

        <div className="flex flex-wrap gap-2 items-center">
          <Select
            value={newPartyCountry}
            onChange={(e) => setNewPartyCountry(e.target.value)}
            className="text-xs w-44"
          >
            <option value="">Select Country...</option>
            {countries.map((c, idx) => (
              <option key={`${c}-${idx}`} value={c}>
                {c}
              </option>
            ))}
          </Select>

          <Input
            placeholder="Party Name"
            value={newPartyName}
            onChange={(e) => setNewPartyName(e.target.value)}
            className="text-xs w-48"
          />

          <Button size="sm" onClick={handleAddParty} className="gap-1 text-xs">
            <Plus size={14} /> Add Party
          </Button>
        </div>

        {partyStatus && <p className="text-xs text-danger">{partyStatus}</p>}

        {loadingParties ? (
          <Spinner />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
            {partyRows.map((p, idx) => (
              <div
                key={p.id || `${p.country}-${p.name}-${idx}`}
                className="flex items-center justify-between p-3 bg-surface/30 border border-border-light/20 rounded-xl text-xs"
              >
                <div>
                  <span className="font-bold text-text-main">{p.name}</span>
                  <span className="text-text-muted ml-2">({p.country})</span>
                </div>
                <button
                  onClick={() => handleDeleteParty(p.id)}
                  className="text-text-muted hover:text-danger p-1 cursor-pointer"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Upload Batches Panel */}
      <BoundaryUploadsPanel
        onRedistrictBatch={(batch) => setRedistrictBatch(batch)}
      />

      {/* Redistricting Panel */}
      <RedistrictingPanel preselectedBatch={redistrictBatch} />

      <ConfirmDialog
        open={!!confirmTarget}
        title={
          confirmTarget?.kind === "type"
            ? "Delete this boundary type configuration?"
            : "Delete this political party?"
        }
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
