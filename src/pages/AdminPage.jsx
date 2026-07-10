import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import shp from 'shpjs';

export default function AdminPage() {
  const [file, setFile] = useState(null);
  const [country, setCountry] = useState('');
  const [boundaryType, setBoundaryType] = useState('Federal');
  const [nameField, setNameField] = useState('');
  const [codeField, setCodeField] = useState('');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);

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
          geom: formatGeometry(f.geometry || f) // handle raw geometry
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

      // Chunking to avoid Supabase statement timeouts for highly detailed polygons
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
              throw new Error(`Upload failed. RPC error: ${error.message} | Direct insert error: ${fallbackResult.error.message}. Did you run the latest SQL snippet in Supabase?`);
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
    } catch (error) {
      console.error(error);
      setStatus('Error: ' + error.message);
      setProgress(0);
    }
  };

  return (
    <div className="w-full max-w-xl p-8 bg-slate-800 rounded-2xl border border-white/10 shadow-xl animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-50 mb-4">Admin Panel - Upload Boundaries</h2>
      <p className="text-sm text-slate-400 mb-6">
        Please upload your electoral boundaries. You can upload a standard <strong>.geojson</strong> file, or a <strong>.zip</strong> file containing your ESRI Shapefile components (.shp, .dbf, .shx, .prj, etc).
      </p>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block mb-2 text-sm font-medium text-slate-300">Country</label>
          <input
            type="text"
            placeholder="e.g. Canada"
            className="block w-full p-3 text-sm text-slate-50 border border-slate-600 rounded-lg bg-slate-900 focus:outline-none focus:border-blue-500"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
        </div>
        <div>
          <label className="block mb-2 text-sm font-medium text-slate-300">Boundary Type / Level</label>
          <input
            type="text"
            list="boundaryTypes"
            placeholder="e.g. Federal, State, Province, Canton..."
            className="block w-full p-3 text-sm text-slate-50 border border-slate-600 rounded-lg bg-slate-900 focus:outline-none focus:border-blue-500"
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
          <label className="block mb-2 text-sm font-medium text-slate-300">Name Attribute (Optional)</label>
          <input
            type="text"
            placeholder="e.g. ED_NAMEE"
            className="block w-full p-3 text-sm text-slate-50 border border-slate-600 rounded-lg bg-slate-900 focus:outline-none focus:border-blue-500"
            value={nameField}
            onChange={(e) => setNameField(e.target.value)}
          />
        </div>
        <div>
          <label className="block mb-2 text-sm font-medium text-slate-300">Code Attribute (Optional)</label>
          <input
            type="text"
            placeholder="e.g. FED_NUM"
            className="block w-full p-3 text-sm text-slate-50 border border-slate-600 rounded-lg bg-slate-900 focus:outline-none focus:border-blue-500"
            value={codeField}
            onChange={(e) => setCodeField(e.target.value)}
          />
        </div>
      </div>

      <div className="mb-6">
        <label className="block mb-2 text-sm font-medium text-slate-300">Select .zip or .geojson</label>
        <input
          className="block w-full text-sm text-slate-400 border border-slate-600 rounded-lg cursor-pointer bg-slate-900 focus:outline-none file:mr-4 file:py-3 file:px-4 file:rounded-l-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 transition-colors"
          type="file"
          accept=".zip,.geojson,.json"
          onChange={handleFileChange}
        />
        <p className="mt-2 text-xs text-slate-400">
          Tip: For highly complex shapefiles, consider simplifying them first at <a href="https://mapshaper.org" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">mapshaper.org</a> before uploading.
        </p>
      </div>

      <div>
        <button
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50"
          onClick={handleUpload}
          disabled={progress > 0 && progress < 100}
        >
          {progress > 0 && progress < 100 ? 'Processing...' : 'Upload to Database'}
        </button>
      </div>

      {status && (
        <div className="mt-4 p-4 bg-slate-900/80 border border-slate-700 rounded-lg text-sm font-medium animate-fade-in flex flex-col gap-2">
          <span className={status.startsWith('Error') ? 'text-red-400' : 'text-blue-300'}>{status}</span>
          {progress > 0 && progress < 100 && (
            <div className="w-full bg-slate-700 rounded-full h-2 mt-1">
              <div className="bg-blue-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
