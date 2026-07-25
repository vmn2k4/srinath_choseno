import React, { useState, useEffect } from 'react';
import AdminSubNav from '../../components/AdminSubNav';
import { listPendingElectionAdminApplications, reviewElectionAdminApplication } from '../../services/elections';
import { ShieldCheck, CheckCircle2, XCircle, Mail, MessageSquare } from 'lucide-react';

export default function ElectionAdminApplications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  const fetchApplications = async () => {
    setLoading(true);
    const { data } = await listPendingElectionAdminApplications();
    setApplications(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchApplications(); }, []);

  const handleReview = async (applicationId, approve) => {
    setStatus('');
    const { error } = await reviewElectionAdminApplication(applicationId, approve);
    if (error) {
      setStatus('Error: ' + error.message);
      return;
    }
    fetchApplications();
  };

  return (
    <div className="w-full max-w-none animate-fade-in px-4 lg:px-8 space-y-6">
      <AdminSubNav active="election-admins" />

      <div className="flex items-center gap-3">
        <ShieldCheck className="text-primary" size={22} />
        <h1 className="text-xl font-bold text-text-main">Election Administrator Applications</h1>
      </div>

      {status && <p className="text-danger text-xs">{status}</p>}

      <div className="p-6 bg-surface/30 backdrop-blur-md rounded-2xl border border-border-light/45 shadow-xl">
        {loading ? (
          <p className="text-sm text-text-muted text-center py-6">Loading...</p>
        ) : applications.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-6">No pending applications. Applications older than 48 hours with no site-admin action auto-approve on their own.</p>
        ) : (
          <div className="space-y-4">
            {applications.map(a => (
              <div key={a.id} className="p-4 bg-surface-hover/40 rounded-xl border border-border-light/30">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                  <div>
                    <p className="font-bold text-text-secondary text-sm">{a.election_seats?.role_title} — {a.election_seats?.map_shapes?.name}</p>
                    <p className="text-xs text-text-muted mt-0.5">{a.election_seats?.elections?.name} · submitted {new Date(a.submitted_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleReview(a.id, true)} title="Approve" className="p-2 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 rounded-lg transition-colors">
                      <CheckCircle2 size={16} />
                    </button>
                    <button onClick={() => handleReview(a.id, false)} title="Reject" className="p-2 bg-danger/10 text-rose-300 hover:bg-danger/20 rounded-lg transition-colors">
                      <XCircle size={16} />
                    </button>
                  </div>
                </div>
                <div className="space-y-2 text-sm text-text-secondary">
                  <p className="flex items-start gap-2"><MessageSquare size={14} className="text-accent shrink-0 mt-0.5" /> {a.motivation}</p>
                  {a.social_media_info && <p className="text-xs text-text-muted pl-6">Social media: {a.social_media_info}</p>}
                  <p className="flex items-center gap-2 text-xs text-text-muted"><Mail size={13} className="text-accent" /> {a.contact_email}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
