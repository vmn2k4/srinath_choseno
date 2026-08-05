"use client";

import React, { useState, useEffect, useCallback } from "react";
import AdminSubNav from "./AdminSubNav";
import { getCountries, listBoundaryTypes, searchMapShapesByName } from "@/lib/services/boundaries";
import { getElectionRoleTypes, getOfficeHoldersForShape, upsertOfficeHolder, removeOfficeHolder } from "@/lib/services/elections";
import { getPoliticalParties } from "@/lib/services/politicalParties";
import { UserCheck, Search, Save, Trash2, X } from "lucide-react";
import { Card, Button, Input, Textarea, Select, Spinner, PageHeader } from "@/components/primitives";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";

interface RoleType {
  id: string;
  role_key: string;
  region_override: string;
  role_title: string;
  description: string | null;
}

interface Holder {
  id: string;
  election_role_type_id: string;
  full_name: string;
  bio: string | null;
  source_url: string | null;
  holding_since: string | null;
  political_parties?: { name: string } | null;
}

interface ShapeOption {
  id: number;
  name: string;
  country: string;
  boundary_type: string;
}

const emptyForm = { fullName: "", politicalPartyId: "", bio: "", sourceUrl: "", holdingSince: "" };

export default function OfficeHoldersAdminClient() {
  const supabase = createClient();
  const { user } = useAuth();

  const [countries, setCountries] = useState<{ name: string }[]>([]);
  const [country, setCountry] = useState("");
  const [boundaryTypes, setBoundaryTypes] = useState<{ type_name: string }[]>([]);
  const [boundaryType, setBoundaryType] = useState("");
  const [nameQuery, setNameQuery] = useState("");
  const [shapeOptions, setShapeOptions] = useState<ShapeOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedShape, setSelectedShape] = useState<ShapeOption | null>(null);

  const [roleTypes, setRoleTypes] = useState<RoleType[]>([]);
  const [holders, setHolders] = useState<Record<string, Holder>>({});
  const [loadingRoles, setLoadingRoles] = useState(false);

  const [parties, setParties] = useState<{ id: number; name: string }[]>([]);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    getCountries(supabase).then(({ data }) => setCountries(data || []));
  }, [supabase]);

  useEffect(() => {
    if (!country) return;
    listBoundaryTypes(supabase, { country, columns: "type_name" }).then(({ data }) =>
      setBoundaryTypes((data as { type_name: string }[] | null) || [])
    );
    getPoliticalParties(supabase, { country }).then(({ data }) => setParties(data || []));
  }, [supabase, country]);

  const handleCountryChange = (value: string) => {
    setCountry(value);
    setSelectedShape(null);
    setRoleTypes([]);
    if (!value) {
      setBoundaryTypes([]);
      setBoundaryType("");
    }
  };

  const runSearch = useCallback(async () => {
    if (!country || !boundaryType || nameQuery.trim().length < 2) {
      setShapeOptions([]);
      return;
    }
    setSearching(true);
    const { data } = await searchMapShapesByName(supabase, nameQuery, { country, boundaryType });
    setShapeOptions((data as ShapeOption[] | null) || []);
    setSearching(false);
  }, [supabase, country, boundaryType, nameQuery]);

  useEffect(() => {
    const id = setTimeout(runSearch, 300);
    return () => clearTimeout(id);
  }, [runSearch]);

  const selectShape = async (shape: ShapeOption) => {
    setSelectedShape(shape);
    setShapeOptions([]);
    setNameQuery(shape.name);
    setLoadingRoles(true);
    const [{ data: roles }, { data: existingHolders }] = await Promise.all([
      getElectionRoleTypes(supabase, shape.country, shape.boundary_type),
      getOfficeHoldersForShape(supabase, shape.id),
    ]);
    setRoleTypes((roles as RoleType[] | null) || []);
    const byRole: Record<string, Holder> = {};
    ((existingHolders as Holder[] | null) || []).forEach((h) => {
      byRole[h.election_role_type_id] = h;
    });
    setHolders(byRole);
    setLoadingRoles(false);
  };

  const startEdit = (role: RoleType) => {
    const existing = holders[role.id];
    setForm(
      existing
        ? {
            fullName: existing.full_name,
            politicalPartyId: "",
            bio: existing.bio || "",
            sourceUrl: existing.source_url || "",
            holdingSince: existing.holding_since || "",
          }
        : emptyForm
    );
    setEditingRoleId(role.id);
    setStatus("");
  };

  const saveHolder = async (role: RoleType) => {
    if (!selectedShape || !user || !form.fullName.trim()) return;
    setSaving(true);
    setStatus("");
    const { data, error } = await upsertOfficeHolder(
      supabase,
      {
        mapShapeId: selectedShape.id,
        electionRoleTypeId: role.id,
        fullName: form.fullName.trim(),
        politicalPartyId: form.politicalPartyId ? Number(form.politicalPartyId) : null,
        bio: form.bio.trim() || null,
        sourceUrl: form.sourceUrl.trim() || null,
        holdingSince: form.holdingSince || null,
      },
      user.id
    );
    setSaving(false);
    if (error) {
      setStatus("Error: " + error.message);
      return;
    }
    setHolders((prev) => ({ ...prev, [role.id]: data as Holder }));
    setEditingRoleId(null);
  };

  const deleteHolder = async (role: RoleType) => {
    const existing = holders[role.id];
    if (!existing) return;
    setSaving(true);
    const { error } = await removeOfficeHolder(supabase, existing.id);
    setSaving(false);
    if (error) {
      setStatus("Error: " + error.message);
      return;
    }
    setHolders((prev) => {
      const next = { ...prev };
      delete next[role.id];
      return next;
    });
    setEditingRoleId(null);
  };

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 space-y-6">
      <PageHeader
        icon={UserCheck}
        title="Office Holders"
        subtitle="Set the current officeholder shown on each boundary's public directory page."
      />

      <AdminSubNav active="office-holders" />

      <Card padding="md" className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select value={country} onChange={(e) => handleCountryChange(e.target.value)}>
            <option value="">Select country</option>
            {countries.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </Select>

          <Select
            value={boundaryType}
            onChange={(e) => {
              setBoundaryType(e.target.value);
              setSelectedShape(null);
              setRoleTypes([]);
            }}
            disabled={!country}
          >
            <option value="">Select boundary type</option>
            {boundaryTypes.map((t) => (
              <option key={t.type_name} value={t.type_name}>
                {t.type_name}
              </option>
            ))}
          </Select>
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input
            className="pl-9"
            placeholder="Search boundary by name (e.g. Surrey)"
            value={nameQuery}
            onChange={(e) => {
              setNameQuery(e.target.value);
              setSelectedShape(null);
            }}
            disabled={!boundaryType}
          />
          {searching && <Spinner size="sm" className="absolute right-3 top-1/2 -translate-y-1/2" />}
        </div>

        {shapeOptions.length > 0 && (
          <div className="border border-border-light/40 rounded-xl divide-y divide-border-light/30 overflow-hidden">
            {shapeOptions.map((s) => (
              <button
                key={s.id}
                onClick={() => selectShape(s)}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface-hover transition-colors cursor-pointer"
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </Card>

      {selectedShape && (
        <Card padding="md" className="space-y-4">
          <h3 className="font-bold text-text-main text-lg">{selectedShape.name}</h3>

          {loadingRoles ? (
            <Spinner />
          ) : roleTypes.length === 0 ? (
            <p className="text-sm text-text-muted">
              No roles are defined for {selectedShape.country}/{selectedShape.boundary_type} yet.
            </p>
          ) : (
            <div className="space-y-3">
              {roleTypes.map((role) => {
                const existing = holders[role.id];
                const isEditing = editingRoleId === role.id;
                return (
                  <div key={role.id} className="p-4 bg-surface/30 border border-border-light/30 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-bold text-sm text-text-main">{role.role_title}</p>
                        {role.description && (
                          <p className="text-xs text-text-muted mt-0.5 max-w-md">{role.description}</p>
                        )}
                      </div>
                      {!isEditing && (
                        <div className="flex items-center gap-2">
                          {existing ? (
                            <>
                              <span className="text-xs font-semibold text-text-secondary">
                                {existing.full_name}
                                {existing.political_parties?.name ? ` (${existing.political_parties.name})` : ""}
                              </span>
                              <Button size="sm" variant="outline" onClick={() => startEdit(role)}>
                                Edit
                              </Button>
                            </>
                          ) : (
                            <Button size="sm" onClick={() => startEdit(role)}>
                              Set officeholder
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    {isEditing && (
                      <div className="space-y-2.5 pt-2 border-t border-border-light/20">
                        <Input
                          placeholder="Full name"
                          value={form.fullName}
                          onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                        />
                        <Select
                          value={form.politicalPartyId}
                          onChange={(e) => setForm((f) => ({ ...f, politicalPartyId: e.target.value }))}
                        >
                          <option value="">No party listed</option>
                          {parties.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </Select>
                        <Textarea
                          placeholder="Short bio (optional)"
                          value={form.bio}
                          onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                          rows={2}
                        />
                        <Input
                          placeholder="Official source URL (optional)"
                          value={form.sourceUrl}
                          onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))}
                        />
                        <Input
                          type="date"
                          placeholder="Holding office since"
                          value={form.holdingSince}
                          onChange={(e) => setForm((f) => ({ ...f, holdingSince: e.target.value }))}
                        />
                        <div className="flex items-center gap-2 pt-1">
                          <Button size="sm" onClick={() => saveHolder(role)} disabled={saving || !form.fullName.trim()} className="gap-1">
                            <Save size={14} /> Save
                          </Button>
                          {existing && (
                            <Button size="sm" variant="outline" onClick={() => deleteHolder(role)} disabled={saving} className="gap-1 text-danger border-danger/40">
                              <Trash2 size={14} /> Remove
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => setEditingRoleId(null)} className="gap-1">
                            <X size={14} /> Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {status && <p className="text-danger text-xs">{status}</p>}
        </Card>
      )}
    </div>
  );
}
