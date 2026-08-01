import React from 'react';

// Icon-circle + heading + muted description empty state. Genuinely new —
// no icon-based empty state existed anywhere in the app before this; every
// "no results" box was a bare centered-text dashed rectangle.
export default function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div
      className={`text-center py-10 px-4 bg-surface/40 elevation-1 rounded-2xl border border-dashed border-border-light/80 ${className}`.trim()}
    >
      {Icon && (
        <div className="w-14 h-14 rounded-full bg-surface-hover flex items-center justify-center mx-auto mb-3">
          <Icon className="text-primary w-7 h-7" />
        </div>
      )}
      {title && <h3 className="text-text-main font-bold text-sm mb-1">{title}</h3>}
      {description && <p className="text-text-secondary text-xs leading-relaxed font-medium">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
