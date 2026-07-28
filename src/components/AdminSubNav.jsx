import React from 'react';
import { Link } from 'react-router-dom';

const TABS = [
  { key: 'boundaries', label: 'Boundaries', to: '/admin' },
  { key: 'elections', label: 'Elections', to: '/admin/elections' },
  { key: 'election-admins', label: 'Election Admins', to: '/admin/election-admins' },
  { key: 'visualizer', label: 'Visualizer', to: '/admin/visualize' },
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
