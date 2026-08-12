"use client";

import React, { useState } from "react";
import { Mail, Clock, CheckCircle2, AlertCircle, Copy, History, ExternalLink, GitMerge, Undo2, Trash2 } from "lucide-react";
import { Card, Button, Badge, Spinner, ConfirmDialog, PromptDialog } from "@/components/primitives";
import { resendOfficeholderClaim, mergeOfficeholderWallClaim, reverseOfficeholderWallClaim, previewOfficeholderWallClaim, cancelOfficeholderClaim } from "@/lib/services/elections";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type OfficeholderClaim = Database["public"]["Tables"]["office_holder_wall_claims"]["Row"];

interface InvitationHistoryPanelProps {
  wallUrl: string;
  wallSlug: string;
  politicianName: string;
  politicianEmail: string;
  officeholderId: string;
  claims: OfficeholderClaim[];
  onStatusChange: () => void;
}

export function InvitationHistoryPanel({
  wallUrl,
  wallSlug,
  politicianName,
  politicianEmail,
  officeholderId,
  claims,
  onStatusChange,
}: InvitationHistoryPanelProps) {
  const supabase = createClient();
  const [copied, setCopied] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [merging, setMerging] = useState<string | null>(null);
  const [reversing, setReversing] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // window.confirm()/window.prompt() have no mobile-app equivalent, can't be
  // themed, and in some embedded preview runtimes throw outright ("prompt()
  // is not supported") instead of just looking out of place — resolved via
  // the ConfirmDialog/PromptDialog instances rendered at the bottom instead.
  const [pendingCancel, setPendingCancel] = useState<OfficeholderClaim | null>(null);
  const [pendingMerge, setPendingMerge] = useState<{ claimId: string; summary: string } | null>(null);
  const [pendingReverse, setPendingReverse] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleResend = async (claim: OfficeholderClaim) => {
    const email = (claim.contact_email || politicianEmail || "").trim();
    if (!email) {
      setActionError("This claim has no contact email on file — enter one above before resending.");
      return;
    }
    setActionError(null);
    setResending(claim.id);
    const { error } = await resendOfficeholderClaim(supabase, claim.id, email);
    setResending(null);
    if (error) {
      setActionError(`Resend error: ${error.message}`);
    } else {
      onStatusChange();
    }
  };

  const handleCancel = (claim: OfficeholderClaim) => setPendingCancel(claim);

  const confirmCancel = async () => {
    const claim = pendingCancel;
    if (!claim) return;
    setActionError(null);
    setCancelling(claim.id);
    const { error } = await cancelOfficeholderClaim(supabase, claim.id);
    setCancelling(null);
    setPendingCancel(null);
    if (error) {
      setActionError(`Cancel error: ${error.message}`);
    } else {
      onStatusChange();
    }
  };

  const handleMerge = async (claimId: string) => {
    setActionError(null);
    setMerging(claimId);

    const { data: preview, error: previewError } = await previewOfficeholderWallClaim(supabase, claimId);
    if (previewError) {
      setMerging(null);
      setActionError(`Couldn't load merge preview: ${previewError.message}`);
      return;
    }
    const p = preview as {
      posts?: number; comments?: number; supporters?: number;
      ratings?: number; news_tags?: number; election_candidates?: number;
    } | null;
    const summary = p
      ? `This will merge the imported wall into the claiming profile:\n\n` +
        `• ${p.posts ?? 0} post(s)\n` +
        `• ${p.comments ?? 0} comment(s)\n` +
        `• ${p.supporters ?? 0} supporter(s)\n` +
        `• ${p.ratings ?? 0} rating(s)\n` +
        `• ${p.news_tags ?? 0} news tag(s)\n` +
        `• ${p.election_candidates ?? 0} election candidacy record(s)\n\n` +
        `The old wall URL will keep working (it redirects here). An admin can reverse this later.`
      : "No preview data was returned.";
    setMerging(null);
    setPendingMerge({ claimId, summary });
  };

  const confirmMerge = async () => {
    const pending = pendingMerge;
    if (!pending) return;
    setMerging(pending.claimId);
    const { error } = await mergeOfficeholderWallClaim(supabase, pending.claimId);
    setMerging(null);
    setPendingMerge(null);
    if (error) {
      setActionError(`Merge error: ${error.message}`);
    } else {
      onStatusChange();
    }
  };

  const handleReverse = (claimId: string) => setPendingReverse(claimId);

  const confirmReverse = async (reason: string) => {
    const claimId = pendingReverse;
    if (!claimId) return;
    setActionError(null);
    setReversing(claimId);
    const { error } = await reverseOfficeholderWallClaim(supabase, claimId, reason);
    setReversing(null);
    setPendingReverse(null);
    if (error) {
      setActionError(`Reversal error: ${error.message}`);
    } else {
      onStatusChange();
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
      invited: { color: "bg-blue-100 text-blue-800", icon: <Mail size={12} />, label: "Pending" },
      pending_review: { color: "bg-yellow-100 text-yellow-800", icon: <Clock size={12} />, label: "Review" },
      approved: { color: "bg-green-100 text-green-800", icon: <CheckCircle2 size={12} />, label: "Claimed" },
      reversed: { color: "bg-red-100 text-red-800", icon: <AlertCircle size={12} />, label: "Reversed" },
      expired: { color: "bg-gray-100 text-gray-800", icon: <Clock size={12} />, label: "Expired" },
    };

    const c = config[status] || config.invited;
    return (
      <Badge className={`${c.color} flex items-center gap-1 text-xs`}>
        {c.icon}
        {c.label}
      </Badge>
    );
  };

  return (
    <Card padding="md" className="space-y-4 bg-primary/5 border-primary/20 mt-4">
      {actionError && (
        <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
          {actionError}
        </div>
      )}
      {/* Wall Link Section */}
      <div className="flex flex-col sm:flex-row gap-3 p-3 bg-white border border-primary/20 rounded-lg">
        <div className="flex-1">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">
            Public Wall
          </p>
          <p className="text-sm text-text-main font-medium">{politicianName}</p>
          <p className="text-xs text-text-muted mt-0.5 truncate">{wallSlug}</p>
        </div>
        <div className="flex gap-1.5 flex-wrap sm:flex-nowrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(wallUrl, "_blank")}
            className="gap-1"
          >
            <ExternalLink size={13} />
            View Wall
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => copyToClipboard(wallUrl, "wall-url")}
            className="gap-1"
          >
            <Copy size={13} />
            {copied === "wall-url" ? "Copied" : "Copy URL"}
          </Button>
        </div>
      </div>

      {/* Invitation History */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <History size={14} className="text-text-muted" />
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide">
            Invitation History
          </h4>
          <span className="text-xs bg-surface text-text-secondary px-2 py-0.5 rounded ml-auto">
            {claims.length} {claims.length === 1 ? "invite" : "invites"}
          </span>
        </div>

        {claims.length === 0 ? (
          <p className="text-sm text-text-muted italic">No invitations sent yet</p>
        ) : (
          <div className="space-y-2">
            {claims.map((claim, idx) => (
              <div key={claim.id} className="p-3 bg-white border border-border-light/40 rounded-lg space-y-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-text-secondary">
                      #{claims.length - idx}
                    </span>
                    {getStatusBadge(claim.status)}
                    <span className="text-xs text-text-muted">
                      Sent: {formatDate(claim.created_at)}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-text-main font-medium break-all">
                  {claim.contact_email}
                </p>

                {claim.claimed_at && (
                  <p className="text-xs text-text-muted">
                    Claimed: {formatDate(claim.claimed_at)}
                  </p>
                )}
                {claim.approved_at && (
                  <p className="text-xs text-text-muted">
                    Approved: {formatDate(claim.approved_at)}
                  </p>
                )}
                {claim.reversed_at && (
                  <div className="mt-1.5 p-2 bg-red-50 border border-red-200 rounded text-xs">
                    <p className="font-semibold text-red-900">Reversed: {formatDate(claim.reversed_at)}</p>
                    {claim.reversal_reason && (
                      <p className="text-red-800 mt-0.5">Reason: {claim.reversal_reason}</p>
                    )}
                  </div>
                )}

                {/* Actions based on status */}
                <div className="flex gap-1.5 flex-wrap pt-1.5 border-t border-border-light/20">
                  {claim.status === "invited" || claim.status === "expired" ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResend(claim)}
                        disabled={resending === claim.id}
                        className="gap-1 text-xs"
                      >
                        <Mail size={12} />
                        {resending === claim.id ? "Resending…" : "Resend"}
                      </Button>
                      {claim.status === "invited" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCancel(claim)}
                          disabled={cancelling === claim.id}
                          className="gap-1 text-xs text-danger border-danger/40"
                        >
                          <Trash2 size={12} />
                          {cancelling === claim.id ? "Cancelling…" : "Cancel invite"}
                        </Button>
                      )}
                    </>
                  ) : claim.status === "pending_review" ? (
                    <>
                      <span className="text-xs text-text-secondary">
                        Recipient verified — ready to merge into their profile.
                      </span>
                      <Button
                        size="sm"
                        onClick={() => handleMerge(claim.id)}
                        disabled={merging === claim.id}
                        className="gap-1 text-xs"
                      >
                        <GitMerge size={12} />
                        {merging === claim.id ? "Merging…" : "Merge wall"}
                      </Button>
                    </>
                  ) : claim.status === "approved" ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs"
                        onClick={() => window.open(wallUrl, "_blank")}
                      >
                        <ExternalLink size={12} />
                        View Merged Wall
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs text-danger border-danger/40"
                        onClick={() => handleReverse(claim.id)}
                        disabled={reversing === claim.id}
                      >
                        <Undo2 size={12} />
                        {reversing === claim.id ? "Reversing…" : "Reverse claim"}
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
        <p className="font-semibold mb-1">💡 Invitation Lifecycle</p>
        <ul className="list-disc list-inside space-y-0.5 text-blue-800 text-xs">
          <li>
            <strong>Pending:</strong> Link sent, awaiting recipient to sign up
          </li>
          <li>
            <strong>Review:</strong> Recipient verified, awaiting admin merge
          </li>
          <li>
            <strong>Claimed:</strong> Wall successfully merged and linked
          </li>
          <li>
            <strong>Reversed:</strong> Admin reversed the claim (fraud or error)
          </li>
        </ul>
      </div>

      <ConfirmDialog
        open={!!pendingCancel}
        title="Cancel this invitation?"
        message={`Cancel the invite to ${pendingCancel?.contact_email || "this recipient"}? This can't be undone.`}
        confirmLabel="Cancel invite"
        cancelLabel="Keep invite"
        loading={!!pendingCancel && cancelling === pendingCancel.id}
        onConfirm={confirmCancel}
        onCancel={() => setPendingCancel(null)}
      />
      <ConfirmDialog
        open={!!pendingMerge}
        title="Merge this wall?"
        message={<span className="whitespace-pre-line">{pendingMerge?.summary}</span>}
        confirmLabel="Merge wall"
        loading={!!pendingMerge && merging === pendingMerge.claimId}
        onConfirm={confirmMerge}
        onCancel={() => setPendingMerge(null)}
      />
      <PromptDialog
        open={!!pendingReverse}
        title="Reverse this claim?"
        message="This restores the original wall owner and moves all content back. Give a reason for the audit trail."
        placeholder="Reason for reversing this claim…"
        confirmLabel="Reverse claim"
        loading={!!pendingReverse && reversing === pendingReverse}
        onConfirm={confirmReverse}
        onCancel={() => setPendingReverse(null)}
      />
    </Card>
  );
}
