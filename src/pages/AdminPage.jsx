import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
import shp from 'shpjs';
import { Trash2, Plus } from 'lucide-react';
import BoundaryUploadsPanel from './Admin/BoundaryUploadsPanel';
import RedistrictingPanel from './Admin/RedistrictingPanel';
import { countVertices } from '../utils/countVertices';

const VERTEX_BUCKETS = [
  [0, 1_000], [1_000, 5_000], [5_000, 20_000],
  [20_000, 50_000], [50_000, 100_000], [100_000, 500_000],
  [500_000, Infinity],
];
const NORMAL_TIER_MAX_VERTICES = 5_000;
const BULK_BATCH_SIZE = 200;

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

  const fetchCountries = async () => {
    setLoadingCountries(true);
    const { data } = await supabase
      .from('countries')
      .select('name, code, flag_emoji')
      .order('name', { ascending: true });
    setCountryRows(data || []);
    setLoadingCountries(false);
  };

  const fetchBoundaryTypes = async () => {
    setLoadingTypes(true);
    const { data } = await supabase
      .from('country_boundary_types')
      .select('id, country, type_name, rank')
      .order('country', { ascending: true })
      .order('rank', { ascending: true });
    setBoundaryTypes(data || []);
    setLoadingTypes(false);
  };

  useEffect(() => {
    fetchCountries();
    fetchBoundaryTypes();
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
    const { error } = await supabase.from('countries').insert({
      name: newCountryName.trim(),
      code: newCountryCode.trim() ? newCountryCode.trim().toUpperCase() : null,
      flag_emoji: newCountryFlag.trim() || null,
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
    const { error } = await supabase.from('country_boundary_types').insert([
      { country: newTypeCountry, type_name: 'National', rank: 1 },
      { country: newTypeCountry, type_name: 'State-Province', rank: 2 },
      { country: newTypeCountry, type_name: 'Municipal', rank: 3 },
    ]);
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
    const { error } = await supabase.from('country_boundary_types').insert({
      country: newTypeCountry.trim(),
      type_name: newTypeName.trim(),
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
    const { error } = await supabase.from('country_boundary_types').delete().eq('id', id);
    if (error) {
      alert('Could not delete: ' + error.message + '\nDelete or re-type the shapes using this type first.');
      return;
    }
    fetchBoundaryTypes();
  };

  const fetchBoundaries = async () => {
    setLoadingBoundaries(true);
    // Fetch distinct boundary groups if possible, or just the latest 100 boundaries
    const { data, error } = await supabase
      .from('map_shapes')
      .select('id, name, country, boundary_type, retired_at')
      .order('created_at', { ascending: false })
      .limit(50);
      
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
      await supabase.from('map_shapes').delete().eq('id', id);
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
        const { data: uploadRow, error: uploadRowError } = await supabase
          .from('boundary_uploads')
          .insert({
            name: uploadName.trim() || file.name,
            country, boundary_type: boundaryType,
            expected_count: analyzedFeatures.length,
          })
          .select()
          .single();
        if (uploadRowError) throw uploadRowError;
        uploadId = uploadRow.id;
      }

      let pending = analyzedFeatures;
      const hasCodes = pending.some(f => f.code);
      if (resumeUploadId && hasCodes) {
        setStatus('Checking what has already been uploaded...');
        const { data: existing, error: existingError } = await supabase
          .from('map_shapes')
          .select('code')
          .eq('upload_id', uploadId);
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
        const { error } = await supabase.rpc('insert_map_shapes_batch', {
          p_shapes: chunk.map(toShapePayload),
        });
        if (error) throw new Error(`Batch insert failed: ${error.message}. Safe to retry — rerun the upload for this same file, already-inserted shapes will be skipped.`);
        done += chunk.length;
        setProgress(Math.round((done / Math.max(totalToInsert, 1)) * 100));
      }

      for (let i = 0; i < mediumTier.length; i++) {
        const f = mediumTier[i];
        setStatus(`Tier 2: medium-complexity shapes — ${i + 1}/${mediumTier.length} (${f.name})`);
        const { error } = await supabase.rpc('insert_map_shape', {
          p_country: f.country, p_boundary_type: f.boundary_type,
          p_name: f.name, p_code: f.code, p_properties: f.properties,
          p_geojson: f.geom, p_upload_id: uploadId,
        });
        if (error) throw new Error(`Shape "${f.name}" failed: ${error.message}. Safe to retry — rerun the upload for this same file, already-inserted shapes will be skipped.`);
        done += 1;
        setProgress(Math.round((done / Math.max(totalToInsert, 1)) * 100));
      }

      await supabase.from('boundary_uploads').update({ completed_at: new Date().toISOString() }).eq('id', uploadId);

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

      {/* Admin sub-nav */}
      <div className="flex gap-2">
        <span className="px-4 py-2 rounded-xl text-sm font-semibold text-primary bg-primary/10 border border-primary/30">Boundaries</span>
        <Link to="/admin/elections" className="px-4 py-2 rounded-xl text-sm font-semibold text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors">Elections</Link>
      </div>

      {/* COUNTRIES */}
      <div className="p-8 bg-surface/30 backdrop-blur-md rounded-2xl border border-border-light/45 shadow-xl">
        <h2 className="text-2xl font-bold text-text-main mb-4">Countries</h2>
        <p className="text-sm text-text-muted mb-6">
          Register a country before defining boundary types or uploading shapes for it. This is the canonical list every
          other country selector on this page draws from.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px_100px_auto] gap-3 mb-6 items-end">
          <div>
            <label className="block mb-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">Name</label>
            <input
              type="text"
              placeholder="e.g. USA"
              className="block w-full p-2.5 bg-surface/40 border border-border-light text-sm text-text-main rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
              value={newCountryName}
              onChange={(e) => setNewCountryName(e.target.value)}
            />
          </div>
          <div>
            <label className="block mb-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">ISO Code</label>
            <input
              type="text"
              placeholder="e.g. US"
              maxLength={2}
              className="block w-full p-2.5 bg-surface/40 border border-border-light text-sm text-text-main rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all uppercase"
              value={newCountryCode}
              onChange={(e) => setNewCountryCode(e.target.value)}
            />
          </div>
          <div>
            <label className="block mb-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">Flag</label>
            <input
              type="text"
              placeholder="🇺🇸"
              className="block w-full p-2.5 bg-surface/40 border border-border-light text-sm text-text-main rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
              value={newCountryFlag}
              onChange={(e) => setNewCountryFlag(e.target.value)}
            />
          </div>
          <button
            onClick={handleAddCountry}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary-hover text-slate-950 font-bold rounded-xl transition-all text-sm shadow-md"
          >
            <Plus size={16} /> Add
          </button>
        </div>

        {countryStatus && <p className="text-danger text-xs font-medium mb-4">{countryStatus}</p>}

        {loadingCountries ? (
          <div className="text-center text-text-muted py-6">Loading...</div>
        ) : countryRows.length === 0 ? (
          <div className="text-center text-text-muted py-6 bg-surface/20 rounded-2xl border border-dashed border-border-light/60">
            No countries registered yet.
          </div>
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
      </div>

      {/* BOUNDARY TYPES CONFIGURATION */}
      <div className="p-8 bg-surface/30 backdrop-blur-md rounded-2xl border border-border-light/45 shadow-xl">
        <h2 className="text-2xl font-bold text-text-main mb-4">Boundary Types</h2>
        <p className="text-sm text-text-muted mb-6">
          Define which boundary types exist for each country (e.g. Canada → Federal, Provincial, Municipal) and their rank
          (1 = broadest, higher = more local). Shapes can only be uploaded under a type registered here.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_100px_auto] gap-3 mb-6 items-end">
          <div>
            <label className="block mb-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">Country</label>
            <select
              className="block w-full p-2.5 bg-surface/40 border border-border-light text-sm text-text-main rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
              value={newTypeCountry}
              onChange={(e) => setNewTypeCountry(e.target.value)}
            >
              <option value="" disabled>Select country...</option>
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {countries.length === 0 && (
              <p className="text-xs text-amber-400 mt-1.5">No countries registered yet — add one above first.</p>
            )}
          </div>
          <div>
            <label className="block mb-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">Type Name</label>
            <input
              type="text"
              placeholder="e.g. Federal"
              className="block w-full p-2.5 bg-surface/40 border border-border-light text-sm text-text-main rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
            />
          </div>
          <div>
            <label className="block mb-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">Rank</label>
            <input
              type="number"
              min="1"
              placeholder="1"
              className="block w-full p-2.5 bg-surface/40 border border-border-light text-sm text-text-main rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
              value={newTypeRank}
              onChange={(e) => setNewTypeRank(e.target.value)}
            />
          </div>
          <button
            onClick={handleAddBoundaryType}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary-hover text-slate-950 font-bold rounded-xl transition-all text-sm shadow-md"
          >
            <Plus size={16} /> Add
          </button>
        </div>

        {newTypeCountry && typesForNewTypeCountry.length === 0 && (
          <button
            onClick={handleAddStandardSet}
            className="mb-4 px-3 py-2 text-xs font-semibold text-primary-light bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg transition-colors"
          >
            Add standard set (National / State-Province / Municipal) for {newTypeCountry}
          </button>
        )}

        {typeStatus && <p className="text-danger text-xs font-medium mb-4">{typeStatus}</p>}

        {loadingTypes ? (
          <div className="text-center text-text-muted py-6">Loading...</div>
        ) : boundaryTypes.length === 0 ? (
          <div className="text-center text-text-muted py-6 bg-surface/20 rounded-2xl border border-dashed border-border-light/60">
            No boundary types configured yet.
          </div>
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

      {/* LEFT SIDE: UPLOAD FORM */}
      <div className="p-8 bg-surface/30 backdrop-blur-md rounded-2xl border border-border-light/45 shadow-xl self-start">
        <h2 className="text-2xl font-bold text-text-main mb-4">Upload Boundaries</h2>
        <p className="text-sm text-text-muted mb-6">
          Upload electoral boundaries (.geojson or .zip containing shapefiles).
        </p>

        {resumeUploadId && (
          <div className="mb-6 p-4 bg-primary/10 border border-primary/30 rounded-xl flex items-center justify-between gap-3">
            <p className="text-xs text-primary-light">
              Resuming <strong>{uploadName}</strong> — re-select the same source file below, already-uploaded shapes will be skipped automatically.
            </p>
            <button onClick={cancelResume} className="text-xs text-text-muted hover:text-text-main shrink-0">Cancel</button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">Country</label>
            <select
              className="block w-full p-3 bg-surface/40 border border-border-light text-sm text-text-main rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              <option value="" disabled>Select country...</option>
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">Boundary Type</label>
            <select
              className="block w-full p-3 bg-surface/40 border border-border-light text-sm text-text-main rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all disabled:opacity-50"
              value={boundaryType}
              onChange={(e) => setBoundaryType(e.target.value)}
              disabled={!country || typesForSelectedCountry.length === 0}
            >
              <option value="" disabled>{country ? 'Select type...' : 'Select a country first'}</option>
              {typesForSelectedCountry.map(t => <option key={t.id} value={t.type_name}>{t.type_name} (rank {t.rank})</option>)}
            </select>
            {country && typesForSelectedCountry.length === 0 && (
              <p className="text-xs text-amber-400 mt-1.5">No types defined for {country} yet — add one above.</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">Name Attribute</label>
            <input
              type="text"
              placeholder="e.g. ED_NAMEE"
              className="block w-full p-3 bg-surface/40 border border-border-light text-sm text-text-main rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
              value={nameField}
              onChange={(e) => setNameField(e.target.value)}
            />
          </div>
          <div>
            <label className="block mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">Code Attribute</label>
            <input
              type="text"
              placeholder="e.g. FED_NUM"
              className="block w-full p-3 bg-surface/40 border border-border-light text-sm text-text-main rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
              value={codeField}
              onChange={(e) => setCodeField(e.target.value)}
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">Select File</label>
          <input
            className="block w-full text-xs text-text-muted border border-border-light rounded-xl cursor-pointer bg-surface/40 focus:outline-none file:mr-4 file:py-3 file:px-4 file:rounded-l-xl file:border-0 file:text-xs file:font-bold file:bg-primary file:text-slate-950 hover:file:bg-primary-hover transition-colors"
            type="file"
            accept=".zip,.geojson,.json"
            onChange={handleFileChange}
          />
        </div>

        <div className="mb-6">
          <label className="block mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">Upload Name</label>
          <input
            type="text"
            placeholder="e.g. Ontario Municipalities 2025"
            className="block w-full p-3 bg-surface/40 border border-border-light text-sm text-text-main rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
            value={uploadName}
            onChange={(e) => setUploadName(e.target.value)}
          />
          <p className="text-[11px] text-text-muted mt-1.5">Lets you manage or remove this whole batch later — defaults to the filename.</p>
        </div>

        {!analyzedFeatures ? (
          <div>
            <button
              className="px-6 py-3 bg-primary hover:bg-primary-hover text-slate-950 font-bold rounded-xl transition-all duration-200 focus:ring-4 focus:ring-primary/10 disabled:opacity-50 w-full shadow-[0_4px_14px_rgba(233,235,158,0.15)]"
              onClick={handleAnalyze}
              disabled={analyzing}
            >
              {analyzing ? 'Analyzing...' : 'Analyze File'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-surface/40 rounded-xl border border-border-light/30">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Vertex Distribution</h4>
                <button onClick={() => setAnalyzedFeatures(null)} className="text-xs text-text-muted hover:text-text-main">Re-analyze</button>
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
                  <p className="text-xs text-amber-400 mb-1.5">{vertexHistogram.overCutoff.length} shape(s) will be skipped:</p>
                  <div className="max-h-28 overflow-y-auto space-y-0.5">
                    {vertexHistogram.overCutoff.slice(0, 20).map((f, i) => (
                      <p key={i} className="text-[11px] text-text-muted truncate">{f.vertices.toLocaleString()} — {f.name}</p>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-emerald-400">No shapes exceed the cutoff — everything will be uploaded.</p>
              )}
            </div>

            <button
              className="px-6 py-3 bg-primary hover:bg-primary-hover text-slate-950 font-bold rounded-xl transition-all duration-200 focus:ring-4 focus:ring-primary/10 disabled:opacity-50 w-full shadow-[0_4px_14px_rgba(233,235,158,0.15)]"
              onClick={handleConfirmUpload}
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : `Upload ${vertexHistogram.total - vertexHistogram.overCutoff.length} Shape(s)`}
            </button>
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
      </div>

      {/* RIGHT SIDE: BOUNDARY LIST */}
      <div className="p-8 bg-surface/30 backdrop-blur-md rounded-2xl border border-border-light/45 shadow-xl flex flex-col h-[650px]">
        <h2 className="text-2xl font-bold text-text-main mb-4">Uploaded Boundaries</h2>
        <p className="text-sm text-text-muted mb-6">
          Recent boundaries successfully uploaded to the system.
        </p>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
          {loadingBoundaries ? (
            <div className="text-center text-text-muted py-10">Loading...</div>
          ) : boundaries.length === 0 ? (
            <div className="text-center text-text-muted py-10 bg-surface/20 rounded-2xl border border-dashed border-border-light/60">
              No boundaries found.
            </div>
          ) : (
            boundaries.map((b) => (
              <div key={b.id} className="p-4 bg-surface/40 rounded-xl border border-border-light/30 flex items-center justify-between group hover:border-primary/25 transition-colors">
                <div>
                  <h4 className="font-bold text-text-secondary">{b.name}</h4>
                  <div className="text-xs text-text-muted mt-1 flex gap-2">
                    <span className="bg-accent/20 text-accent-hover px-2 py-0.5 rounded font-medium">{b.country}</span>
                    <span className="bg-primary/20 text-primary-light px-2 py-0.5 rounded font-medium">{b.boundary_type}</span>
                    {b.retired_at ? (
                      <span className="bg-slate-500/20 text-slate-300 px-2 py-0.5 rounded font-medium">Retired</span>
                    ) : (
                      <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-medium">Active</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(b.id)}
                  className="p-2 text-text-muted hover:text-danger hover:bg-danger/10 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
                  title="Delete Boundary"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      </div>

      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">Filter Upload Batches</h3>
          <select
            value={uploadsPanelCountry}
            onChange={(e) => setUploadsPanelCountry(e.target.value)}
            className="p-2 bg-surface/40 border border-border-light text-xs text-text-main rounded-lg focus:outline-none focus:border-primary"
          >
            <option value="">All countries</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
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
