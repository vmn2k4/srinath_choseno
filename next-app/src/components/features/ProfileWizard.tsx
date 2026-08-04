import type { ReactNode } from "react";
import Card from "@/components/primitives/Card";

// Generic wizard shell — unifies OnboardingFlow.jsx's top progress bar and
// EditProfileFlow.jsx's step-dot indicator into one component with a
// `variant` prop, instead of two independently-styled progress trackers for
// what's structurally the same "step N of M" concept.
//
// Scope note: this is the shell only (progress indicator + Card frame).
// The actual step *content* — StepLocation, StepPolitician, StepRole,
// StepUsername, EditProfileFlow's StepBasicInfo — all depend on services
// not ported until Phase 4 (boundaries, profile, political parties) and on
// live browser APIs (geolocation), so those get built alongside the
// Onboarding/Profile pages in Phase 6, composed as `children` here rather
// than baked into this component.
export default function ProfileWizard({
  totalSteps,
  currentStep,
  variant = "bar",
  children,
}: {
  totalSteps: number;
  currentStep: number; // 1-indexed
  variant?: "bar" | "dots";
  children?: ReactNode;
}) {
  return (
    <Card padding="none" className="overflow-hidden">
      {variant === "bar" ? (
        <div className="h-1.5 bg-surface-hover">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 pt-6">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
            <div
              key={step}
              className={`h-2 rounded-full transition-all duration-300 ${
                step === currentStep
                  ? "w-6 bg-primary"
                  : step < currentStep
                    ? "w-2 bg-primary/50"
                    : "w-2 bg-surface-hover"
              }`}
            />
          ))}
        </div>
      )}
      <div className="p-6 sm:p-8">{children}</div>
    </Card>
  );
}
