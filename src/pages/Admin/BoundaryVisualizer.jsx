import React, { useState, useEffect } from 'react';
import BoundaryPicker from '../../components/map/BoundaryPicker';
import MapComponent from '../../components/map/MapComponent';
import AdminSubNav from '../../components/AdminSubNav';
import { getCountries, listBoundaryTypes, getMapShapesByType, findShapesInContainers, getGeojsonShapes } from '../../services/boundaries';
import { Eye, MapPin, List } from 'lucide-react';
import { Card, Button, Select } from '../../components/ui';

// Above this many matched shapes, fetching + rendering full-resolution
// geometry for all of them at once would hang the tab (BoundaryPicker's own
// list view already does at similar scale) — show a plain name list instead
// unless the admin explicitly opts in.
const RENDER_CAP = 500;

export default function BoundaryVisualizer() {
  const [countries, setCountries] = useState([]);
  const [country, setCountry] = useState('');
  const [boundaryTypes, setBoundaryTypes] = useState([]);
  const [containerType, setContainerType] = useState('');
  const [containerId, setContainerId] = useState(new Set());
  const [targetType, setTargetType] = useState('');

  const [matches, setMatches] = useState(null); // [{id, name, code}] — no geometry yet
  const [mapBoundaries, setMapBoundaries] = useState(null); // with geojson, ready for MapComponent
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    getCountries().then(({ data }) => setCountries((data || []).map(c => c.name)));
    listBoundaryTypes().then(({ data }) => setBoundaryTypes(data || []));
  }, []);

  const typesForCountry = country ? boundaryTypes.filter(t => t.country === country) : [];
  // Container types (Canada's Province, USA's State, ...) exist to scope
  // this tool's search. USA's 'State' is both a container and a valid
  // target (Governor/Senator) at once -- see ElectionsAdmin.jsx's matching
  // comment; is_container and admin_only are separate flags
  // (20260729000017), not hardcoded per type.
  const containerTypeOptions = typesForCountry.filter(t => t.is_container);
  const targetTypeOptions = typesForCountry.filter(t => !t.admin_only);

  useEffect(() => {
    setContainerType('');
    setContainerId(new Set());
    setTargetType('');
    setMatches(null);
    setMapBoundaries(null);
    setStatus('');
  }, [country]);

  const handleVisualize = async () => {
    if (!country || !targetType) {
      setStatus('Pick a country and a target boundary type first.');
      return;
    }
    setLoadingMatches(true);
    setMapBoundaries(null);
    setMatches(null);
    setStatus('');

    const containerShapeIds = [...containerId];
    const { data, error } = containerShapeIds.length > 0
      ? await findShapesInContainers({ containerShapeIds, targetBoundaryType: targetType, country, columns: 'id, name, code' })
      : await getMapShapesByType({ country, boundaryType: targetType, columns: 'id, name, code', paginated: true });

    setLoadingMatches(false);
    if (error) {
      setStatus('Error: ' + error.message);
      return;
    }

    setMatches(data || []);
    if ((data || []).length === 0) {
      setStatus('No matching boundaries found.');
    } else if (data.length > RENDER_CAP) {
      setStatus(`${data.length} boundaries matched — that's too many to render at once (cap: ${RENDER_CAP}). Showing the list below; use "Load Map Anyway" if you really want to render all of them.`);
    }
  };

  const loadGeometry = async (ids) => {
    setLoadingGeo(true);
    const { data, error } = await getGeojsonShapes(ids);
    setLoadingGeo(false);
    if (error) {
      setStatus('Error loading geometry: ' + error.message);
      return;
    }
    const geoMap = new Map((data || []).map(g => [g.id, g.geojson]));
    setMapBoundaries(matches.map(m => ({ ...m, geojson: geoMap.get(m.id) || null })));
  };

  useEffect(() => {
    if (matches && matches.length > 0 && matches.length <= RENDER_CAP) {
      loadGeometry(matches.map(m => m.id));
    }
  }, [matches]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="w-full max-w-none flex flex-col gap-8 animate-fade-in p-4 lg:p-0 px-4 lg:px-8">
      <AdminSubNav active="visualizer" />

      <Card padding="lg" className="space-y-5">
        <h2 className="text-2xl font-bold text-text-main flex items-center gap-2"><Eye size={20} className="text-primary" /> Boundary Visualizer</h2>
        <p className="text-sm text-text-muted">
          Pick a country, optionally narrow to every boundary inside a specific container (e.g. every municipality
          inside one province), and see the result directly on a map — read-only, nothing is selected or changed.
        </p>

        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block mb-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">Country</label>
            <Select value={country} onChange={e => setCountry(e.target.value)} className="max-w-xs">
              <option value="">Select country...</option>
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Container (optional — e.g. a province)</p>
          <Select
            value={containerType}
            onChange={e => { setContainerType(e.target.value); setContainerId(new Set()); }}
            disabled={!country}
            className="max-w-xs mb-2"
          >
            <option value="">{country ? 'Container type: none' : 'Select a country first'}</option>
            {containerTypeOptions.map(t => (
              <option key={t.type_name} value={t.type_name}>{t.type_name}</option>
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
          <div className="flex-1 min-w-[200px]">
            <label className="block mb-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">Target boundary type</label>
            <Select value={targetType} onChange={e => setTargetType(e.target.value)} disabled={!country}>
              <option value="">{country ? 'Select target boundary type...' : 'Select a country first'}</option>
              {targetTypeOptions.map(t => (
                <option key={t.type_name} value={t.type_name}>{t.type_name}</option>
              ))}
            </Select>
          </div>
          <Button onClick={handleVisualize} disabled={!country || !targetType || loadingMatches}>
            <MapPin size={16} /> {loadingMatches ? 'Finding...' : 'Visualize'}
          </Button>
        </div>

        {status && <p className="text-xs text-warning-light">{status}</p>}

        {matches && matches.length > RENDER_CAP && !mapBoundaries && (
          <div className="space-y-3">
            <Button variant="secondary" onClick={() => loadGeometry(matches.map(m => m.id))} disabled={loadingGeo}>
              {loadingGeo ? 'Loading map...' : 'Load Map Anyway'}
            </Button>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">
              <List size={14} /> {matches.length} boundaries
            </div>
            <div className="max-h-64 overflow-y-auto border border-border-light/30 rounded-xl divide-y divide-border-light/20">
              {matches.map(m => (
                <div key={m.id} className="px-3 py-1.5 text-xs text-text-secondary">{m.name}</div>
              ))}
            </div>
          </div>
        )}

        {mapBoundaries && (
          <div className="h-[70vh] max-h-[600px] min-h-[320px]">
            <MapComponent boundaries={mapBoundaries} />
          </div>
        )}
      </Card>
    </div>
  );
}
