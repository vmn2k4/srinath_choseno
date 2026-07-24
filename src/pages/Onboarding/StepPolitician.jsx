import React from 'react';
import { ArrowLeft, CheckCircle } from 'lucide-react';

const POLITICAL_ROLES = [
  { label: 'Prime Minister / President', type: 'Country' },
  { label: 'Member of Parliament (MP) / Senator', type: 'Federal' },
  { label: 'MLA / MPP / Governor', type: 'Provincial' },
  { label: 'Mayor / County Executive', type: 'Municipal' },
  { label: 'City Councilor', type: 'City Ward' }
];

export default function StepPolitician({ data, updateData, nextStep, prevStep, loading, error }) {
  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={prevStep} className="p-2 bg-surface-hover rounded-full text-text-muted hover:text-text-main transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-text-main">Political Details</h2>
          <p className="text-sm text-text-muted">Tell your constituents about your platform.</p>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-text-tertiary mb-2">Target Role</label>
          <select 
            value={data.politicalTargetRole} 
            onChange={e => updateData({ politicalTargetRole: e.target.value })}
            className="w-full bg-surface border border-border-light rounded-xl p-3 text-text-main outline-none focus:border-primary transition-colors appearance-none"
          >
            <option value="" disabled>Select your office...</option>
            {POLITICAL_ROLES.map(r => (
              <option key={r.label} value={r.label}>{r.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-tertiary mb-2">Political Party</label>
          <input
            type="text"
            placeholder="e.g. Independent, Democratic, Conservative..."
            value={data.politicalParty}
            onChange={e => updateData({ politicalParty: e.target.value })}
            className="w-full bg-surface border border-border-light rounded-xl p-3 text-text-main outline-none focus:border-primary transition-colors"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-tertiary mb-2">Education</label>
            <input
              type="text"
              placeholder="e.g. B.A. Political Science"
              value={data.education || ''}
              onChange={e => updateData({ education: e.target.value })}
              className="w-full bg-surface border border-border-light rounded-xl p-3 text-text-main outline-none focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-tertiary mb-2">Hometown</label>
            <input
              type="text"
              placeholder="e.g. Surrey, BC"
              value={data.hometown || ''}
              onChange={e => updateData({ hometown: e.target.value })}
              className="w-full bg-surface border border-border-light rounded-xl p-3 text-text-main outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-tertiary mb-2">Biography & Platform</label>
          <textarea 
            placeholder="Introduce yourself, your key policies, and why constituents should support you..."
            value={data.bio}
            onChange={e => updateData({ bio: e.target.value })}
            rows={4}
            className="w-full bg-surface border border-border-light rounded-xl p-3 text-text-main outline-none focus:border-primary transition-colors resize-none"
          />
        </div>
      </div>

      {error && <div className="mt-4 p-3 bg-danger/10 border border-danger/30 text-danger-light rounded-lg text-sm">{error}</div>}

      <div className="mt-8 flex justify-end">
        <button 
          onClick={nextStep} 
          disabled={loading || !data.politicalTargetRole}
          className="px-8 py-3 bg-primary text-white rounded-xl font-bold flex items-center gap-2 hover:bg-primary-hover transition-colors disabled:opacity-50"
        >
          {loading ? 'Finalizing Setup...' : 'Complete Setup'} 
          {!loading && <CheckCircle size={18} />}
        </button>
      </div>
    </div>
  );
}
