"use client";

import React, { useState, useEffect } from "react";
import AdminSubNav from "./AdminSubNav";
import {
  listPendingElectionAdminApplications,
  reviewElectionAdminApplication,
} from "@/lib/services/elections";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Mail,
  MessageSquare,
} from "lucide-react";
import {
  Card,
  Button,
  Spinner,
  EmptyState,
  PageHeader,
} from "@/components/primitives";
import { createClient } from "@/lib/supabase/client";

export default function ElectionAdminApplicationsClient() {
  const supabase = createClient();
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const fetchApplications = async () => {
    setLoading(true);
    const { data } = await listPendingElectionAdminApplications(supabase);
    setApplications(data || []);
    setLoading(false);
  };

  useEffect(() => {
    Promise.resolve().then(() => fetchApplications());
  }, [supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReview = async (applicationId: string, approve: boolean) => {
    setStatus("");
    const { error } = await reviewElectionAdminApplication(
      supabase,
      applicationId,
      approve
    );
    if (error) {
      setStatus("Error: " + error.message);
      return;
    }
    fetchApplications();
  };

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 space-y-6">
      <PageHeader icon={ShieldCheck} title="Election Administrator Applications" />

      <AdminSubNav active="election-admins" />

      {status && <p className="text-danger text-xs">{status}</p>}

      <Card padding="md">
        {loading ? (
          <Spinner />
        ) : applications.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No Pending Applications"
            description="No pending seat administrator applications awaiting review."
          />
        ) : (
          <div className="space-y-4">
            {applications.map((a) => (
              <div
                key={a.id}
                className="p-4 bg-surface/30 border border-border-light/30 rounded-2xl space-y-3 text-xs"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-bold text-text-main text-sm">
                      {a.election_seats?.role_title} —{" "}
                      {a.election_seats?.map_shapes?.name}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {a.election_seats?.elections?.name} · submitted{" "}
                      {new Date(a.submitted_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleReview(a.id, true)}
                      className="gap-1 text-xs"
                    >
                      <CheckCircle2 size={14} /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReview(a.id, false)}
                      className="gap-1 text-xs text-danger border-danger/40"
                    >
                      <XCircle size={14} /> Reject
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 text-text-secondary pt-2 border-t border-border-light/20">
                  <p className="flex items-start gap-2">
                    <MessageSquare
                      size={14}
                      className="text-accent shrink-0 mt-0.5"
                    />{" "}
                    {a.motivation}
                  </p>
                  {a.social_media_info && (
                    <p className="text-xs text-text-muted pl-6">
                      Social media: {a.social_media_info}
                    </p>
                  )}
                  <p className="flex items-center gap-2 text-xs text-text-muted">
                    <Mail size={13} className="text-accent" /> {a.contact_email}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
