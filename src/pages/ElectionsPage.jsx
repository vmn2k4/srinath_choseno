import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getActiveSeatsByShapeIds, getActiveSeats, getCandidatesBySeatIds } from '../services/elections';
import { getProfileRole, getUserBoundaryShapeIds } from '../services/profile';
import { Vote, MapPin, Users, ChevronRight } from 'lucide-react';
import { Card, Button, Spinner, EmptyState, PageHeader } from '../components/ui';

export default function ElectionsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [seats, setSeats] = useState([]); // [{...seat, candidates: [...]}]
  const [role, setRole] = useState(null);

  // Signed-in users see seats scoped to their own boundary memberships;
  // anonymous visitors have no "my area" to scope by, so they see every
  // currently open seat platform-wide instead.
  const fetchElections = async () => {
    setLoading(true);

    let seatRows;
    if (user) {
      const { data: myProfile } = await getProfileRole(user.id);
      setRole(myProfile?.role || null);

      const { data: memberships } = await getUserBoundaryShapeIds(user.id);
      const shapeIds = (memberships || []).map(m => m.map_shape_id);

      if (shapeIds.length === 0) {
        setSeats([]);
        setLoading(false);
        return;
      }

      ({ data: seatRows } = await getActiveSeatsByShapeIds(shapeIds));
    } else {
      setRole(null);
      ({ data: seatRows } = await getActiveSeats());
    }

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
    if (!authLoading) fetchElections();
  }, [user?.id, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <Spinner fullPage />;
  }

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 space-y-8">
      <PageHeader icon={Vote} title="Elections" />

      {role === 'normal' && (
        <Card padding="sm" className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-text-secondary">
            Interested in serving your community? Switch to candidate mode to file your candidacy.
          </p>
          <Button onClick={() => navigate('/profile')} className="shrink-0">
            Run for Office
          </Button>
        </Card>
      )}

      {seats.length === 0 ? (
        <EmptyState
          icon={Vote}
          title="No Active Elections"
          description="There's no election running right now for any group you belong to."
        />
      ) : (
        <div className="space-y-4">
          {seats.map(seat => (
            <Card
              key={seat.id}
              as="button"
              interactive
              onClick={() => navigate(`/elections/seat/${seat.id}`)}
              className="w-full text-left overflow-hidden flex items-center justify-between gap-4 group"
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
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
