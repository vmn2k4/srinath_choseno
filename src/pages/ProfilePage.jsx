import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { MapPin } from 'lucide-react';
export default function ProfilePage() {
  const { session } = useAuth();
  
  const POLITICAL_ROLES = [
    { label: 'Prime Minister / President', type: 'Country' },
    { label: 'Member of Parliament (MP) / Senator', type: 'Federal' },
    { label: 'MLA / MPP / Governor', type: 'Provincial' },
    { label: 'Mayor / County Executive', type: 'Municipal' },
    { label: 'City Councilor', type: 'City Ward' }
  ];
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profile state
  const [role, setRole] = useState('');
  const [fullName, setFullName] = useState('');
  const [country, setCountry] = useState('India');
  const [constituency, setConstituency] = useState('');
  const [designation, setDesignation] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  const [dbDesignations, setDbDesignations] = useState({});
  const [countriesList, setCountriesList] = useState([]);

  const [isCustomCountry, setIsCustomCountry] = useState(false);
  const [customCountry, setCustomCountry] = useState('');
  
  const [politicalTargetRole, setPoliticalTargetRole] = useState('');

  const [pendingLocation, setPendingLocation] = useState(null);

  const [geoLoading, setGeoLoading] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');

  useEffect(() => {
    let ignore = false;
    async function getProfile() {
      setLoading(true);
      const { user } = session;

      const { data, error } = await supabase
        .from('profiles')
        .select(`role, full_name, country, constituency`)
        .eq('id', user.id)
        .single();
        
      if (data?.role === 'politician') {
        const { data: polData } = await supabase
          .from('politician_profiles')
          .select('political_target_role, target_boundary_id, target_boundary_name')
          .eq('id', user.id)
          .maybeSingle();
        if (polData) {
           data.political_target_role = polData.political_target_role;
           data.target_boundary_id = polData.target_boundary_id;
           data.target_boundary_name = polData.target_boundary_name;
        }
      }

      // Fetch existing location coordinates to pre-fill the fields
      const { data: locData } = await supabase
        .from('user_locations')
        .select('latitude, longitude, federal_boundary_id, polling_district_id')
        .eq('profile_id', user.id)
        .maybeSingle();

      // Fetch dynamic designations
      const { data: desigData } = await supabase.from('designations').select('*');

      if (!ignore) {
        if (desigData) {
          const grouped = {};
          desigData.forEach(d => {
            if (!grouped[d.country]) grouped[d.country] = [];
            if (!grouped[d.country].includes(d.name)) grouped[d.country].push(d.name);
          });
          setDbDesignations(grouped);
          setCountriesList(Object.keys(grouped).sort());
        }
        if (data) {
          setRole(data.role || '');
          setFullName(data.full_name || '');
          if (data.country) setCountry(data.country);
          setConstituency(data.constituency || '');
          setPoliticalTargetRole(data.political_target_role || '');
        }
        if (locData) {
          if (locData.latitude) setManualLat(String(locData.latitude));
          if (locData.longitude) setManualLng(String(locData.longitude));
        }
        setLoading(false);
      }
    }

    getProfile();
    return () => { ignore = true; };
  }, [session]);

  const updateProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const { user } = session;

      const finalCountry = isCustomCountry ? customCountry.trim() : country;
      
      let targetBoundaryType = null;
      let targetBoundaryId = null;

      if (role === 'politician' && politicalTargetRole) {
         const selectedRoleObj = POLITICAL_ROLES.find(r => r.label === politicalTargetRole);
         targetBoundaryType = selectedRoleObj ? selectedRoleObj.type : null;
         
         if (pendingLocation && pendingLocation.allBoundaries) {
             const matchingB = pendingLocation.allBoundaries.find(
               b => b.boundary_type?.toUpperCase() === targetBoundaryType?.toUpperCase()
             );
             if (matchingB) {
               targetBoundaryId = matchingB.id;
             } else if (targetBoundaryType?.toUpperCase() === 'FEDERAL') {
               targetBoundaryId = pendingLocation.federalId;
             } else {
               targetBoundaryId = pendingLocation.pollingId;
             }
         } else {
             // No new location searched — preserve the existing record
             const { data: existData } = await supabase
               .from('politician_profiles')
               .select('target_boundary_id')
               .eq('id', user.id)
               .maybeSingle();
             targetBoundaryId = existData?.target_boundary_id;
         }
      }

      const updates = {
        id: user.id,
        role,
        full_name: fullName,
        country: role === 'politician' ? finalCountry : null,
        constituency: (role === 'normal' || role === 'politician') ? constituency : null,
        updated_at: new Date(),
      };

      const { error } = await supabase.from('profiles').upsert(updates);

      if (error) {
        throw error;
      }
      
      if (role === 'politician') {
          // Also resolve the human-readable name for the target boundary
          let targetBoundaryName = null;
          if (pendingLocation && pendingLocation.allBoundaries && targetBoundaryType) {
            const matchingB = pendingLocation.allBoundaries.find(b => b.boundary_type?.toUpperCase() === targetBoundaryType?.toUpperCase());
            if (matchingB) {
              targetBoundaryName = matchingB.name;
            } else {
              targetBoundaryName = targetBoundaryType?.toUpperCase() === 'FEDERAL' 
                ? `Federal Grid (${pendingLocation.lat.toFixed(1)}, ${pendingLocation.lng.toFixed(1)})`
                : `Local Grid (${pendingLocation.lat.toFixed(2)}, ${pendingLocation.lng.toFixed(2)})`;
            }
          } else {
            const { data: existPol } = await supabase
              .from('politician_profiles')
              .select('target_boundary_name')
              .eq('id', user.id)
              .maybeSingle();
            targetBoundaryName = existPol?.target_boundary_name;
          }

          const polUpdates = {
            id: user.id,
            political_target_role: politicalTargetRole,
            target_boundary_type: targetBoundaryType,
            target_boundary_id: targetBoundaryId,
            target_boundary_name: targetBoundaryName,
            updated_at: new Date(),
          };
          await supabase.from('politician_profiles').upsert(polUpdates);
      } else {
          await supabase.from('politician_profiles').delete().eq('id', user.id);
      }

      // If they searched for a new location, save it to user_locations now
      if (pendingLocation) {
        const { data: pData } = await supabase.from('profiles').select('current_ghost_id').eq('id', user.id).single();

        const locationPayload = {
          profile_id: user.id,
          ghost_id: pData?.current_ghost_id,
          latitude: pendingLocation.lat,
          longitude: pendingLocation.lng,
          federal_boundary_id: pendingLocation.federalId,
          polling_district_id: pendingLocation.pollingId
        };

        const { data: existingLoc } = await supabase.from('user_locations')
          .select('id')
          .eq('profile_id', user.id)
          .maybeSingle();

        if (existingLoc) {
          await supabase.from('user_locations').update(locationPayload).eq('id', existingLoc.id);
        } else {
          await supabase.from('user_locations').insert(locationPayload);
        }

        setPendingLocation(null);
      }

      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const findFromCoordinates = async (lat, lng) => {
    setGeoLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const { data, error } = await supabase.rpc('find_boundaries_by_point', {
        lng: parseFloat(lng),
        lat: parseFloat(lat)
      });

      if (error) throw error;

      let federalId = null;
      let pollingId = null;
      let federalName = null;
      let pollingName = null;

      // 1. Try to find boundaries from the shapefile data
      if (data && data.length > 0) {
        const fed = data.find(b => b.boundary_type?.toUpperCase() === 'FEDERAL');
        if (fed) {
          federalId = fed.id;
          federalName = fed.name;
        }

        // Check for common local boundary types
        const localTypes = ['POLLING DISTRICT', 'CITY WARD', 'MUNICIPAL', 'PROVINCIAL'];
        let local = null;
        for (const t of localTypes) {
           local = data.find(b => b.boundary_type?.toUpperCase() === t);
           if (local) break;
        }
        
        // If no recognized local type, grab any boundary that isn't the federal one
        if (!local) local = data.find(b => b.id !== federalId);

        if (local) {
          pollingId = local.id;
          pollingName = local.name;
        }
      }

      // 2. HYBRID FALLBACK ARCHITECTURE
      // If the government shapefiles are incomplete for this location, 
      // we generate a Geo-Grid based on their coordinates to guarantee they have a feed.
      
      const numLat = parseFloat(lat);
      const numLng = parseFloat(lng);

      // Federal fallback: 1 decimal place (~11km x 11km area)
      if (!federalId) {
        federalId = `grid-fed-${numLat.toFixed(1)}-${numLng.toFixed(1)}`;
        federalName = `Federal Grid (${numLat.toFixed(1)}, ${numLng.toFixed(1)})`;
      }

      // Local fallback: 2 decimal places (~1.1km x 1.1km neighborhood)
      if (!pollingId) {
        pollingId = `grid-loc-${numLat.toFixed(2)}-${numLng.toFixed(2)}`;
        pollingName = `Local Grid (${numLat.toFixed(2)}, ${numLng.toFixed(2)})`;
      }

      // Only stage in memory — no DB writes here
      setPendingLocation({
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        federalId,
        pollingId,
        allBoundaries: data || []
      });

      const displayConstituency = federalName || pollingName || 'Location Mapped';
      setConstituency(displayConstituency);
      setMessage({ type: 'success', text: `Located in ${displayConstituency}. Click 'Save Profile' to apply.` });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Error mapping coordinates to boundary.' });
    } finally {
      setGeoLoading(false);
    }
  };

  const getGeolocation = () => {
    if (!navigator.geolocation) {
      setMessage({ type: 'error', text: 'Geolocation is not supported by your browser' });
      return;
    }

    setGeoLoading(true);
    setMessage({ type: '', text: '' });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setManualLat(lat.toString());
        setManualLng(lng.toString());
        findFromCoordinates(lat, lng);
      },
      (error) => {
        setMessage({ type: 'error', text: 'Unable to auto-retrieve location. Please enter coordinates manually.' });
        setGeoLoading(false);
      }
    );
  };

  if (loading) {
    return <div className="text-text-muted text-center mt-10">Loading profile...</div>;
  }

  const isOnboarding = !role;

  return (
    <div className="w-full max-w-2xl p-8 bg-surface-hover rounded-2xl border border-white/10 shadow-xl animate-fade-in mx-auto mt-10">
      <h2 className="text-2xl font-bold text-text-main mb-2 text-center">
        {isOnboarding ? 'Complete Your Profile' : 'Edit Profile'}
      </h2>
      <p className="text-text-muted text-center mb-8">
        {isOnboarding ? 'Welcome! Tell us a bit more about yourself to get started.' : 'Update your personal information and preferences.'}
      </p>

      {role === 'admin' ? (
        <div className="text-center bg-surface/50 p-6 rounded-xl border border-white/10 mt-6">
          <h3 className="text-xl font-bold text-text-secondary mb-2">Administrator Account</h3>
          <p className="text-text-muted mb-4">You have special privileges to manage electoral boundaries. Your profile details are locked.</p>
          <a href="/admin" className="inline-block px-6 py-3 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover transition-colors">
            Go to Admin Portal
          </a>
        </div>
      ) : (
        <form onSubmit={updateProfile} className="flex flex-col gap-6">
          <div>
            <label className="block mb-2 text-sm font-medium text-text-tertiary">Full Name</label>
            <input
              type="text"
              placeholder="Your Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="block w-full p-3 text-sm text-text-main border border-slate-600 rounded-lg bg-surface focus:outline-none focus:border-accent"
              required
            />
          </div>

          <div>
            <label className="block mb-3 text-sm font-medium text-text-tertiary">Account Type</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                className={`p-4 rounded-xl border text-left transition-all duration-300 ${role === 'normal'
                    ? 'bg-blue-500/20 border-accent text-blue-100'
                    : 'bg-surface border-slate-600 text-text-muted hover:border-slate-500 hover:bg-surface-hover'
                  }`}
                onClick={() => setRole('normal')}
              >
                <h3 className="font-bold mb-1">Citizen</h3>
                <p className="text-xs opacity-80">I am a regular citizen tracking my constituency.</p>
              </button>
              <button
                type="button"
                className={`p-4 rounded-xl border text-left transition-all duration-300 ${role === 'politician'
                    ? 'bg-primary/20 border-primary text-indigo-100'
                    : 'bg-surface border-slate-600 text-text-muted hover:border-slate-500 hover:bg-surface-hover'
                  }`}
                onClick={() => setRole('politician')}
              >
                <h3 className="font-bold mb-1">Politician</h3>
                <p className="text-xs opacity-80">I represent a region or plan to run for office.</p>
              </button>
            </div>
          </div>

          {/* Shared Location Section for both Roles */}
          {(role === 'normal' || role === 'politician') && (
            <div className="animate-fade-in p-5 bg-surface/50 rounded-xl border border-white/10 space-y-4">
              <div>
                <h3 className="font-bold text-text-secondary">Location & Constituency</h3>
                <p className="text-xs text-text-muted mt-1">We need your location to match you with your relevant boundary.</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 space-y-2">
                  <label className="block text-xs text-text-muted">Latitude</label>
                  <input
                    type="text"
                    placeholder="e.g. 49.15"
                    value={manualLat}
                    onChange={(e) => setManualLat(e.target.value)}
                    className="w-full p-3 text-sm text-text-main border border-slate-600 rounded-lg bg-background focus:outline-none focus:border-accent"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <label className="block text-xs text-text-muted">Longitude</label>
                  <input
                    type="text"
                    placeholder="e.g. -122.64"
                    value={manualLng}
                    onChange={(e) => setManualLng(e.target.value)}
                    className="w-full p-3 text-sm text-text-main border border-slate-600 rounded-lg bg-background focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  onClick={getGeolocation}
                  disabled={geoLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-accent/20 hover:bg-accent/30 text-blue-400 rounded-lg transition-colors border border-accent/30 disabled:opacity-50 text-sm font-medium"
                >
                  <MapPin size={16} />
                  {geoLoading ? 'Detecting...' : 'Auto-Detect'}
                </button>
                <button
                  type="button"
                  onClick={() => findFromCoordinates(manualLat, manualLng)}
                  disabled={geoLoading || !manualLat || !manualLng}
                  className="flex-1 px-4 py-3 bg-surface-active hover:bg-slate-600 text-text-secondary rounded-lg transition-colors border border-slate-500 disabled:opacity-50 text-sm font-medium"
                >
                  Find from Coordinates
                </button>
              </div>

              <div className="space-y-2 pt-2 border-t border-white/5 mt-4">
                <label className="block text-sm font-medium text-text-tertiary">Constituency / District Result</label>
                <input
                  type="text"
                  placeholder="Will be auto-filled, or type manually"
                  value={constituency}
                  onChange={(e) => setConstituency(e.target.value)}
                  className="w-full p-3 text-sm text-text-main border border-slate-600 rounded-lg bg-surface focus:outline-none focus:border-accent"
                  required
                />
              </div>
            </div>
          )}

          {role === 'politician' && (
            <div className="animate-fade-in p-5 bg-surface/50 rounded-xl border border-white/10 space-y-4">
              <h3 className="font-bold text-text-secondary">Political Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 text-sm font-medium text-text-tertiary">Country</label>
                  {isCustomCountry ? (
                    <input
                      type="text"
                      placeholder="Enter new country"
                      value={customCountry}
                      onChange={(e) => setCustomCountry(e.target.value)}
                      className="block w-full p-3 text-sm text-text-main border border-slate-600 rounded-lg bg-background focus:outline-none focus:border-accent mb-2"
                      required
                    />
                  ) : (
                    <select
                      value={country}
                      onChange={(e) => {
                        if (e.target.value === '_custom_') {
                          setIsCustomCountry(true);
                          setIsCustomDesignation(true);
                        } else {
                          setCountry(e.target.value);
                          setDesignation('');
                        }
                      }}
                      className="block w-full p-3 text-sm text-text-main border border-slate-600 rounded-lg bg-background focus:outline-none focus:border-accent mb-2"
                      required
                    >
                      <option value="" disabled>Select Country</option>
                      {countriesList.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      <option value="_custom_">+ Add New Country...</option>
                    </select>
                  )}
                  {isCustomCountry && (
                    <button type="button" onClick={() => setIsCustomCountry(false)} className="text-xs text-blue-400 hover:underline">Cancel Custom Country</button>
                  )}
                </div>

                <div>
                <label className="block mb-2 text-sm font-medium text-text-tertiary">Target Political Role</label>
                <select
                  value={politicalTargetRole}
                  onChange={(e) => setPoliticalTargetRole(e.target.value)}
                  className="block w-full p-3 text-sm text-text-main border border-slate-600 rounded-lg bg-background focus:outline-none focus:border-accent mb-2"
                  required
                >
                  <option value="" disabled>Select Role Level</option>
                  {POLITICAL_ROLES.map(r => (
                    <option key={r.label} value={r.label}>{r.label} ({r.type} level)</option>
                  ))}
                </select>
                <p className="text-xs text-text-muted mt-1">This defines the exact geographic boundary you want to target.</p>
              </div>  
              </div>
            </div>
          )}

          {message.text && (
            <div className={`p-4 rounded-lg text-sm font-medium animate-fade-in ${message.type === 'error' ? 'bg-red-500/10 border border-red-500/30 text-red-400' : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'}`}>
              {message.text}
            </div>
          )}

          <button
            type="submit"
            className="mt-4 px-6 py-3 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover transition-colors focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50"
            disabled={saving || !role}
          >
            {saving ? 'Saving...' : isOnboarding ? 'Complete Setup' : 'Save Profile'}
          </button>
        </form>
      )}
    </div>
  );
}
