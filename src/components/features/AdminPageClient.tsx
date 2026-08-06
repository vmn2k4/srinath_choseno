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
  updateBoundaryType,
  deleteBoundaryType,
  listEntityTypes,
  createEntityType,
  updateEntityType,
  deleteEntityType,
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
  Checkbox,
  Spinner,
  PageHeader,
  ConfirmDialog,
} from "@/components/primitives";
import { Trash2, Plus, Pencil, Globe, Layers, Flag, Tag } from "lucide-react";
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
  election_eligible: boolean;
  term_length_months: number | null;
  term_limits: number | null;
  voting_method: string | null;
  description: string | null;
}
interface PartyRow {
  id: number;
  country: string;
  name: string;
  rank: number;
}
interface EntityTypeRow {
  id: string;
  country: string;
  name: string;
  election_eligible: boolean;
  description: string | null;
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
  const [newTypeElectionEligible, setNewTypeElectionEligible] = useState(true);
  const [newTypeTermLength, setNewTypeTermLength] = useState("");
  const [newTypeTermLimits, setNewTypeTermLimits] = useState("");
  const [newTypeVotingMethod, setNewTypeVotingMethod] = useState("");
  const [typeStatus, setTypeStatus] = useState("");

  const [editingTypeId, setEditingTypeId] = useState<number | null>(null);
  const [editTypeForm, setEditTypeForm] = useState({
    electionEligible: true,
    termLengthMonths: "",
    termLimits: "",
    votingMethod: "",
    description: "",
  });

  const [partyRows, setPartyRows] = useState<PartyRow[]>([]);
  const [loadingParties, setLoadingParties] = useState(true);
  const [newPartyCountry, setNewPartyCountry] = useState("");
  const [newPartyName, setNewPartyName] = useState("");
  const [partyStatus, setPartyStatus] = useState("");

  const [entityTypeRows, setEntityTypeRows] = useState<EntityTypeRow[]>([]);
  const [loadingEntityTypes, setLoadingEntityTypes] = useState(true);
  const [newEntityTypeCountry, setNewEntityTypeCountry] = useState("");
  const [newEntityTypeName, setNewEntityTypeName] = useState("");
  const [entityTypeStatus, setEntityTypeStatus] = useState("");

  const [editingEntityTypeId, setEditingEntityTypeId] = useState<string | null>(null);
  const [editEntityTypeForm, setEditEntityTypeForm] = useState({
    electionEligible: true,
    description: "",
  });

  const [confirmTarget, setConfirmTarget] = useState<
    { kind: "type"; id: number } | { kind: "party"; id: number } | { kind: "entityType"; id: string } | null
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
      columns:
        "id, country, type_name, rank, election_eligible, term_length_months, term_limits, voting_method, description",
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

