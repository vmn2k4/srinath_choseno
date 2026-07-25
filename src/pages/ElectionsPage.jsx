import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getActiveSeatsByShapeIds, getCandidatesBySeatIds } from '../services/elections';
import { getProfileRole, getUserBoundaryShapeIds } from '../services/profile';
import { Vote, MapPin, Users, ChevronRight } from 'lucide-react';

export default function ElectionsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [seats, setSeats] = useState([]); // [{...seat, candidates: [...]}]
  const [role, setRole] = useState(null);

  const fetchElections = async () => {
    setLoading(true);

    const { data: myProfile } = await getProfileRole(user.id);
    setRole(myProfile?.role || null);

    const { data: memberships } = await getUserBoundaryShapeIds(user.id);
    const shapeIds = (memberships || []).map(m => m.map_shape_id);

    if (shapeIds.length === 0) {
      setSeats([]);
      setLoading(false);
      return;
    }

    const { data: seatRows } = await getActiveSeatsByShapeIds(shapeIds);

    const seatIds = (seatRows || []).map(s => s.id);
    let candidatesBySeat = {};
    if (seatIds.length > 0) {
      const { data: candidateRows } = await getCandidatesBySeatIds(seatIds);
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

      {role === 'normal' && (
        <div className="p-4 bg-primary/10 border border-primary/25 rounded-xl flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-text-secondary">
            Want to run for one of these seats? Switch your account to a politician profile to nominate yourself.
          </p>
          <button
            onClick={() => navigate('/profile')}
            className="px-4 py-2 bg-primary hover:bg-primary-hover text-slate-950 font-bold rounded-lg text-sm transition-colors shrink-0"
          >
            Become a Politician
          </button>
        </div>
      )}

      {seats.length === 0 ? (
        <div className="text-center py-16 bg-surface/20 rounded-2xl border border-dashed border-border-light/60">
          <div className="w-16 h-16 rounded-full bg-surface-hover flex items-center justify-center mx-auto mb-4">
            <Vote className="text-text-muted w-8 h-8" />
          </div>
          <h3 className="text-text-tertiary font-medium mb-1">No Active Elections</h3>
          <p className="text-text-muted text-sm">There's no election running right now for any group you belong to.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {seats.map(seat => (
            <button
              key={seat.id}
              onClick={() => navigate(`/elections/seat/${seat.id}`)}
              className="w-full text-left bg-surface/30 backdrop-blur-md rounded-2xl border border-border-light/45 hover:border-primary/30 shadow-xl overflow-hidden p-5 flex items-center justify-between gap-4 transition-all group"
            >
              <div className="min-w-0">
                <p className="text-xs text-text-muted mb-1">{seat.elections?.name} · {seat.elections?.election_date}</p>
                <h2 className="text-lg font-bold text-text-main flex items-center gap-2 flex-wrap">
                  {seat.role_title}
                  <span className="text-sm font-normal text-text-muted flex items-center gap-1">
                    <MapPin size={13} className="text-accent" /> {seat.map_shapes?.name}
                  </span>
                </h2>
                <p className="text-xs text-text-muted mt-1.5 flex items-center gap-1.5">
                  <Users size={12} />
                  {seat.candidates.length === 0 ? 'No candidates yet' : `${seat.candidates.length} candidate${seat.candidates.length !== 1 ? 's' : ''}`}
                </p>
              </div>
              <ChevronRight size={18} className="text-text-darker group-hover:text-primary-light transition-colors shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
