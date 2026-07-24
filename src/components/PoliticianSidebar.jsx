import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { Users, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PoliticianSidebar({ profile, activeTab, memberships = [] }) {
  const [politicians, setPoliticians] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!profile) return;

    async function fetchPoliticians() {
      setLoading(true);
      try {
        let boundaryIds = memberships.map(m => m.id);

        let query = supabase
          .from('politician_profiles')
          .select(`
            id,
            political_target_role,
            target_boundary_name,
            target_boundary_type,
            profiles!inner (
              current_ghost_id,
              full_name,
              country
            )
          `);

        if (boundaryIds.length > 0) {
           query = query.or(`target_boundary_id.in.(${boundaryIds.join(',')}),target_boundary_type.eq.Country`);
        } else {
           query = query.eq('target_boundary_type', 'Country');
        }
        
        const { data, error } = await query;
        if (!error && data) {
           // Filter Country-level politicians to match user's country in JS to avoid foreign table OR constraints
           let filteredData = data.filter(pol => {
              if (pol.target_boundary_type === 'Country') {
                 return pol.profiles?.country === profile.country;
              }
              return true;
           });

           // Sort so Federal shows up above Local
           const sorted = filteredData.sort((a, b) => {
              if (a.target_boundary_type === 'Federal' && b.target_boundary_type !== 'Federal') return -1;
              if (b.target_boundary_type === 'Federal' && a.target_boundary_type !== 'Federal') return 1;
              return 0;
           });
           setPoliticians(sorted);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchPoliticians();
  }, [profile, activeTab]);

  if (activeTab?.toLowerCase() === 'international') return null;

  return (
    <div className="bg-surface/50 rounded-xl border border-border-light/50 p-5 sticky top-24">
      <h3 className="text-text-secondary font-semibold mb-4 flex items-center gap-2">
        <Users size={18} className="text-primary-light" /> 
        Local Representatives
      </h3>
      
      {loading ? (
        <div className="text-center py-4 text-text-muted text-sm">Loading...</div>
      ) : politicians.length === 0 ? (
        <div className="text-center py-6 text-text-muted text-sm bg-surface-hover/50 rounded-lg border border-dashed border-border-light">
          No representatives found for this {activeTab.toLowerCase()}.
        </div>
      ) : (
        <div className="space-y-3">
          {politicians.map((pol) => {
            const name = pol.profiles.full_name || `ghost-${pol.profiles.current_ghost_id.split('-')[0]}`;
            const role = pol.political_target_role || 'politician';
            const boundary = pol.target_boundary_name || pol.profiles.country || '';
            const slug = `${name}-${role}-${boundary}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

            return (
            <div 
              key={pol.id}
              onClick={() => navigate(`/wall/${pol.profiles.current_ghost_id}/${slug}`)}
              className="group cursor-pointer bg-surface-hover/50 hover:bg-surface-hover rounded-lg p-3 border border-border-light/50 hover:border-primary/30 transition-all flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-full bg-primary/20 text-primary-light flex items-center justify-center shrink-0 border border-primary/30 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                 <Users size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-text-secondary text-sm font-medium truncate">{pol.profiles.full_name || `Ghost-${pol.profiles.current_ghost_id.split('-')[0]}`}</h4>
                <p className="text-text-muted text-xs truncate">{pol.political_target_role}</p>
              </div>
              <ChevronRight size={16} className="text-text-darker group-hover:text-primary-light transition-colors" />
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
