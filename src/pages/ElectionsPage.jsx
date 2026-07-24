import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Vote, MapPin, Users, ChevronRight } from 'lucide-react';

export default function ElectionsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [seats, setSeats] = useState([]); // [{...seat, candidates: [...]}]

  const fetchElections = async () => {
    setLoading(true);

    const { data: memberships } = await supabase
      .from('user_boundary_memberships')
      .select('map_shape_id')
      .eq('profile_id', user.id);
    const shapeIds = (memberships || []).map(m => m.map_shape_id);

    if (shapeIds.length === 0) {
      setSeats([]);
      setLoading(false);
      return;
    }

    const { data: seatRows } = await supabase
      .from('election_seats')
      .select('id, role_title, map_shapes(name, boundary_type), elections!inner(id, name, election_date, status)')
      .in('map_shape_id', shapeIds)
      .eq('elections.status', 'active');

    const seatIds = (seatRows || []).map(s => s.id);
    let candidatesBySeat = {};
    if (seatIds.length > 0) {
      const { data: candidateRows } = await supabase
        .from('election_candidates')
        .select('id, statement, seat_id, profiles(full_name, current_ghost_id)')
        .in('seat_id', seatIds);
      (candidateRows || []).forEach(c => {
        candidatesBySeat[c.seat_id] = candidatesBySeat[c.seat_id] || [];
        candidatesBySeat[c.seat_id].push(c);
      });
    }

    setSeats((seatRows || []).map(s => ({ ...s, candidates: candidatesBySeat[s.id] || [] })));
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchElections();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 space-y-8">
      <div className="flex items-center gap-3">
        <Vote className="text-primary" size={24} />
        <h1 className="text-2xl font-bold text-text-main">Elections</h1>
      </div>

      {seats.length === 0 ? (
        <div className="text-center py-16 bg-surface/20 rounded-2xl border border-dashed border-border-light/60">
          <div className="w-16 h-16 rounded-full bg-surface-hover flex items-center justify-center mx-auto mb-4">
            <Vote className="text-text-muted w-8 h-8" />
          </div>
          <h3 className="text-text-tertiary font-medium mb-1">No Active Elections</h3>
          <p className="text-text-muted text-sm">There's no election running right now for any group you belong to.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {seats.map(seat => (
            <div key={seat.id} className="bg-surface/30 backdrop-blur-md rounded-2xl border border-border-light/45 shadow-xl overflow-hidden">
              <div className="p-5 border-b border-border-light/30">
                <p className="text-xs text-text-muted mb-1">{seat.elections?.name} · {seat.elections?.election_date}</p>
                <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
                  {seat.role_title}
                  <span className="text-sm font-normal text-text-muted flex items-center gap-1">
                    <MapPin size={13} className="text-accent" /> {seat.map_shapes?.name}
                  </span>
                </h2>
              </div>
              <div className="p-3">
                {seat.candidates.length === 0 ? (
                  <p className="text-sm text-text-muted text-center py-6">No candidates have applied for this seat yet.</p>
                ) : (
                  <div className="space-y-2">
                    {seat.candidates.map(c => {
                      const name = c.profiles?.full_name || `Ghost-${c.profiles?.current_ghost_id?.split('-')[0]}`;
                      return (
                        <button
                          key={c.id}
                          onClick={() => navigate(`/candidacy/${c.id}`)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl bg-surface-hover/40 hover:bg-surface-hover border border-border-light/30 hover:border-primary/30 transition-all text-left group"
                        >
                          <div className="w-10 h-10 rounded-full bg-primary/20 text-primary-light flex items-center justify-center shrink-0 border border-primary/30">
                            <Users size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text-secondary truncate">{name}</p>
                            {c.statement && <p className="text-xs text-text-muted truncate">{c.statement}</p>}
                          </div>
                          <ChevronRight size={16} className="text-text-darker group-hover:text-primary-light transition-colors shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