  const fetchEntityTypes = async () => {
    if (entityTypeRows.length > 0) setLoadingEntityTypes(true);
    const { data } = await listEntityTypes(supabase);
    setEntityTypeRows((data as unknown as EntityTypeRow[]) || []);
    setLoadingEntityTypes(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCountries();
    fetchBoundaryTypes();
    fetchParties();
    fetchEntityTypes();
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
      electionEligible: newTypeElectionEligible,
      termLengthMonths: newTypeTermLength ? parseInt(newTypeTermLength, 10) : null,
      termLimits: newTypeTermLimits ? parseInt(newTypeTermLimits, 10) : null,
      votingMethod: newTypeVotingMethod.trim() || null,
    });
    if (error) {
      setTypeStatus("Error: " + error.message);
      return;
    }
    setTypeStatus("");
    setNewTypeName("");
    setNewTypeRank("");
    setNewTypeElectionEligible(true);
    setNewTypeTermLength("");
    setNewTypeTermLimits("");
    setNewTypeVotingMethod("");
    fetchBoundaryTypes();
  };

  const handleDeleteType = (typeId: number) => {
    setConfirmTarget({ kind: "type", id: typeId });
  };

  const startEditType = (t: BoundaryTypeRow) => {
    setEditingTypeId(t.id);
    setEditTypeForm({
      electionEligible: t.election_eligible,
      termLengthMonths: t.term_length_months?.toString() ?? "",
      termLimits: t.term_limits?.toString() ?? "",
      votingMethod: t.voting_method ?? "",
      description: t.description ?? "",
    });
  };

  const cancelEditType = () => {
    setEditingTypeId(null);
  };

  const saveEditType = async (typeId: number) => {
    const { error } = await updateBoundaryType(supabase, typeId, {
      electionEligible: editTypeForm.electionEligible,
      termLengthMonths: editTypeForm.termLengthMonths ? parseInt(editTypeForm.termLengthMonths, 10) : null,
      termLimits: editTypeForm.termLimits ? parseInt(editTypeForm.termLimits, 10) : null,
      votingMethod: editTypeForm.votingMethod.trim() || null,
      description: editTypeForm.description.trim() || null,
    });
    if (error) {
      setTypeStatus("Error: " + error.message);
      return;
    }
    setTypeStatus("");
    setEditingTypeId(null);
    fetchBoundaryTypes();
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

  const handleAddEntityType = async () => {
    if (!newEntityTypeCountry || !newEntityTypeName.trim()) {
      setEntityTypeStatus("Error: Country and name are required.");
      return;
    }
    const { error } = await createEntityType(supabase, {
      country: newEntityTypeCountry,
      name: newEntityTypeName.trim(),
    });
    if (error) {
      setEntityTypeStatus("Error: " + error.message);
      return;
    }
    setEntityTypeStatus("");
    setNewEntityTypeName("");
    fetchEntityTypes();
  };

  const handleDeleteEntityType = (typeId: string) => {
    setConfirmTarget({ kind: "entityType", id: typeId });
  };

  const startEditEntityType = (t: EntityTypeRow) => {
    setEditingEntityTypeId(t.id);
    setEditEntityTypeForm({ electionEligible: t.election_eligible, description: t.description ?? "" });
  };

  const cancelEditEntityType = () => {
    setEditingEntityTypeId(null);
  };

  const saveEditEntityType = async (typeId: string) => {
    const { error } = await updateEntityType(supabase, typeId, {
      electionEligible: editEntityTypeForm.electionEligible,
      description: editEntityTypeForm.description.trim() || null,
    });
    if (error) {
      setEntityTypeStatus("Error: " + error.message);
      return;
    }
    setEntityTypeStatus("");
    setEditingEntityTypeId(null);
    fetchEntityTypes();
  };

  const handleConfirmDelete = async () => {
    if (!confirmTarget) return;
    if (confirmTarget.kind === "type") {
      await deleteBoundaryType(supabase, confirmTarget.id);
      fetchBoundaryTypes();
    } else if (confirmTarget.kind === "party") {
      await deletePoliticalParty(supabase, confirmTarget.id);
      fetchParties();
    } else {
      await deleteEntityType(supabase, confirmTarget.id);
      fetchEntityTypes();
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

        <div className="flex flex-wrap gap-2 items-center">
          <Checkbox
            label="Election eligible"
            checked={newTypeElectionEligible}
            onChange={(e) => setNewTypeElectionEligible(e.target.checked)}
          />
          <Input
            placeholder="Term length (months)"
            value={newTypeTermLength}
            onChange={(e) => setNewTypeTermLength(e.target.value)}
            className="text-xs w-40"
          />
          <Input
            placeholder="Term limits (blank = unlimited)"
            value={newTypeTermLimits}
            onChange={(e) => setNewTypeTermLimits(e.target.value)}
            className="text-xs w-52"
          />
          <Input
            placeholder="Voting method (e.g. first_past_post)"
            value={newTypeVotingMethod}
            onChange={(e) => setNewTypeVotingMethod(e.target.value)}
            className="text-xs w-56"
          />
        </div>

        {typeStatus && <p className="text-xs text-danger">{typeStatus}</p>}

        {loadingTypes ? (
          <Spinner />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
            {boundaryTypes.map((t, idx) =>
              editingTypeId === t.id ? (
                <div
                  key={t.id || `${t.country}-${t.type_name}-${idx}`}
                  className="p-3 bg-surface/30 border border-primary/40 rounded-xl text-xs space-y-2 sm:col-span-2 md:col-span-3"
                >
                  <div className="font-bold text-text-main">
                    {t.type_name} <span className="text-text-muted font-normal">({t.country} · Rank {t.rank})</span>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <Checkbox
                      label="Election eligible"
                      checked={editTypeForm.electionEligible}
                      onChange={(e) =>
                        setEditTypeForm((f) => ({ ...f, electionEligible: e.target.checked }))
                      }
                    />
                    <Input
                      placeholder="Term length (months)"
                      value={editTypeForm.termLengthMonths}
                      onChange={(e) =>
                        setEditTypeForm((f) => ({ ...f, termLengthMonths: e.target.value }))
                      }
                      className="text-xs w-36"
                    />
                    <Input
                      placeholder="Term limits"
                      value={editTypeForm.termLimits}
                      onChange={(e) => setEditTypeForm((f) => ({ ...f, termLimits: e.target.value }))}
                      className="text-xs w-28"
                    />
                    <Input
                      placeholder="Voting method"
                      value={editTypeForm.votingMethod}
                      onChange={(e) =>
                        setEditTypeForm((f) => ({ ...f, votingMethod: e.target.value }))
                      }
                      className="text-xs w-44"
                    />
                  </div>
                  <Input
                    placeholder="Description (optional)"
                    value={editTypeForm.description}
                    onChange={(e) => setEditTypeForm((f) => ({ ...f, description: e.target.value }))}
                    className="text-xs w-full"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveEditType(t.id)} className="text-xs">
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={cancelEditType} className="text-xs">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  key={t.id || `${t.country}-${t.type_name}-${idx}`}
                  className="flex items-start justify-between gap-2 p-3 bg-surface/30 border border-border-light/20 rounded-xl text-xs"
                >
                  <div className="min-w-0">
                    <div>
                      <span className="font-bold text-text-main">{t.type_name}</span>
                      <span className="text-text-muted ml-2">
                        ({t.country} · Rank {t.rank})
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <Badge tone={t.election_eligible ? "accent" : "neutral"}>
                        {t.election_eligible ? "Election eligible" : "Not election eligible"}
                      </Badge>
                      {t.term_length_months && (
                        <Badge tone="neutral">{t.term_length_months}mo term</Badge>
                      )}
                      {t.term_limits && <Badge tone="neutral">{t.term_limits} term limit</Badge>}
                      {t.voting_method && <Badge tone="neutral">{t.voting_method}</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEditType(t)}
                      className="text-text-muted hover:text-primary p-1 cursor-pointer"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDeleteType(t.id)}
                      className="text-text-muted hover:text-danger p-1 cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </Card>

      {/* Entity Types */}
      <Card padding="md" className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
            <Tag size={18} className="text-primary" /> Entity Types
          </h2>
          <p className="text-xs text-text-muted mt-1">
            A single boundary type can mix several kinds of entity from one shapefile upload (e.g. BC's "Municipal"
            type mixes real municipalities with Indian reserves and regional district electoral areas). These
            categories are what the election seat-builder filters by.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Select
            value={newEntityTypeCountry}
            onChange={(e) => setNewEntityTypeCountry(e.target.value)}
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
            placeholder="Entity Type Name (e.g. Indian Reserve)"
            value={newEntityTypeName}
            onChange={(e) => setNewEntityTypeName(e.target.value)}
            className="text-xs w-56"
          />
          <Button size="sm" onClick={handleAddEntityType} className="gap-1 text-xs">
            <Plus size={14} /> Add Entity Type
          </Button>
        </div>

        {entityTypeStatus && <p className="text-xs text-danger">{entityTypeStatus}</p>}

        {loadingEntityTypes ? (
          <Spinner />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
            {entityTypeRows.map((t) =>
              editingEntityTypeId === t.id ? (
                <div
                  key={t.id}
                  className="p-3 bg-surface/30 border border-primary/40 rounded-xl text-xs space-y-2 sm:col-span-2 md:col-span-3"
                >
                  <div className="font-bold text-text-main">
                    {t.name} <span className="text-text-muted font-normal">({t.country})</span>
                  </div>
                  <Checkbox
                    label="Election eligible"
                    checked={editEntityTypeForm.electionEligible}
                    onChange={(e) =>
                      setEditEntityTypeForm((f) => ({ ...f, electionEligible: e.target.checked }))
                    }
                  />
                  <Input
                    placeholder="Description (optional)"
                    value={editEntityTypeForm.description}
                    onChange={(e) => setEditEntityTypeForm((f) => ({ ...f, description: e.target.value }))}
                    className="text-xs w-full"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveEditEntityType(t.id)} className="text-xs">
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={cancelEditEntityType} className="text-xs">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  key={t.id}
                  className="flex items-start justify-between gap-2 p-3 bg-surface/30 border border-border-light/20 rounded-xl text-xs"
                >
                  <div className="min-w-0">
                    <div>
                      <span className="font-bold text-text-main">{t.name}</span>
                      <span className="text-text-muted ml-2">({t.country})</span>
                    </div>
                    <div className="mt-1">
                      <Badge tone={t.election_eligible ? "accent" : "neutral"}>
                        {t.election_eligible ? "Election eligible" : "Not election eligible"}
                      </Badge>
                    </div>
                    {t.description && <p className="text-text-muted mt-1">{t.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEditEntityType(t)}
                      className="text-text-muted hover:text-primary p-1 cursor-pointer"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDeleteEntityType(t.id)}
                      className="text-text-muted hover:text-danger p-1 cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )
            )}
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
            : confirmTarget?.kind === "entityType"
              ? "Delete this entity type?"
              : "Delete this political party?"
        }
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
