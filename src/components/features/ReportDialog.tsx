"use client";

import { useEffect, useState } from "react";
import { Flag } from "lucide-react";
import { Modal, Button, Radio, Spinner } from "@/components/primitives";
import { getModerationRules } from "@/lib/services/moderation";
import { createClient } from "@/lib/supabase/client";
import type { ReportTargetType } from "@/lib/services/moderation";

type ModerationRule = { abuse_type: string; label: string };

// Small presentational report modal — reused for posts, comments, and
// politician profiles. Calls the onReport callback the page-level client
// component provides (which owns the actual reportContent RPC call), so
// this stays a pure UI component per the layered-architecture rule that
// only page-level clients touch services.
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

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();
    getModerationRules(supabase).then(({ data }) => {
      if (!isMounted) return;
      setRules(data || []);
      if (data && data.length > 0) setSelected(data[0].abuse_type);
      setLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    const { error } = await onReport(targetType, targetId, selected);
    setSubmitting(false);
    if (error) {
      const msg = (error as { message?: string })?.message || "Failed to submit report.";
      setResult(msg);
    } else {
      setResult("success");
    }
  };

  return (
    <Modal onOverlayClick={onClose} className="bg-surface rounded-2xl p-5 w-full max-w-sm space-y-4 shadow-xl">
      <div className="flex items-center gap-2 text-text-main font-bold">
        <Flag size={16} className="text-danger" /> Report {targetType === "politician_profile" ? "Politician" : targetType}
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
            {rules.map((rule) => (
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
