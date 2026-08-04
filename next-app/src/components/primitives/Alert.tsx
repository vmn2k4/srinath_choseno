import type { ReactNode } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";

// New primitive — didn't exist in the Vite app. Found hand-rolled
// independently as a colored <p>/<div> in AuthPage, ElectionSeatPage, and
// CandidacyWall's claim-status message, each with slightly different
// tone/spacing. One shared recipe from here on.
const TONES = {
  success: {
    wrap: "bg-success/10 border-success/30 text-success",
    Icon: CheckCircle2,
  },
  danger: {
    wrap: "bg-danger/10 border-danger/30 text-danger-light",
    Icon: XCircle,
  },
  warning: {
    wrap: "bg-warning/10 border-warning/30 text-warning-light",
    Icon: AlertTriangle,
  },
  info: {
    wrap: "bg-primary/10 border-primary/30 text-primary-light",
    Icon: Info,
  },
} as const;

type AlertTone = keyof typeof TONES;

export default function Alert({
  tone = "info",
  children,
  className = "",
}: {
  tone?: AlertTone;
  children?: ReactNode;
  className?: string;
}) {
  const { wrap, Icon } = TONES[tone] || TONES.info;

  return (
    <div
      className={`flex items-start gap-2.5 text-sm font-medium px-4 py-3 rounded-xl border ${wrap} ${className}`.trim()}
      role={tone === "danger" ? "alert" : "status"}
    >
      <Icon size={16} className="shrink-0 mt-0.5" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
