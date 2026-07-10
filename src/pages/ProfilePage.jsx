import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { MapPin } from 'lucide-react';

const DESIGNATIONS_BY_COUNTRY = {
  'USA': ['Mayor', 'Senator', 'Representative', 'Governor', 'City Council'],
  'India': ['MLA', 'MP', 'Mayor', 'Corporator', 'Sarpanch'],
  'Canada': ['MP', 'MPP', 'MLA', 'Mayor', 'City Councillor'],
  'UK': ['MP', 'Mayor', 'Councillor', 'Member of Scottish Parliament'],
  'Australia': ['MP', 'Senator', 'Mayor', 'Councillor'],
  'Other': ['Mayor', 'MP', 'Regional Representative', 'Other']
};

const COUNTRIES = Object.keys(DESIGNATIONS_BY_COUNTRY);

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
  const [geoLoading, setGeoLoading] = useState(false);

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

      if (!ignore) {
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

      const updates = {
        id: user.id,
        role,
        full_name: fullName,
        country: role === 'politician' ? country : null,
        constituency: role === 'normal' ? constituency : null,
        designation: role === 'politician' ? designation : null,
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

  const getGeolocation = () => {
    setGeoLoading(true);
    setMessage({ type: '', text: '' });

    if (!navigator.geolocation) {
      setMessage({ type: 'error', text: 'Geolocation is not supported by your browser' });
      setGeoLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        try {
          // Attempt to find constituency using backend PostGIS RPC if available
          const { data, error } = await supabase.rpc('find_boundaries_by_point', {
            lng: lng,
            lat: lat
          });
          
          if (!error && data && data.length > 0) {
            // Usually the smallest boundary is the local constituency
            const localArea = data[0].name;
            setConstituency(localArea);
            setMessage({ type: 'success', text: `Located you in ${localArea}` });
          } else {
            // Fallback if RPC not setup or no data
            setConstituency(`Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`);
            setMessage({ type: 'success', text: 'Location saved as coordinates.' });
          }
        } catch (err) {
          // Fallback if RPC not setup
          setConstituency(`Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`);
          setMessage({ type: 'success', text: 'Location saved as coordinates.' });
        } finally {
          setGeoLoading(false);
        }
      },
      (error) => {
        setMessage({ type: 'error', text: 'Unable to retrieve your location: ' + error.message });
        setGeoLoading(false);
      }
    );
  };

  if (loading) {
    return <div className="text-slate-400 text-center mt-10">Loading profile...</div>;
  }

  // Determine if it's initial onboarding
  const isOnboarding = !role;

  return (
    <div className="w-full max-w-2xl p-8 bg-slate-800 rounded-2xl border border-white/10 shadow-xl animate-fade-in mx-auto mt-10">
      <h2 className="text-2xl font-bold text-slate-50 mb-2 text-center">
        {isOnboarding ? 'Complete Your Profile' : 'Edit Profile'}
      </h2>
      <p className="text-slate-400 text-center mb-8">
        {isOnboarding ? 'Welcome! Tell us a bit more about yourself to get started.' : 'Update your personal information and preferences.'}
      </p>

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

        {/* Dynamic Fields based on Role */}
        {role === 'normal' && (
          <div className="animate-fade-in space-y-2">
            <label className="block text-sm font-medium text-slate-300">Your Constituency / District</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Downtown Ward 1"
                value={constituency}
                onChange={(e) => setConstituency(e.target.value)}
                className="block w-full p-3 text-sm text-slate-50 border border-slate-600 rounded-lg bg-slate-900 focus:outline-none focus:border-blue-500"
                required
              />
              <button
                type="button"
                onClick={getGeolocation}
                disabled={geoLoading}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg transition-colors border border-slate-500 disabled:opacity-50 whitespace-nowrap"
              >
                <MapPin size={18} />
                {geoLoading ? 'Locating...' : 'Locate Me'}
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1">Use 'Locate Me' to automatically find your constituency based on your current location.</p>
          </div>
        )}

        {role === 'politician' && (
          <div className="animate-fade-in grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block mb-2 text-sm font-medium text-slate-300">Country</label>
              <select
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  setDesignation(''); // reset designation when country changes
                }}
                className="block w-full p-3 text-sm text-slate-50 border border-slate-600 rounded-lg bg-slate-900 focus:outline-none focus:border-blue-500"
                required
              >
                {COUNTRIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block mb-2 text-sm font-medium text-slate-300">Designation / Role</label>
              <select
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="block w-full p-3 text-sm text-slate-50 border border-slate-600 rounded-lg bg-slate-900 focus:outline-none focus:border-blue-500"
                required
              >
                <option value="" disabled>Select Designation</option>
                {DESIGNATIONS_BY_COUNTRY[country]?.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
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
    </div>
  );
}
