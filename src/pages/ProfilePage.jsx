import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { MapPin } from 'lucide-react';

export default function ProfilePage() {
  const { session } = useAuth();
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
  const [isCustomDesignation, setIsCustomDesignation] = useState(false);
  const [customDesignation, setCustomDesignation] = useState('');

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
        .select(`role, full_name, country, constituency, designation`)
        .eq('id', user.id)
        .single();

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
          setDesignation(data.designation || '');
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
      const finalDesignation = isCustomDesignation ? customDesignation.trim() : designation;

      // Insert custom ones into global pool
      if (role === 'politician' && finalCountry && finalDesignation && (isCustomCountry || isCustomDesignation)) {
        await supabase.from('designations').upsert({ country: finalCountry, name: finalDesignation }, { onConflict: 'country,name' });
      }

      const updates = {
        id: user.id,
        role,
        full_name: fullName,
        country: role === 'politician' ? finalCountry : null,
        constituency: (role === 'normal' || role === 'politician') ? constituency : null,
        designation: role === 'politician' ? finalDesignation : null,
        updated_at: new Date(),
      };

      const { error } = await supabase.from('profiles').upsert(updates);

      if (error) {
        throw error;
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
      
      if (!error && data && data.length > 0) {
        // Usually the smallest boundary is the local constituency
        const localArea = data[0].name;
        setConstituency(localArea);
        setMessage({ type: 'success', text: `Located you in ${localArea}` });
      } else {
        setConstituency(`Lat: ${parseFloat(lat).toFixed(4)}, Lng: ${parseFloat(lng).toFixed(4)}`);
        setMessage({ type: 'success', text: 'Location saved as coordinates (no boundary found).' });
      }
    } catch (err) {
      setConstituency(`Lat: ${parseFloat(lat).toFixed(4)}, Lng: ${parseFloat(lng).toFixed(4)}`);
      setMessage({ type: 'success', text: 'Location saved as coordinates.' });
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
    return <div className="text-slate-400 text-center mt-10">Loading profile...</div>;
  }

  const isOnboarding = !role;

  return (
    <div className="w-full max-w-2xl p-8 bg-slate-800 rounded-2xl border border-white/10 shadow-xl animate-fade-in mx-auto mt-10">
      <h2 className="text-2xl font-bold text-slate-50 mb-2 text-center">
        {isOnboarding ? 'Complete Your Profile' : 'Edit Profile'}
      </h2>
      <p className="text-slate-400 text-center mb-8">
        {isOnboarding ? 'Welcome! Tell us a bit more about yourself to get started.' : 'Update your personal information and preferences.'}
      </p>

      {role === 'admin' ? (
        <div className="text-center bg-slate-900/50 p-6 rounded-xl border border-white/10 mt-6">
          <h3 className="text-xl font-bold text-slate-200 mb-2">Administrator Account</h3>
          <p className="text-slate-400 mb-4">You have special privileges to manage electoral boundaries. Your profile details are locked.</p>
          <a href="/admin" className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
            Go to Admin Portal
          </a>
        </div>
      ) : (
      <form onSubmit={updateProfile} className="flex flex-col gap-6">
        <div>
          <label className="block mb-2 text-sm font-medium text-slate-300">Full Name</label>
          <input
            type="text"
            placeholder="Your Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="block w-full p-3 text-sm text-slate-50 border border-slate-600 rounded-lg bg-slate-900 focus:outline-none focus:border-blue-500"
            required
          />
        </div>

        <div>
          <label className="block mb-3 text-sm font-medium text-slate-300">Account Type</label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              className={`p-4 rounded-xl border text-left transition-all duration-300 ${
                role === 'normal' 
                  ? 'bg-blue-500/20 border-blue-500 text-blue-100' 
                  : 'bg-slate-900 border-slate-600 text-slate-400 hover:border-slate-500 hover:bg-slate-800'
              }`}
              onClick={() => setRole('normal')}
            >
              <h3 className="font-bold mb-1">Citizen</h3>
              <p className="text-xs opacity-80">I am a regular citizen tracking my constituency.</p>
            </button>
            <button
              type="button"
              className={`p-4 rounded-xl border text-left transition-all duration-300 ${
                role === 'politician' 
                  ? 'bg-indigo-500/20 border-indigo-500 text-indigo-100' 
                  : 'bg-slate-900 border-slate-600 text-slate-400 hover:border-slate-500 hover:bg-slate-800'
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
          <div className="animate-fade-in p-5 bg-slate-900/50 rounded-xl border border-white/10 space-y-4">
            <div>
              <h3 className="font-bold text-slate-200">Location & Constituency</h3>
              <p className="text-xs text-slate-400 mt-1">We need your location to match you with your relevant boundary.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 space-y-2">
                <label className="block text-xs text-slate-400">Latitude</label>
                <input
                  type="text"
                  placeholder="e.g. 49.15"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                  className="w-full p-3 text-sm text-slate-50 border border-slate-600 rounded-lg bg-slate-950 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex-1 space-y-2">
                <label className="block text-xs text-slate-400">Longitude</label>
                <input
                  type="text"
                  placeholder="e.g. -122.64"
                  value={manualLng}
                  onChange={(e) => setManualLng(e.target.value)}
                  className="w-full p-3 text-sm text-slate-50 border border-slate-600 rounded-lg bg-slate-950 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="button"
                onClick={getGeolocation}
                disabled={geoLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg transition-colors border border-blue-500/30 disabled:opacity-50 text-sm font-medium"
              >
                <MapPin size={16} />
                {geoLoading ? 'Detecting...' : 'Auto-Detect'}
              </button>
              <button
                type="button"
                onClick={() => findFromCoordinates(manualLat, manualLng)}
                disabled={geoLoading || !manualLat || !manualLng}
                className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors border border-slate-500 disabled:opacity-50 text-sm font-medium"
              >
                Find from Coordinates
              </button>
            </div>

            <div className="space-y-2 pt-2 border-t border-white/5 mt-4">
              <label className="block text-sm font-medium text-slate-300">Constituency / District Result</label>
              <input
                type="text"
                placeholder="Will be auto-filled, or type manually"
                value={constituency}
                onChange={(e) => setConstituency(e.target.value)}
                className="w-full p-3 text-sm text-slate-50 border border-slate-600 rounded-lg bg-slate-900 focus:outline-none focus:border-blue-500"
                required
              />
            </div>
          </div>
        )}

        {role === 'politician' && (
          <div className="animate-fade-in p-5 bg-slate-900/50 rounded-xl border border-white/10 space-y-4">
            <h3 className="font-bold text-slate-200">Political Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block mb-2 text-sm font-medium text-slate-300">Country</label>
                {isCustomCountry ? (
                  <input
                    type="text"
                    placeholder="Enter new country"
                    value={customCountry}
                    onChange={(e) => setCustomCountry(e.target.value)}
                    className="block w-full p-3 text-sm text-slate-50 border border-slate-600 rounded-lg bg-slate-950 focus:outline-none focus:border-blue-500 mb-2"
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
                    className="block w-full p-3 text-sm text-slate-50 border border-slate-600 rounded-lg bg-slate-950 focus:outline-none focus:border-blue-500 mb-2"
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
                <label className="block mb-2 text-sm font-medium text-slate-300">Designation / Role</label>
                {isCustomDesignation || isCustomCountry ? (
                  <input
                    type="text"
                    placeholder="Enter new designation"
                    value={customDesignation}
                    onChange={(e) => setCustomDesignation(e.target.value)}
                    className="block w-full p-3 text-sm text-slate-50 border border-slate-600 rounded-lg bg-slate-950 focus:outline-none focus:border-blue-500 mb-2"
                    required
                  />
                ) : (
                  <select
                    value={designation}
                    onChange={(e) => {
                      if (e.target.value === '_custom_') setIsCustomDesignation(true);
                      else setDesignation(e.target.value);
                    }}
                    className="block w-full p-3 text-sm text-slate-50 border border-slate-600 rounded-lg bg-slate-950 focus:outline-none focus:border-blue-500 mb-2"
                    required
                  >
                    <option value="" disabled>Select Designation</option>
                    {dbDesignations[country]?.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                    <option value="_custom_">+ Add New Designation...</option>
                  </select>
                )}
                {isCustomDesignation && !isCustomCountry && (
                  <button type="button" onClick={() => setIsCustomDesignation(false)} className="text-xs text-blue-400 hover:underline">Cancel Custom Designation</button>
                )}
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
          className="mt-4 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50"
          disabled={saving || !role}
        >
          {saving ? 'Saving...' : isOnboarding ? 'Complete Setup' : 'Save Profile'}
        </button>
      </form>
      )}
    </div>
  );
}
