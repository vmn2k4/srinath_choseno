import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import shp from 'shpjs';
import { Trash2 } from 'lucide-react';

export default function AdminPage() {
  const [file, setFile] = useState(null);
  const [country, setCountry] = useState('');
  const [boundaryType, setBoundaryType] = useState('Federal');
  const [nameField, setNameField] = useState('');
  const [codeField, setCodeField] = useState('');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);

  const [boundaries, setBoundaries] = useState([]);
  const [loadingBoundaries, setLoadingBoundaries] = useState(true);

  const fetchBoundaries = async () => {
    setLoadingBoundaries(true);
    // Fetch distinct boundary groups if possible, or just the latest 100 boundaries
    const { data, error } = await supabase
      .from('map_shapes')
      .select('id, name, country, boundary_type')
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
    setFile(e.target.files[0]);
    setStatus('');
    setProgress(0);
  };

  const handleUpload = async () => {
    if (!file) {
      setStatus('Please select a file first.');
      return;
    }
    if (!country) {
      setStatus('Please enter the Country Name first.');
      return;
    }

    setStatus('Processing file...');
    setProgress(10);

    try {
      let geojson = null;

      if (file.name.toLowerCase().endsWith('.zip')) {
        setStatus('Parsing Shapefile ZIP (this may take a moment)...');
        const buffer = await file.arrayBuffer();
        setProgress(30);
        geojson = await shp(buffer);
      } else {
        setStatus('Reading JSON/GeoJSON file...');
        const text = await file.text();
        setProgress(30);
        setStatus('Parsing JSON...');
        geojson = JSON.parse(text);
      }

      setProgress(40);

      const formatGeometry = (geometry) => {
        if (geometry.type === 'Polygon') {
          return {
            type: 'MultiPolygon',
            coordinates: [geometry.coordinates]
          };
        }
        return geometry;
      };

      let featuresToInsert = [];
      
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
        
        return {
          country: country,
          boundary_type: boundaryType,
          name: bName,
          code: bCode,
          properties: props,
          geom: formatGeometry(f.geometry || f)
        };
      };

      if (geojson.type === 'FeatureCollection' && Array.isArray(geojson.features)) {
        featuresToInsert = geojson.features.filter(f =>
          f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
        ).map(f => extractFeatureData(f, file.name));
      } else if (geojson.type === 'Feature' && geojson.geometry) {
        featuresToInsert = [extractFeatureData(geojson, file.name)];
      } else if (geojson.type === 'Polygon' || geojson.type === 'MultiPolygon') {
        featuresToInsert = [extractFeatureData({ properties: {}, geometry: geojson }, file.name)];
      } else {
        throw new Error("Invalid format: Could not find valid GeoJSON Features.");
      }

      if (featuresToInsert.length === 0) {
        throw new Error("No boundary Polygons found in the file.");
      }

      setStatus(`Found ${featuresToInsert.length} features. Uploading to database...`);

      const chunkSize = 5;
      for (let i = 0; i < featuresToInsert.length; i += chunkSize) {
        const chunk = featuresToInsert.slice(i, i + chunkSize);

        for (const item of chunk) {
          const { error } = await supabase.rpc('insert_map_shape', {
            p_country: item.country,
            p_boundary_type: item.boundary_type,
            p_name: item.name,
            p_code: item.code,
            p_properties: item.properties,
            p_geojson: item.geom
          });
          
          if (error) {
            console.warn("RPC failed, attempting direct insert...", error);
            const fallbackResult = await supabase.from('map_shapes').insert({
              country: item.country,
              boundary_type: item.boundary_type,
              name: item.name,
              code: item.code,
              properties: item.properties,
              geom: item.geom
            });

            if (fallbackResult.error) {
              throw new Error(`Upload failed. RPC error: ${error.message} | Direct insert error: ${fallbackResult.error.message}.`);
            }
          }
        }

        const currentProgress = 40 + Math.round(((i + chunk.length) / featuresToInsert.length) * 60);
        setProgress(currentProgress);
        setStatus(`Uploading... ${Math.min(i + chunkSize, featuresToInsert.length)} / ${featuresToInsert.length} features saved.`);
      }

      setStatus('Upload complete! The boundaries are now ready to be searched.');
      setProgress(100);
      setFile(null);
      fetchBoundaries(); // Refresh the list
    } catch (error) {
      console.error(error);
      setStatus('Error: ' + error.message);
      setProgress(0);
    }
  };

  return (
    <div className="w-full max-w-none grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in p-4 lg:p-0 px-4 lg:px-8">
      
      {/* LEFT SIDE: UPLOAD FORM */}
      <div className="p-8 bg-surface/30 backdrop-blur-md rounded-2xl border border-border-light/45 shadow-xl self-start">
        <h2 className="text-2xl font-bold text-text-main mb-4">Upload Boundaries</h2>
        <p className="text-sm text-text-muted mb-6">
          Upload electoral boundaries (.geojson or .zip containing shapefiles).
        </p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">Country</label>
            <input
              type="text"
              placeholder="e.g. Canada"
              className="block w-full p-3 bg-surface/40 border border-border-light text-sm text-text-main rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
          </div>
          <div>
            <label className="block mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">Boundary Type</label>
            <input
              type="text"
              list="boundaryTypes"
              placeholder="e.g. Federal"
              className="block w-full p-3 bg-surface/40 border border-border-light text-sm text-text-main rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
              value={boundaryType}
              onChange={(e) => setBoundaryType(e.target.value)}
            />
            <datalist id="boundaryTypes">
              <option value="Federal" />
              <option value="Provincial" />
              <option value="State" />
              <option value="Municipal" />
              <option value="City Ward" />
            </datalist>
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

        <div className="mb-6">
          <label className="block mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">Select File</label>
          <input
            className="block w-full text-xs text-text-muted border border-border-light rounded-xl cursor-pointer bg-surface/40 focus:outline-none file:mr-4 file:py-3 file:px-4 file:rounded-l-xl file:border-0 file:text-xs file:font-bold file:bg-primary file:text-slate-950 hover:file:bg-primary-hover transition-colors"
            type="file"
            accept=".zip,.geojson,.json"
            onChange={handleFileChange}
          />
        </div>

        <div>
          <button
            className="px-6 py-3 bg-primary hover:bg-primary-hover text-slate-950 font-bold rounded-xl transition-all duration-200 focus:ring-4 focus:ring-primary/10 disabled:opacity-50 w-full shadow-[0_4px_14px_rgba(233,235,158,0.15)]"
            onClick={handleUpload}
            disabled={progress > 0 && progress < 100}
          >
            {progress > 0 && progress < 100 ? 'Processing...' : 'Upload to Database'}
          </button>
        </div>

        {status && (
          <div className="mt-4 p-4 bg-surface/80 border border-border-light rounded-xl text-sm font-medium animate-fade-in flex flex-col gap-2">
            <span className={status.startsWith('Error') ? 'text-danger' : 'text-primary'}>{status}</span>
            {progress > 0 && progress < 100 && (
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
  );
}
