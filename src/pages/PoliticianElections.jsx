import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Vote, MapPin, Send, X, ExternalLink } from 'lucide-react';

export default function PoliticianElections() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [openSeats, setOpenSeats] = useState([]);
  const [myCandidacies, setMyCandidacies] = useState([]);
  const [myShapeIds, setMyShapeIds] = useState(new Set());

  const [applyingSeatId, setApplyingSeatId] = useState(null);
  const [statementDraft, setStatementDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState('');

  const fetchAll = async () => {
    setLoading(true);

    const { data: memberships } = await supabase
      .from('user_boundary_memberships')
      .select('map_shape_id')
      .eq('profile_id', user.id);
    setMyShapeIds(new Set((memberships || []).map(m => m.map_shape_id)));

    const { data: seats } = await supabase
      .from('election_seats')
      .select('id, role_title, map_shape_id, map_shapes(name, boundary_type, country), elections!inner(id, name, election_date, status)')
      .eq('elections.status', 'nominations_open')
      .order('role_title');
    setOpenSeats(seats || []);

    const { data: candidacies } = await supabase
      .from('election_candidates')
      .select('id, statement, seat_id, election_seats(role_title, map_shapes(name), elections(name, status))')
      .eq('politician_id', user.id)
      .order('created_at', { ascending: false });
    setMyCandidacies(candidacies || []);

    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchAll();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const myCandidacySeatIds = new Set(myCandidacies.map(c => c.seat_id));

  const sortedOpenSeats = [...openSeats].sort((a, b) => {
    const aNear = myShapeIds.has(a.map_shape_id) ? 0 : 1;
    const bNear = myShapeIds.has(b.map_shape_id) ? 0 : 1;
    return aNear - bNear;
  });

  const startApplying = (seatId) => {
    setApplyingSeatId(seatId);
    setStatementDraft('');
    setStatus('');
  };

  const submitApplication = async (seatId) => {
    setSubmitting(true);
    setStatus('');
    const { error } = await supabase.rpc('apply_for_seat', {
      p_seat_id: seatId,
      p_statement: statementDraft.trim() || null
    });
    setSubmitting(false);
    if (error) {
      setStatus('Error: ' + error.message);
      return;
    }
    setApplyingSeatId(null);
    setStatementDraft('');
    fetchAll();
  };

  const withdraw = async (candidateId) => {
    if (!window.confirm('Withdraw this candidacy?')) return;
    await supabase.from('election_candidates').delete().eq('id', candidateId);
    fetchAll();
  };

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 space-y-10">
      <div className="flex items-center gap-3">
        <Vote className="text-primary" size={24} />
        <h1 className="text-2xl font-bold text-text-main">Elections</h1>
      </div>

      {/* My Candidacies */}
      <section>
        <h2 className="text-lg font-bold text-text-secondary mb-4">My Candidacies</h2>
        {myCandidacies.length === 0 ? (
          <p className="text-sm text-text-muted bg-surface/20 rounded-xl border border-dashed border-border-light/60 p-6 text-center">
            You haven't applied to any seats yet.
          </p>
        ) : (
          <div className="space-y-3">
            {myCandidacies.map(c => (
              <div key={c.id} className="p-4 bg-surface/30 rounded-xl border border-border-light/35 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-bold text-text-secondary text-sm">{c.election_seats?.role_title} — {c.election_seats?.map_shapes?.name}</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {c.election_seats?.elections?.name} · {c.election_seats?.elections?.status?.replace('_', ' ')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => navigate(`/candidacy/${c.id}`)} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary-light hover:bg-primary/20 rounded-lg text-xs font-semibold transition-colors">
                    <ExternalLink size={13} /> Manage
                  </button>
                  <button onClick={() => withdraw(c.id)} className="px-3 py-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg text-xs font-semibold transition-colors">
                    Withdraw
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Open Seats */}
      <section>
        <h2 className="text-lg font-bold text-text-secondary mb-4">Open Seats — Apply to Run</h2>
        {sortedOpenSeats.length === 0 ? (
          <p className="text-sm text-text-muted bg-surface/20 rounded-xl border border-dashed border-border-light/60 p-6 text-center">
            No elections are accepting nominations right now.
          </p>
        ) : (
          <div className="space-y-3">
            {sortedOpenSeats.map(seat => {
              const alreadyApplied = myCandidacySeatIds.has(seat.id);
              const isNear = myShapeIds.has(seat.map_shape_id);
              return (
                <div key={seat.id} className="p-4 bg-surface/30 rounded-xl border border-border-light/35">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-bold text-text-secondary text-sm flex items-center gap-2">
                        {seat.role_title} — {seat.map_shapes?.name}
                        {isNear && <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded uppercase font-bold">Near you</span>}
                      </p>
                      <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1.5">
                        <MapPin size={12} /> {seat.elections?.name} · {seat.elections?.election_date}
                      </p>
                    </div>
                    {alreadyApplied ? (
                      <span className="text-xs font-semibold text-emerald-400">Applied ✓</span>
                    ) : applyingSeatId === seat.id ? (
                      <button onClick={() => setApplyingSeatId(null)} className="p-1.5 text-text-muted hover:text-text-main rounded-lg"><X size={16} /></button>
                    ) : (
                      <button onClick={() => startApplying(seat.id)} className="px-4 py-2 bg-primary hover:bg-primary-hover text-slate-950 font-bold rounded-lg text-xs transition-colors">
                        Apply
                      </button>
                    )}
                  </div>

                  {applyingSeatId === seat.id && (
                    <div className="mt-3 pt-3 border-t border-border-light/30 space-y-2.5">
                      <textarea
                        value={statementDraft}
                        onChange={e => setStatementDraft(e.target.value)}
                        placeholder="Why are you running? (optional, shown on your candidacy page)"
                        rows={3}
                        className="w-full bg-surface-hover border border-border-light rounded-lg p-2.5 text-sm text-text-main outline-none focus:border-primary resize-none"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => submitApplication(seat.id)}
                          disabled={submitting}
                          className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-slate-950 font-bold rounded-lg text-xs transition-colors disabled:opacity-50"
                        >
                          <Send size={13} /> {submitting ? 'Submitting...' : 'Submit Application'}
                        </button>
                      </div>
                      {status && <p className="text-danger text-xs">{status}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
