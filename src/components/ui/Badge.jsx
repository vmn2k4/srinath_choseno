import React from 'react';

// Centralized badge/status-pill recipe — covers every status/role/type label
// in the app (election status, candidate status, "you"/"owner" markers,
// boundary type tags, etc.), which previously had 7+ incompatible one-off
// variants (font size, radius, padding, and case all drifted independently).
const TONES = {
  primary: 'bg-primary/20 text-primary-light',
  accent: 'bg-accent/20 text-accent-hover',
  amber: 'bg-amber-500/20 text-amber-300',
  emerald: 'bg-emerald-500/20 text-emerald-300',
  rose: 'bg-danger/20 text-rose-300',
  neutral: 'bg-surface-active text-text-muted',
};

const SIZES = {
  xs: 'text-[10px] px-1.5 py-0.5',
  sm: 'text-xs px-2.5 py-1',
};

export default function Badge({
  tone = 'neutral',
  shape = 'rounded',
  size = 'xs',
  uppercase = true,
  icon,
  className = '',
  children,
}) {
  const shapeClass = shape === 'pill' ? 'rounded-full' : 'rounded';
  const caseClass = uppercase ? 'uppercase tracking-wider' : '';

  return (
    <span
      className={`inline-flex items-center gap-1 font-bold whitespace-nowrap ${caseClass} ${TONES[tone] || TONES.neutral} ${SIZES[size] || SIZES.xs} ${shapeClass} ${className}`.trim()}
    >
      {icon}
      {children}
    </span>
  );
}
