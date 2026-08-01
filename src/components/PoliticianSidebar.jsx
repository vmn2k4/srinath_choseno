import React, { useEffect, useState } from 'react';
import { getInterestedPoliticians } from '../services/profile';
import { getGhostDisplayName } from '../utils/ghostName';
import { Users, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, Spinner, EmptyState } from './ui';

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

        const { data, error } = await getInterestedPoliticians(boundaryIds);
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
    <Card variant="composer" padding="sm" className="sticky top-24">
      <h3 className="text-text-main font-bold mb-4 flex items-center gap-2 text-sm sm:text-base">
        <Users size={18} className="text-primary" />
        Candidates &amp; Representatives
      </h3>

      {loading ? (
        <div className="flex justify-center py-4"><Spinner size="sm" /></div>
      ) : politicians.length === 0 ? (
        <EmptyState description={`No candidates or representatives found for this ${activeTab.toLowerCase()} area yet.`} />
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
              <div className="w-10 h-10 rounded-full bg-primary/20 text-primary-light flex items-center justify-center shrink-0 border border-primary/30 group-hover:bg-indigo-500 group-hover:text-white transition-colors overflow-hidden">
                 {pol.avatar_url ? (
                   <img src={pol.avatar_url} alt={name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                 ) : (
                   <Users size={16} />
                 )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-text-secondary text-sm font-medium truncate">{pol.profiles.full_name || getGhostDisplayName(pol.profiles.current_ghost_id)}</h4>
                <p className="text-text-muted text-xs truncate">{pol.political_target_role}</p>
              </div>
              <ChevronRight size={16} className="text-text-darker group-hover:text-primary-light transition-colors" />
            </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
