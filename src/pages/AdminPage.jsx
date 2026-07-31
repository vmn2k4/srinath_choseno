import React, { useState, useEffect, useMemo } from 'react';
import shp from 'shpjs';
import { Trash2, Plus } from 'lucide-react';
import BoundaryUploadsPanel from './Admin/BoundaryUploadsPanel';
import RedistrictingPanel from './Admin/RedistrictingPanel';
import AdminSubNav from '../components/AdminSubNav';
import { countVertices } from '../utils/countVertices';
import {
  getCountries, createCountry, listBoundaryTypes, createBoundaryType, createStandardBoundaryTypeSet,
  deleteBoundaryType, getRecentMapShapes, deleteMapShape, createBoundaryUpload, getMapShapeCodesByUploadId,
  insertMapShapesBatch, insertMapShape, finalizeBoundaryUpload
} from '../services/boundaries';
import { listPoliticalPartiesAllCountries, createPoliticalParty, deletePoliticalParty } from '../services/politicalParties';
import { Card, Button, Badge, Input, Select, Spinner, EmptyState } from '../components/ui';

const VERTEX_BUCKETS = [
  [0, 1_000], [1_000, 5_000], [5_000, 20_000],
  [20_000, 50_000], [50_000, 100_000], [100_000, 500_000],
  [500_000, Infinity],
];
const NORMAL_TIER_MAX_VERTICES = 5_000;
const BULK_BATCH_SIZE = 200;

// One place to restyle this page's five section headings at once.
function SectionTitle({ children }) {
  return <h2 className="text-2xl font-bold text-text-main mb-4">{children}</h2>;
}

