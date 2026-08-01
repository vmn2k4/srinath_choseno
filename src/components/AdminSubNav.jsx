import React from 'react';
import { Link } from 'react-router-dom';

const TABS = [
  { key: 'boundaries', label: 'Geospatial Boundaries', to: '/admin' },
  { key: 'analytics', label: 'Platform Analytics', to: '/admin/analytics' },
  { key: 'elections', label: 'Elections & Seats', to: '/admin/elections' },
  { key: 'election-admins', label: 'Seat Administrators', to: '/admin/election-admins' },
  { key: 'visualizer', label: 'Boundary Inspector', to: '/admin/visualize' },
  { key: 'theme', label: 'Site Theme', to: '/admin/theme' },
];

export default function AdminSubNav({ active, className = '' }) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {TABS.map(tab => (
        tab.key === active ? (
          <span key={tab.key} className="px-4 py-2 rounded-xl text-sm font-semibold text-primary bg-primary/10 border border-primary/30">
            {tab.label}
          </span>
        ) : (
          <Link key={tab.key} to={tab.to} className="px-4 py-2 rounded-xl text-sm font-semibold text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors">
            {tab.label}
          </Link>
        )
      ))}
    </div>
  );
}
