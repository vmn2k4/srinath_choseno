import React, { useState, useEffect } from 'react';
import AdminSubNav from '../../components/AdminSubNav';
import { listPendingElectionAdminApplications, reviewElectionAdminApplication } from '../../services/elections';
import { ShieldCheck, CheckCircle2, XCircle, Mail, MessageSquare } from 'lucide-react';
import { Card, Button, Spinner, EmptyState, PageHeader } from '../../components/ui';

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

      <PageHeader icon={ShieldCheck} title="Election Administrator Applications" />

      {status && <p className="text-danger text-xs">{status}</p>}

      <Card>
        {loading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : applications.length === 0 ? (
          <EmptyState description="No pending applications. Applications older than 48 hours with no site-admin action auto-approve on their own." />
        ) : (
          <div className="space-y-4">
            {applications.map(a => (
              <Card key={a.id} variant="row" padding="sm">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                  <div>
                    <p className="font-bold text-text-secondary text-sm">{a.election_seats?.role_title} — {a.election_seats?.map_shapes?.name}</p>
                    <p className="text-xs text-text-muted mt-0.5">{a.election_seats?.elections?.name} · submitted {new Date(a.submitted_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="icon" tone="primary" onClick={() => handleReview(a.id, true)} title="Approve">
                      <CheckCircle2 size={16} />
                    </Button>
                    <Button variant="icon" tone="danger" onClick={() => handleReview(a.id, false)} title="Reject">
                      <XCircle size={16} />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 text-sm text-text-secondary">
                  <p className="flex items-start gap-2"><MessageSquare size={14} className="text-accent shrink-0 mt-0.5" /> {a.motivation}</p>
                  {a.social_media_info && <p className="text-xs text-text-muted pl-6">Social media: {a.social_media_info}</p>}
                  <p className="flex items-center gap-2 text-xs text-text-muted"><Mail size={13} className="text-accent" /> {a.contact_email}</p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