export default function AdminPage() {
  const [redistrictBatch, setRedistrictBatch] = useState(null);
  const [uploadsPanelKey, setUploadsPanelKey] = useState(0);
  const [uploadsPanelCountry, setUploadsPanelCountry] = useState('');
  // RedistrictingPanel fetches its own country list once on mount — bump
  // this to force it to remount and refetch whenever a country is added,
  // so a newly-registered country shows up there without a full page reload.
  const [redistrictingPanelKey, setRedistrictingPanelKey] = useState(0);
  const [file, setFile] = useState(null);
  const [uploadName, setUploadName] = useState('');
  const [country, setCountry] = useState('');
  const [boundaryType, setBoundaryType] = useState('');
  const [nameField, setNameField] = useState('');
  const [codeField, setCodeField] = useState('');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);

  // Analyze-then-upload flow: parsing/vertex analysis happens first and is
  // reviewed before anything touches the database.
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzedFeatures, setAnalyzedFeatures] = useState(null);
  const [vertexCutoff, setVertexCutoff] = useState(100_000);
  const [uploading, setUploading] = useState(false);
  const [resumeUploadId, setResumeUploadId] = useState(null);

  const [boundaries, setBoundaries] = useState([]);
  const [loadingBoundaries, setLoadingBoundaries] = useState(true);

  // Boundary type configuration (which types a country is allowed to have, and their rank)
  const [boundaryTypes, setBoundaryTypes] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [newTypeCountry, setNewTypeCountry] = useState('');
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeRank, setNewTypeRank] = useState('');
  const [typeStatus, setTypeStatus] = useState('');

  // Canonical country list — admin-managed, replaces free-text country entry.
  const [countryRows, setCountryRows] = useState([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [newCountryName, setNewCountryName] = useState('');
  const [newCountryCode, setNewCountryCode] = useState('');
  const [newCountryFlag, setNewCountryFlag] = useState('');
  const [countryStatus, setCountryStatus] = useState('');

  // Political parties per country — admin-managed, feeds the politician
  // profile form's party dropdown.
  const [partyRows, setPartyRows] = useState([]);
  const [loadingParties, setLoadingParties] = useState(true);
  const [newPartyCountry, setNewPartyCountry] = useState('');
  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyRank, setNewPartyRank] = useState('');
  const [partyStatus, setPartyStatus] = useState('');

  const fetchCountries = async () => {
    setLoadingCountries(true);
    const { data } = await getCountries();
    setCountryRows(data || []);
    setLoadingCountries(false);
  };

  const fetchBoundaryTypes = async () => {
    setLoadingTypes(true);
    const { data } = await listBoundaryTypes({ columns: 'id, country, type_name, rank' });
    setBoundaryTypes(data || []);
    setLoadingTypes(false);
  };

  const fetchParties = async () => {
    setLoadingParties(true);
    const { data } = await listPoliticalPartiesAllCountries();
    setPartyRows(data || []);
    setLoadingParties(false);
  };

  useEffect(() => {
    fetchCountries();
    fetchBoundaryTypes();
    fetchParties();
  }, []);

  const countries = useMemo(
    () => countryRows.map(c => c.name),
    [countryRows]
  );

  const typesForSelectedCountry = useMemo(
    () => boundaryTypes.filter(t => t.country === country),
    [boundaryTypes, country]
  );

  const typesForNewTypeCountry = useMemo(
    () => boundaryTypes.filter(t => t.country === newTypeCountry),
    [boundaryTypes, newTypeCountry]
  );

  const handleAddCountry = async () => {
    if (!newCountryName.trim()) {
      setCountryStatus('Error: Country name is required.');
      return;
    }
    const { error } = await createCountry({
      name: newCountryName.trim(),
      code: newCountryCode.trim() ? newCountryCode.trim().toUpperCase() : null,
      flagEmoji: newCountryFlag.trim() || null,
    });
    if (error) {
      setCountryStatus('Error: ' + error.message);
      return;
    }
    setCountryStatus('');
    setNewCountryName('');
    setNewCountryCode('');
    setNewCountryFlag('');
    fetchCountries();
    setRedistrictingPanelKey(k => k + 1);
  };

  // One click seeds the three most common tiers so a newly-added country
  // isn't three separate manual form submissions before anything can be
  // uploaded for it. Admin can rename/delete afterward.
  const handleAddStandardSet = async () => {
    if (!newTypeCountry) return;
    setTypeStatus('');
    const { error } = await createStandardBoundaryTypeSet(newTypeCountry);
    if (error) {
      setTypeStatus('Error: ' + error.message);
      return;
    }
    fetchBoundaryTypes();
  };

  // Keep the upload form's boundary type valid whenever the country changes
  useEffect(() => {
    if (!typesForSelectedCountry.some(t => t.type_name === boundaryType)) {
      setBoundaryType(typesForSelectedCountry[0]?.type_name || '');
    }
  }, [country, typesForSelectedCountry]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddBoundaryType = async () => {
    if (!newTypeCountry.trim() || !newTypeName.trim() || !newTypeRank) {
      setTypeStatus('Error: Country, type name, and rank are all required.');
      return;
    }
    const { error } = await createBoundaryType({
      country: newTypeCountry.trim(),
      typeName: newTypeName.trim(),
      rank: parseInt(newTypeRank, 10)
    });
    if (error) {
      setTypeStatus('Error: ' + error.message);
      return;
    }
    setTypeStatus('');
    setNewTypeName('');
    setNewTypeRank('');
    fetchBoundaryTypes();
  };

  const handleDeleteBoundaryType = async (id) => {
    if (!window.confirm('Delete this boundary type? Any uploaded shapes still using it will block this.')) return;
    const { error } = await deleteBoundaryType(id);
    if (error) {
      alert('Could not delete: ' + error.message + '\nDelete or re-type the shapes using this type first.');
      return;
    }
    fetchBoundaryTypes();
  };

  const handleAddParty = async () => {
    if (!newPartyCountry.trim() || !newPartyName.trim()) {
      setPartyStatus('Error: Country and party name are required.');
      return;
    }
    const { error } = await createPoliticalParty({
      country: newPartyCountry.trim(),
      name: newPartyName.trim(),
      rank: newPartyRank ? parseInt(newPartyRank, 10) : 999
    });
    if (error) {
      setPartyStatus('Error: ' + error.message);
      return;
    }
    setPartyStatus('');
    setNewPartyName('');
    setNewPartyRank('');
    fetchParties();
  };

  const handleDeleteParty = async (id) => {
    if (!window.confirm('Delete this party? This will fail if any politician has already selected it.')) return;
    const { error } = await deletePoliticalParty(id);
    if (error) {
      alert('Could not delete: ' + error.message + '\nSome politicians have this party selected — have them switch first.');
      return;
    }
    fetchParties();
  };

  const fetchBoundaries = async () => {
    setLoadingBoundaries(true);
    const { data } = await getRecentMapShapes({ limit: 50 });
    if (data) {
      setBoundaries(data);
    }
    setLoadingBoundaries(false);
  };

  useEffect(() => {
    fetchBoundaries();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this boundary?")) {
      await deleteMapShape(id);
      fetchBoundaries();
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    setFile(selected);
    if (selected && !uploadName.trim()) setUploadName(selected.name);
    setStatus('');
    setProgress(0);
    setAnalyzedFeatures(null);
  };

  const handleResumeUpload = (uploadRow) => {
    setResumeUploadId(uploadRow.id);
    setCountry(uploadRow.country);
    setBoundaryType(uploadRow.boundary_type);
    setUploadName(uploadRow.name);
    setFile(null);
    setAnalyzedFeatures(null);
    setStatus(`Resuming "${uploadRow.name}" — select the same source file to continue where it left off.`);
    setProgress(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelResume = () => {
    setResumeUploadId(null);
    setStatus('');
  };

  // Step 1: parse the file and compute a per-feature vertex count, entirely
  // client-side — nothing is written to the database yet.
  const handleAnalyze = async () => {
    if (!file) {
      setStatus('Please select a file first.');
      return;
    }
    if (!country) {
      setStatus('Please select a Country first.');
      return;
    }
    if (!boundaryType) {
      setStatus('Please select a Boundary Type first (define one below if none exist for this country yet).');
      return;
    }

    setAnalyzing(true);
    setAnalyzedFeatures(null);
    setStatus('Processing file...');

    try {
      let geojson = null;

      if (file.name.toLowerCase().endsWith('.zip')) {
        setStatus('Parsing Shapefile ZIP (this may take a moment)...');
        const buffer = await file.arrayBuffer();
        geojson = await shp(buffer);
      } else {
        setStatus('Reading JSON/GeoJSON file...');
        const text = await file.text();
        geojson = JSON.parse(text);
      }

      const formatGeometry = (geometry) => {
        if (geometry.type === 'Polygon') {
          return { type: 'MultiPolygon', coordinates: [geometry.coordinates] };
        }
        return geometry;
      };

      const extractFeatureData = (f, defaultName) => {
        const props = f.properties || {};
        let bName = defaultName;
        if (nameField && props[nameField]) {
          bName = props[nameField];
        } else if (props.name || props.NAME || props.district) {
          bName = props.name || props.NAME || props.district;
        }

        let bCode = null;
        if (codeField && props[codeField]) {
          bCode = props[codeField];
        }

        const geom = formatGeometry(f.geometry || f);
        return {
          country, boundary_type: boundaryType,
          name: bName, code: bCode, properties: props, geom,
          vertices: countVertices(geom),
        };
      };

      let features = [];
      if (geojson.type === 'FeatureCollection' && Array.isArray(geojson.features)) {
        features = geojson.features.filter(f =>
          f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
        ).map(f => extractFeatureData(f, file.name));
      } else if (geojson.type === 'Feature' && geojson.geometry) {
        features = [extractFeatureData(geojson, file.name)];
      } else if (geojson.type === 'Polygon' || geojson.type === 'MultiPolygon') {
        features = [extractFeatureData({ properties: {}, geometry: geojson }, file.name)];
      } else {
        throw new Error('Invalid format: Could not find valid GeoJSON Features.');
      }

      if (features.length === 0) {
        throw new Error('No boundary Polygons found in the file.');
      }

      setAnalyzedFeatures(features);
      setStatus(`Parsed ${features.length} feature(s). Review the vertex distribution below, then upload.`);
    } catch (error) {
      console.error(error);
      setStatus('Error: ' + error.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const vertexHistogram = useMemo(() => {
    if (!analyzedFeatures) return null;
    const total = analyzedFeatures.length;
    const buckets = VERTEX_BUCKETS.map(([lo, hi]) => ({
      lo, hi,
      count: analyzedFeatures.filter(f => f.vertices > lo && f.vertices <= hi).length,
    }));
    const overCutoff = analyzedFeatures
      .filter(f => f.vertices > vertexCutoff)
      .sort((a, b) => b.vertices - a.vertices);
    const vertexValues = analyzedFeatures.map(f => f.vertices);
    return {
      total,
      buckets,
      overCutoff,
      min: Math.min(...vertexValues),
      max: Math.max(...vertexValues),
      mean: Math.round(vertexValues.reduce((s, v) => s + v, 0) / total),
    };
  }, [analyzedFeatures, vertexCutoff]);

  // Step 2: tiered insert — bulk-batched for simple shapes, one-at-a-time
  // for medium complexity, skipped entirely above the cutoff. Resumable:
  // when resumeUploadId is set, already-inserted shapes (matched by code)
  // are filtered out before any tier runs.
  const handleConfirmUpload = async () => {
    if (!analyzedFeatures) return;
    setUploading(true);
    setProgress(1);

    try {
      let uploadId = resumeUploadId;
      if (!uploadId) {
        const { data: uploadRow, error: uploadRowError } = await createBoundaryUpload({
          name: uploadName.trim() || file.name,
          country, boundaryType,
          expectedCount: analyzedFeatures.length,
        });
        if (uploadRowError) throw uploadRowError;
        uploadId = uploadRow.id;
      }

      let pending = analyzedFeatures;
      const hasCodes = pending.some(f => f.code);
      if (resumeUploadId && hasCodes) {
        setStatus('Checking what has already been uploaded...');
        const { data: existing, error: existingError } = await getMapShapeCodesByUploadId(uploadId);
        if (existingError) throw existingError;
        const doneCodes = new Set((existing || []).map(r => r.code));
        pending = pending.filter(f => !f.code || !doneCodes.has(f.code));
      }

      const normalTier = pending.filter(f => f.vertices <= NORMAL_TIER_MAX_VERTICES);
      const mediumTier = pending
        .filter(f => f.vertices > NORMAL_TIER_MAX_VERTICES && f.vertices <= vertexCutoff)
        .sort((a, b) => a.vertices - b.vertices);
      const skippedCount = pending.filter(f => f.vertices > vertexCutoff).length;

      const toShapePayload = (f) => ({
        country: f.country, boundary_type: f.boundary_type,
        name: f.name, code: f.code, properties: f.properties,
        geojson: f.geom, upload_id: uploadId,
      });

      let done = 0;
      const totalToInsert = normalTier.length + mediumTier.length;

      for (let i = 0; i < normalTier.length; i += BULK_BATCH_SIZE) {
        const chunk = normalTier.slice(i, i + BULK_BATCH_SIZE);
        setStatus(`Tier 1: normal-complexity shapes — batch ${Math.floor(i / BULK_BATCH_SIZE) + 1}/${Math.ceil(normalTier.length / BULK_BATCH_SIZE)}`);
        const { error } = await insertMapShapesBatch(chunk.map(toShapePayload));
        if (error) throw new Error(`Batch insert failed: ${error.message}. Safe to retry — rerun the upload for this same file, already-inserted shapes will be skipped.`);
        done += chunk.length;
        setProgress(Math.round((done / Math.max(totalToInsert, 1)) * 100));
      }

      for (let i = 0; i < mediumTier.length; i++) {
        const f = mediumTier[i];
        setStatus(`Tier 2: medium-complexity shapes — ${i + 1}/${mediumTier.length} (${f.name})`);
        const { error } = await insertMapShape({
          country: f.country, boundaryType: f.boundary_type,
          name: f.name, code: f.code, properties: f.properties,
          geojson: f.geom, uploadId,
        });
        if (error) throw new Error(`Shape "${f.name}" failed: ${error.message}. Safe to retry — rerun the upload for this same file, already-inserted shapes will be skipped.`);
        done += 1;
        setProgress(Math.round((done / Math.max(totalToInsert, 1)) * 100));
      }

      await finalizeBoundaryUpload(uploadId, new Date().toISOString());

      setStatus(`Done. ${totalToInsert} shape(s) uploaded, ${skippedCount} skipped (over ${vertexCutoff.toLocaleString()} vertices).`);
      setProgress(100);
      setFile(null);
      setUploadName('');
      setAnalyzedFeatures(null);
      setResumeUploadId(null);
      fetchBoundaries();
      setUploadsPanelKey(k => k + 1);
    } catch (error) {
      console.error(error);
      setStatus('Error: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full max-w-none flex flex-col gap-8 animate-fade-in p-4 lg:p-0 px-4 lg:px-8">

      <AdminSubNav active="boundaries" />

      {/* COUNTRIES */}
      <Card padding="lg">
        <SectionTitle>Countries</SectionTitle>
        <p className="text-sm text-text-muted mb-6">
          Register a country before defining boundary types or uploading shapes for it. This is the canonical list every
          other country selector on this page draws from.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px_100px_auto] gap-3 mb-6 items-end">
          <div>
            <label className="block mb-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">Name</label>
            <Input
              type="text"
              placeholder="e.g. USA"
              value={newCountryName}
              onChange={(e) => setNewCountryName(e.target.value)}
            />
          </div>
          <div>
            <label className="block mb-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">ISO Code</label>
            <Input
              type="text"
              placeholder="e.g. US"
              maxLength={2}
              className="uppercase"
              value={newCountryCode}
              onChange={(e) => setNewCountryCode(e.target.value)}
            />
          </div>
          <div>
            <label className="block mb-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">Flag</label>
            <Input
              type="text"
              placeholder="🇺🇸"
              value={newCountryFlag}
              onChange={(e) => setNewCountryFlag(e.target.value)}
            />
          </div>
          <Button onClick={handleAddCountry}>
            <Plus size={16} /> Add
          </Button>
        </div>

        {countryStatus && <p className="text-danger text-xs font-medium mb-4">{countryStatus}</p>}

        {loadingCountries ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : countryRows.length === 0 ? (
          <EmptyState description="No countries registered yet." />
        ) : (
          <div className="flex flex-wrap gap-2">
            {countryRows.map(c => (
              <span key={c.name} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface/40 border border-border-light/30 rounded-lg text-xs">
                {c.flag_emoji && <span>{c.flag_emoji}</span>}
                <span className="font-semibold text-text-secondary">{c.name}</span>
                {c.code && <span className="text-text-muted">{c.code}</span>}
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* BOUNDARY TYPES CONFIGURATION */}
      <Card padding="lg">
        <SectionTitle>Boundary Types</SectionTitle>
        <p className="text-sm text-text-muted mb-6">
          Define which boundary types exist for each country (e.g. Canada → Federal, Provincial, Municipal) and their rank
          (1 = broadest, higher = more local). Shapes can only be uploaded under a type registered here.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_100px_auto] gap-3 mb-6 items-end">
          <div>
            <label className="block mb-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">Country</label>
            <Select value={newTypeCountry} onChange={(e) => setNewTypeCountry(e.target.value)}>
              <option value="" disabled>Select country...</option>
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
            {countries.length === 0 && (
              <p className="text-xs text-warning mt-1.5">No countries registered yet — add one above first.</p>
            )}
          </div>
          <div>
            <label className="block mb-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">Type Name</label>
            <Input
              type="text"
              placeholder="e.g. Federal"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
            />
          </div>
          <div>
            <label className="block mb-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">Rank</label>
            <Input
              type="number"
              min="1"
              placeholder="1"
              value={newTypeRank}
              onChange={(e) => setNewTypeRank(e.target.value)}
            />
          </div>
          <Button onClick={handleAddBoundaryType}>
            <Plus size={16} /> Add
          </Button>
        </div>

        {newTypeCountry && typesForNewTypeCountry.length === 0 && (
          <Button variant="outline" size="sm" onClick={handleAddStandardSet} className="mb-4">
            Add standard set (National / State-Province / Municipal) for {newTypeCountry}
          </Button>
        )}

        {typeStatus && <p className="text-danger text-xs font-medium mb-4">{typeStatus}</p>}

        {loadingTypes ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : boundaryTypes.length === 0 ? (
          <EmptyState description="No boundary types configured yet." />
        ) : (
          <div className="space-y-4">
            {countries.map(c => (
              <div key={c}>
                <h4 className="text-xs font-bold text-accent-hover uppercase tracking-wider mb-2">{c}</h4>
                <div className="flex flex-wrap gap-2">
                  {boundaryTypes.filter(t => t.country === c).map(t => (
                    <span key={t.id} className="flex items-center gap-2 px-3 py-1.5 bg-surface/40 border border-border-light/30 rounded-lg text-xs">
                      <span className="font-semibold text-text-secondary">{t.type_name}</span>
                      <span className="text-text-muted">rank {t.rank}</span>
                      <button onClick={() => handleDeleteBoundaryType(t.id)} className="text-text-muted hover:text-danger transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* POLITICAL PARTIES */}
      <Card padding="lg">
        <SectionTitle>Political Parties</SectionTitle>
        <p className="text-sm text-text-muted mb-6">
          Define the party list a politician can pick from when editing their profile, per country. Independent should
          usually be included as its own entry.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_100px_auto] gap-3 mb-6 items-end">
          <div>
            <label className="block mb-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">Country</label>
            <Select value={newPartyCountry} onChange={(e) => setNewPartyCountry(e.target.value)}>
              <option value="" disabled>Select country...</option>
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
            {countries.length === 0 && (
              <p className="text-xs text-warning mt-1.5">No countries registered yet — add one above first.</p>
            )}
          </div>
          <div>
            <label className="block mb-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">Party Name</label>
            <Input
              type="text"
              placeholder="e.g. Green Party"
              value={newPartyName}
              onChange={(e) => setNewPartyName(e.target.value)}
            />
          </div>
          <div>
            <label className="block mb-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">Rank</label>
            <Input
              type="number"
              min="1"
              placeholder="999"
              value={newPartyRank}
              onChange={(e) => setNewPartyRank(e.target.value)}
            />
          </div>
          <Button onClick={handleAddParty}>
            <Plus size={16} /> Add
          </Button>
        </div>

        {partyStatus && <p className="text-danger text-xs font-medium mb-4">{partyStatus}</p>}

        {loadingParties ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : partyRows.length === 0 ? (
          <EmptyState description="No parties configured yet." />
        ) : (
          <div className="space-y-4">
            {countries.map(c => (
              <div key={c}>
                <h4 className="text-xs font-bold text-accent-hover uppercase tracking-wider mb-2">{c}</h4>
                <div className="flex flex-wrap gap-2">
                  {partyRows.filter(p => p.country === c).map(p => (
                    <span key={p.id} className="flex items-center gap-2 px-3 py-1.5 bg-surface/40 border border-border-light/30 rounded-lg text-xs">
                      <span className="font-semibold text-text-secondary">{p.name}</span>
                      <button onClick={() => handleDeleteParty(p.id)} className="text-text-muted hover:text-danger transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

      {/* LEFT SIDE: UPLOAD FORM */}
      <Card padding="lg" className="self-start">
        <SectionTitle>Upload Boundaries</SectionTitle>
        <p className="text-sm text-text-muted mb-6">
          Upload electoral boundaries (.geojson or .zip containing shapefiles).
        </p>

        {resumeUploadId && (
          <div className="mb-6 p-4 bg-primary/10 border border-primary/30 rounded-xl flex items-center justify-between gap-3">
            <p className="text-xs text-primary-light">
              Resuming <strong>{uploadName}</strong> — re-select the same source file below, already-uploaded shapes will be skipped automatically.
            </p>
            <Button variant="ghost" size="sm" onClick={cancelResume} className="shrink-0">Cancel</Button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">Country</label>
            <Select value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="" disabled>Select country...</option>
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <div>
            <label className="block mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">Boundary Type</label>
            <Select
              value={boundaryType}
              onChange={(e) => setBoundaryType(e.target.value)}
              disabled={!country || typesForSelectedCountry.length === 0}
            >
              <option value="" disabled>{country ? 'Select type...' : 'Select a country first'}</option>
              {typesForSelectedCountry.map(t => <option key={t.id} value={t.type_name}>{t.type_name} (rank {t.rank})</option>)}
            </Select>
            {country && typesForSelectedCountry.length === 0 && (
              <p className="text-xs text-warning mt-1.5">No types defined for {country} yet — add one above.</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">Name Attribute</label>
            <Input
              type="text"
              placeholder="e.g. ED_NAMEE"
              value={nameField}
              onChange={(e) => setNameField(e.target.value)}
            />
          </div>
          <div>
            <label className="block mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">Code Attribute</label>
            <Input
              type="text"
              placeholder="e.g. FED_NUM"
              value={codeField}
              onChange={(e) => setCodeField(e.target.value)}
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">Select File</label>
          <input
            className="block w-full text-xs text-text-muted border border-border-light rounded-xl cursor-pointer bg-surface/40 focus:outline-none file:mr-4 file:py-3 file:px-4 file:rounded-l-xl file:border-0 file:text-xs file:font-bold file:bg-primary file:text-text-on-primary hover:file:bg-primary-hover transition-colors"
            type="file"
            accept=".zip,.geojson,.json"
            onChange={handleFileChange}
          />
        </div>

        <div className="mb-6">
          <label className="block mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">Upload Name</label>
          <Input
            type="text"
            placeholder="e.g. Ontario Municipalities 2025"
            value={uploadName}
            onChange={(e) => setUploadName(e.target.value)}
          />
          <p className="text-[11px] text-text-muted mt-1.5">Lets you manage or remove this whole batch later — defaults to the filename.</p>
        </div>

        {!analyzedFeatures ? (
          <Button onClick={handleAnalyze} disabled={analyzing} className="w-full">
            {analyzing ? 'Analyzing...' : 'Analyze File'}
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-surface/40 rounded-xl border border-border-light/30">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Vertex Distribution</h4>
                <Button variant="ghost" size="sm" onClick={() => setAnalyzedFeatures(null)}>Re-analyze</Button>
              </div>
              <div className="space-y-1 mb-3">
                {vertexHistogram.buckets.map(({ lo, hi, count }) => (
                  <div key={lo} className="flex items-center justify-between text-xs">
                    <span className="text-text-muted">{lo.toLocaleString()}{hi === Infinity ? '+' : `–${hi.toLocaleString()}`}</span>
                    <span className="text-text-secondary font-mono">{count}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-text-muted mb-3">
                {vertexHistogram.total} features · min {vertexHistogram.min.toLocaleString()} · max {vertexHistogram.max.toLocaleString()} · mean {vertexHistogram.mean.toLocaleString()} vertices
              </p>

              <label className="block mb-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">Vertex Cutoff</label>
              <input
                type="number"
                className="block w-full p-2.5 bg-surface-hover border border-border-light text-sm text-text-main rounded-lg focus:outline-none focus:border-primary mb-2"
                value={vertexCutoff}
                onChange={(e) => setVertexCutoff(parseInt(e.target.value, 10) || 0)}
              />
              {vertexHistogram.overCutoff.length > 0 ? (
                <div>
                  <p className="text-xs text-warning mb-1.5">{vertexHistogram.overCutoff.length} shape(s) will be skipped:</p>
                  <div className="max-h-28 overflow-y-auto space-y-0.5">
                    {vertexHistogram.overCutoff.slice(0, 20).map((f, i) => (
                      <p key={i} className="text-[11px] text-text-muted truncate">{f.vertices.toLocaleString()} — {f.name}</p>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-success">No shapes exceed the cutoff — everything will be uploaded.</p>
              )}
            </div>

            <Button onClick={handleConfirmUpload} disabled={uploading} className="w-full">
              {uploading ? 'Uploading...' : `Upload ${vertexHistogram.total - vertexHistogram.overCutoff.length} Shape(s)`}
            </Button>
          </div>
        )}

        {status && (
          <div className="mt-4 p-4 bg-surface/80 border border-border-light rounded-xl text-sm font-medium animate-fade-in flex flex-col gap-2">
            <span className={status.startsWith('Error') ? 'text-danger' : 'text-primary'}>{status}</span>
            {uploading && (
              <div className="w-full bg-surface-active rounded-full h-2 mt-1">
                <div className="bg-primary h-2 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(233,235,158,0.4)]" style={{ width: `${progress}%` }}></div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* RIGHT SIDE: BOUNDARY LIST */}
      <Card padding="lg" className="flex flex-col h-[70vh] max-h-[650px] min-h-[320px]">
        <SectionTitle>Uploaded Boundaries</SectionTitle>
        <p className="text-sm text-text-muted mb-6">
          Recent boundaries successfully uploaded to the system.
        </p>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
          {loadingBoundaries ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : boundaries.length === 0 ? (
            <EmptyState description="No boundaries found." />
          ) : (
            boundaries.map((b) => (
              <div key={b.id} className="p-4 bg-surface/40 rounded-xl border border-border-light/30 flex items-center justify-between group hover:border-primary/25 transition-colors">
                <div>
                  <h4 className="font-bold text-text-secondary">{b.name}</h4>
                  <div className="text-xs text-text-muted mt-1 flex gap-2">
                    <Badge tone="accent" size="sm" uppercase={false}>{b.country}</Badge>
                    <Badge tone="primary" size="sm" uppercase={false}>{b.boundary_type}</Badge>
                    {b.retired_at ? (
                      <Badge tone="neutral" size="sm" uppercase={false}>Retired</Badge>
                    ) : (
                      <Badge tone="emerald" size="sm" uppercase={false}>Active</Badge>
                    )}
                  </div>
                </div>
                <Button
                  variant="icon"
                  tone="danger"
                  onClick={() => handleDelete(b.id)}
                  className="opacity-0 group-hover:opacity-100"
                  title="Delete Boundary"
                >
                  <Trash2 size={18} />
                </Button>
              </div>
            ))
          )}
        </div>
      </Card>

      </div>

      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">Filter Upload Batches</h3>
          <Select
            value={uploadsPanelCountry}
            onChange={(e) => setUploadsPanelCountry(e.target.value)}
            size="sm"
            className="w-auto"
          >
            <option value="">All countries</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
        <BoundaryUploadsPanel
          key={uploadsPanelKey}
          countryFilter={uploadsPanelCountry || undefined}
          onRedistrictBatch={setRedistrictBatch}
          onResumeUpload={handleResumeUpload}
        />
      </div>

      <RedistrictingPanel
        key={redistrictingPanelKey}
        preselectedBatch={redistrictBatch}
        onRetired={() => {
          fetchBoundaries();
          setUploadsPanelKey(k => k + 1);
        }}
      />
    </div>
  );
}
