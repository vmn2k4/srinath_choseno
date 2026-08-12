"use client";

import React from "react";
import { Mail, Clock, CheckCircle2, AlertCircle, ExternalLink, GitMerge, Undo2, Trash2, History } from "lucide-react";
import { Button, Badge } from "@/components/primitives";
import Link from "next/link";

export interface RecentOfficeholderClaimRow {
  claim_id: string;
  office_holder_id: string;
  office_holder_name: string;
  wall_slug: string | null;
  status: string;
  contact_email: string | null;
  is_self_requested: boolean;
  invited_at: string | null;
  claimed_at: string | null;
  approved_at: string | null;
  reversed_at: string | null;
  reversal_reason: string | null;
  created_at: string;
  invite_expires_at: string | null;
}

interface RecentOfficeholderInvitationsProps {
  claims: RecentOfficeholderClaimRow[];
  loading: boolean;
  resendingId: string | null;
  cancellingId: string | null;
  mergingId: string | null;
  reversingId: string | null;
  onResend: (claim: RecentOfficeholderClaimRow) => void;
  onCancel: (claim: RecentOfficeholderClaimRow) => void;
  onMerge: (claim: RecentOfficeholderClaimRow) => void;
  onReverse: (claim: RecentOfficeholderClaimRow) => void;
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  invited: { color: "bg-blue-100 text-blue-800", icon: <Mail size={11} />, label: "Pending" },
  pending_review: { color: "bg-yellow-100 text-yellow-800", icon: <Clock size={11} />, label: "Review" },
  approved: { color: "bg-green-100 text-green-800", icon: <CheckCircle2 size={11} />, label: "Claimed" },
  reversed: { color: "bg-red-100 text-red-800", icon: <AlertCircle size={11} />, label: "Reversed" },
  rejected: { color: "bg-red-100 text-red-800", icon: <AlertCircle size={11} />, label: "Rejected" },
  expired: { color: "bg-gray-100 text-gray-800", icon: <Clock size={11} />, label: "Expired" },
};

const formatDate = (date: string | null) => {
  if (!date) return null;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/**
 * Persistent, cross-wall feed of recent officeholder claims — one compact
 * row per invite. Unlike InvitationHistoryPanel (which only renders while
 * the admin has a specific wall looked up in transient client state), this
 * list is fetched fresh from list_recent_officeholder_wall_claims on every
 * page load, so a just-sent invite and its status stay visible after a
 * refresh instead of disappearing.
 */
export function RecentOfficeholderInvitations({
  claims,
  loading,
  resendingId,
  cancellingId,
  mergingId,
  reversingId,
  onResend,
  onCancel,
  onMerge,
  onReverse,
}: RecentOfficeholderInvitationsProps) {
  return (
    <div className="rounded-xl border border-border-light/40 bg-surface/40 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-light/30 bg-surface/60">
        <History size={13} className="text-text-muted" />
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide">
          Recent invitations
        </h3>
        <span className="text-[11px] text-text-tertiary ml-auto">
          {loading ? "Loading…" : `${claims.length} shown`}
        </span>
      </div>

      {!loading && claims.length === 0 && (
        <p className="text-sm text-text-muted italic px-3 py-4">No invitations sent yet.</p>
      )}

      <div className="divide-y divide-border-light/20">
        {claims.map((claim) => {
          const status = STATUS_CONFIG[claim.status] || STATUS_CONFIG.invited;
          const wallHref = claim.wall_slug ? `/wall/${claim.wall_slug}` : null;
          const dateLabel =
            claim.status === "approved"
              ? claim.approved_at && `Approved ${formatDate(claim.approved_at)}`
              : claim.status === "pending_review"
                ? claim.claimed_at && `Claimed ${formatDate(claim.claimed_at)}`
                : claim.status === "reversed"
                  ? claim.reversed_at && `Reversed ${formatDate(claim.reversed_at)}`
                  : claim.invited_at && `Sent ${formatDate(claim.invited_at)}`;
          const expiryLabel =
            (claim.status === "invited") && claim.invite_expires_at
              ? `expires ${formatDate(claim.invite_expires_at)}`
              : null;

          return (
            <div
              key={claim.claim_id}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface/60 flex-wrap sm:flex-nowrap"
              title={claim.reversal_reason ? `Reversal reason: ${claim.reversal_reason}` : undefined}
            >
              <Badge className={`${status.color} flex items-center gap-1 text-[11px] shrink-0`}>
                {status.icon}
                {status.label}
              </Badge>

              {wallHref ? (
                <Link
                  href={wallHref}
                  target="_blank"
                  className="font-medium text-text-main hover:text-primary hover:underline truncate max-w-[9rem] sm:max-w-[12rem] shrink-0"
                >
                  {claim.office_holder_name}
                </Link>
              ) : (
                <span className="font-medium text-text-main truncate max-w-[9rem] sm:max-w-[12rem] shrink-0">
                  {claim.office_holder_name}
                </span>
              )}

              <span className="text-text-muted truncate flex-1 min-w-[8rem]">
                {claim.contact_email || "—"}
              </span>

              {claim.is_self_requested && (
                <span className="text-[10px] uppercase tracking-wide text-text-tertiary shrink-0">
                  self-requested
                </span>
              )}

              <span className="text-[11px] text-text-tertiary shrink-0 whitespace-nowrap">
                {dateLabel}
                {expiryLabel && ` · ${expiryLabel}`}
              </span>

              <div className="flex gap-1 shrink-0 ml-auto">
                {(claim.status === "invited" || claim.status === "expired") && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onResend(claim)}
                      disabled={resendingId === claim.claim_id}
                      className="h-7 px-2 text-[11px] gap-1"
                      title="Resend invitation email"
                    >
                      <Mail size={11} />
                      {resendingId === claim.claim_id ? "…" : "Resend"}
                    </Button>
                    {claim.status === "invited" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onCancel(claim)}
                        disabled={cancellingId === claim.claim_id}
                        className="h-7 px-2 text-[11px] gap-1 text-danger border-danger/40"
                        title="Cancel this invitation"
                      >
                        <Trash2 size={11} />
                        Cancel
                      </Button>
                    )}
                  </>
                )}
                {claim.status === "pending_review" && (
                  <Button
                    size="sm"
                    onClick={() => onMerge(claim)}
                    disabled={mergingId === claim.claim_id}
                    className="h-7 px-2 text-[11px] gap-1"
                    title="Merge wall into claimant's profile"
                  >
                    <GitMerge size={11} />
                    {mergingId === claim.claim_id ? "Merging…" : "Merge"}
                  </Button>
                )}
                {claim.status === "approved" && (
                  <>
                    {wallHref && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(wallHref, "_blank")}
                        className="h-7 px-2 text-[11px] gap-1"
                        title="View merged wall"
                      >
                        <ExternalLink size={11} />
                        View
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onReverse(claim)}
                      disabled={reversingId === claim.claim_id}
                      className="h-7 px-2 text-[11px] gap-1 text-danger border-danger/40"
                      title="Reverse this claim"
                    >
                      <Undo2 size={11} />
                      {reversingId === claim.claim_id ? "…" : "Reverse"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
