import React from 'react';

// Icon-circle + heading + muted description empty state. Genuinely new —
// no icon-based empty state existed anywhere in the app before this; every
// "no results" box was a bare centered-text dashed rectangle.
export default function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div
      className={`text-center py-16 bg-surface/20 rounded-2xl border border-dashed border-border-light/60 ${className}`.trim()}
    >
      {Icon && (
        <div className="w-16 h-16 rounded-full bg-surface-hover flex items-center justify-center mx-auto mb-4">
          <Icon className="text-text-muted w-8 h-8" />
        </div>
      )}
      {title && <h3 className="text-text-tertiary font-medium mb-1">{title}</h3>}
      {description && <p className="text-text-muted text-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
