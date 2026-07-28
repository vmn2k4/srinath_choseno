import React from 'react';

// Centralized page-header recipe (icon + title + optional subtitle + a
// right-aligned action slot). Most pages previously invented their own intro
// with a different heading size and no consistent icon treatment.
export default function PageHeader({ icon: Icon, title, subtitle, action, size = 'default', className = '' }) {
  const titleSize = size === 'hero' ? 'text-3xl sm:text-4xl' : 'text-2xl';

  return (
    <div className={`flex items-start justify-between gap-4 flex-wrap mb-6 ${className}`.trim()}>
      <div className="flex items-center gap-3 min-w-0">
        {Icon && <Icon className="text-primary shrink-0" size={size === 'hero' ? 28 : 24} />}
        <div className="min-w-0">
          <h1 className={`${titleSize} font-bold text-text-main truncate`}>{title}</h1>
          {subtitle && <p className="text-text-muted text-sm mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
