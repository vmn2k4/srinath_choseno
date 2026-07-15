import React, { useState } from 'react';
import { MapPin, Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { supabase } from '../../services/supabase';

export default function StepLocation({ data, updateData, nextStep, prevStep }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [lat, setLat] = useState(data.lat || '');
  const [lng, setLng] = useState(data.lng || '');

  const getLocationFromBrowser = () => {
    setLoading(true);
    setError('');
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude.toString());
        setLng(position.coords.longitude.toString());
        lookupBoundaries(position.coords.latitude, position.coords.longitude);
      },
      (err) => {
        setError(`Unable to retrieve your location: ${err.message}. Please enter coordinates manually.`);
        setLoading(false);
      },
      { timeout: 10000 }
    );
  };

  const lookupBoundaries = async (latitude, longitude) => {
    setLoading(true);
    try {
      const { data: boundaries, error: rpcError } = await supabase.rpc('find_boundaries_by_point', {
        lon: parseFloat(longitude),
        lat: parseFloat(latitude)
      });
      
      if (rpcError) throw rpcError;

      let p_id = null;
      let f_id = null;
      let b_name = '';

      if (boundaries && boundaries.length > 0) {
        boundaries.forEach(b => {
          if (b.layer_type === 'polling_districts') {
             p_id = b.boundary_id;
             b_name = b.boundary_name;
          }
          if (b.layer_type === 'federal_boundaries') {
             f_id = b.boundary_id;
             if (!b_name) b_name = b.boundary_name;
          }
        });
      }

      // Grid Fallback
      if (!p_id) {
         const gridLat = Math.round(parseFloat(latitude) * 20) / 20;
         const gridLng = Math.round(parseFloat(longitude) * 20) / 20;
         p_id = `grid-loc-${gridLat}-${gridLng}`;
         if (!b_name) b_name = `Local Grid ${gridLat}, ${gridLng}`;
      }
      if (!f_id) {
         const fedLat = Math.round(parseFloat(latitude) * 2) / 2;
         const fedLng = Math.round(parseFloat(longitude) * 2) / 2;
         f_id = `grid-fed-${fedLat}-${fedLng}`;
      }

      updateData({
        lat: latitude.toString(),
        lng: longitude.toString(),
        polling_district_id: p_id,
        federal_boundary_id: f_id,
        boundaryName: b_name
      });
      
      // Auto advance
      nextStep();
    } catch (err) {
      console.error(err);
      setError("Could not resolve location. Please ensure you are connected to the internet.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={prevStep} className="p-2 bg-surface-hover rounded-full text-text-muted hover:text-text-main transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-text-main">Set Your Location</h2>
          <p className="text-sm text-text-muted">This places you in the correct jurisdictional feed.</p>
        </div>
      </div>

      <div className="bg-surface-hover p-8 rounded-2xl border border-border text-center">
        <div className="w-20 h-20 bg-primary/20 text-primary-light rounded-full flex items-center justify-center mx-auto mb-6">
          <MapPin size={40} />
        </div>
        
        <h3 className="text-xl font-medium text-text-main mb-2">Find My Jurisdiction</h3>
        <p className="text-text-muted text-sm mb-6 max-w-md mx-auto">
          We use your coordinates to strictly match you with your exact local and federal boundaries. 
          Your exact coordinates are never shared publicly.
        </p>

        <button 
          onClick={getLocationFromBrowser}
          disabled={loading}
          className="px-8 py-3 bg-primary text-white font-medium rounded-xl hover:bg-primary-hover transition-colors flex items-center gap-2 mx-auto disabled:opacity-50"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <MapPin size={18} />}
          {loading ? 'Locating...' : 'Use Current Location'}
        </button>

        {error && <p className="text-danger mt-4 text-sm font-medium">{error}</p>}
      </div>

      <div className="mt-8 pt-8 border-t border-border">
        <p className="text-sm text-text-muted mb-4 font-medium uppercase tracking-wider">Or enter manually</p>
        <div className="flex gap-4 mb-4">
          <input 
            type="number" 
            placeholder="Latitude (e.g. 43.65)" 
            value={lat} 
            onChange={e => setLat(e.target.value)}
            className="flex-1 bg-surface border border-border-light rounded-xl p-3 text-text-main outline-none focus:border-primary"
          />
          <input 
            type="number" 
            placeholder="Longitude (e.g. -79.38)" 
            value={lng} 
            onChange={e => setLng(e.target.value)}
            className="flex-1 bg-surface border border-border-light rounded-xl p-3 text-text-main outline-none focus:border-primary"
          />
        </div>
        <button 
          onClick={() => {
            if (lat && lng) lookupBoundaries(lat, lng);
            else setError('Enter both latitude and longitude');
          }}
          disabled={loading || !lat || !lng}
          className="w-full py-3 bg-surface-active text-text-secondary rounded-xl hover:bg-border transition-colors font-medium disabled:opacity-50"
        >
          Verify Coordinates
        </button>
      </div>
      
      {data.boundaryName && (
        <div className="mt-6 flex justify-end">
           <button onClick={nextStep} className="px-6 py-2 bg-text-main text-background rounded-lg font-bold flex items-center gap-2 hover:bg-text-secondary transition-colors">
              Continue <ArrowRight size={16} />
           </button>
        </div>
      )}
    </div>
  );
}
