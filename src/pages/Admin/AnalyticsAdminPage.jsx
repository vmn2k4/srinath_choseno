import React from 'react';
import { BarChart2 } from 'lucide-react';
import AdminSubNav from '../../components/AdminSubNav';
import AnalyticsPanel from './AnalyticsPanel';
import { PageHeader } from '../../components/ui';

export default function AnalyticsAdminPage() {
  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 space-y-6">
      <AdminSubNav active="analytics" />

      <PageHeader
        icon={BarChart2}
        title="Platform Analytics & Engagement"
        subtitle="Real-time usage statistics: story posts, comments, audience growth, and DAU/WAU/MAU activity."
      />

      <AnalyticsPanel />
    </div>
  );
}
