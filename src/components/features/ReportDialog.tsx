"use client";

import { useEffect, useState } from "react";
import { Flag } from "lucide-react";
import { Modal, Button, Radio, Spinner } from "@/components/primitives";
import { getModerationRules } from "@/lib/services/moderation";
import { createClient } from "@/lib/supabase/client";
import type { ReportTargetType } from "@/lib/services/moderation";

type ModerationRule = { abuse_type: string; label: string };

// office_holder rows are admin-entered directory data (name/role/party/
// contact info), not user-generated content -- spam/harassment/hate_speech
// don't apply to "this listing is wrong", so narrow the radio list to the
// abuse types that actually fit. Every other target type keeps the full set.
const RELEVANT_ABUSE_TYPES: Partial<Record<ReportTargetType, string[]>> = {
  office_holder: ["incorrect_info", "other"],
};

const TARGET_LABEL: Partial<Record<ReportTargetType, string>> = {
  politician_profile: "Politician",
  office_holder: "Office Holder Listing",
};

// Small presentational report modal — reused for posts, comments,
// politician profiles, and office holder directory listings. Calls the
// onReport callback the page-level client component provides (which owns
// the actual reportContent RPC call), so this stays a pure UI component per
// the layered-architecture rule that only page-level clients touch services.
export default function ReportDialog({
  targetType,
  targetId,
  onReport,
  onClose,
}: {
  targetType: ReportTargetType;
  targetId: string;
  onReport: (targetType: ReportTargetType, targetId: string, abuseType: string) => Promise<{ error?: unknown }>;
  onClose: () => void;
}) {
  const [rules, setRules] = useState<ModerationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<"success" | string | null>(null);

  const relevantTypes = RELEVANT_ABUSE_TYPES[targetType];
  const visibleRules = relevantTypes ? rules.filter((r) => relevantTypes.includes(r.abuse_type)) : rules;

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();
    getModerationRules(supabase).then(({ data }) => {
      if (!isMounted) return;
      const rows = data || [];
      setRules(rows);
      const visible = relevantTypes ? rows.filter((r) => relevantTypes.includes(r.abuse_type)) : rows;
      if (visible.length > 0) setSelected(visible[0].abuse_type);
      setLoading(false);
    });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    const { error } = await onReport(targetType, targetId, selected);
    setSubmitting(false);
    if (error) {
      const rawMsg = (error as { message?: string })?.message || "";
      // Map technical Postgres errors to user-friendly messages
      let msg = "Failed to submit report.";
      if (rawMsg.includes("permission denied") || rawMsg.includes("not authenticated")) {
        msg = "You must be signed in to submit a report.";
      } else if (rawMsg.includes("unknown") || rawMsg.includes("abuse_type")) {
        msg = "Invalid report type. Please refresh and try again.";
      } else if (rawMsg) {
        msg = rawMsg;
      }
      setResult(msg);
    } else {
      setResult("success");
    }
  };

  return (
    <Modal onOverlayClick={onClose} className="bg-surface rounded-2xl p-5 w-full max-w-sm space-y-4 shadow-xl">
      <div className="flex items-center gap-2 text-text-main font-bold">
        <Flag size={16} className="text-danger" /> Report {TARGET_LABEL[targetType] || targetType}
      </div>

      {result === "success" ? (
        <>
          <p className="text-sm text-text-secondary">Thanks — your report has been submitted for review.</p>
          <Button size="sm" onClick={onClose}>
            Close
          </Button>
        </>
      ) : loading ? (
        <Spinner />
      ) : (
        <>
          <div className="space-y-2">
            {visibleRules.map((rule) => (
              <Radio
                key={rule.abuse_type}
                id={`report-${rule.abuse_type}`}
                name="abuse_type"
                label={rule.label}
                checked={selected === rule.abuse_type}
                onChange={() => setSelected(rule.abuse_type)}
              />
            ))}
          </div>
          {result && typeof result === "string" && (
            <p className="text-xs text-danger-light">{result}</p>
          )}
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={submitting || !selected}>
              {submitting ? "Submitting..." : "Submit Report"}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
