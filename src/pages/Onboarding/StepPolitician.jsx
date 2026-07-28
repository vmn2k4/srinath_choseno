import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { getPoliticalParties } from '../../services/politicalParties';
import { Button, Input, Textarea, Select } from '../../components/ui';

export default function StepPolitician({ data, updateData, nextStep, prevStep, loading, error }) {
  const [parties, setParties] = useState([]);
  const country = data.matchedBoundaries?.[0]?.country || null;

  useEffect(() => {
    if (!country) {
      setParties([]);
      return;
    }
    let cancelled = false;
    getPoliticalParties({ country }).then(({ data: rows }) => {
      if (!cancelled) setParties(rows || []);
    });
    return () => { cancelled = true; };
  }, [country]);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="icon" onClick={prevStep} className="rounded-full">
          <ArrowLeft size={20} />
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-text-main">Political Details</h2>
          <p className="text-sm text-text-muted">
            Tell your constituents about yourself. You don't need to pick an office now —
            you can nominate yourself for any election in your area once it opens.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-text-tertiary mb-2">Political Party</label>
          <Select value={data.politicalParty || ''} onChange={e => updateData({ politicalParty: e.target.value })} disabled={!country}>
            <option value="">{country ? 'Select a party (optional)...' : 'Set your location first'}</option>
            {parties.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-tertiary mb-2">Education</label>
            <Input
              type="text"
              placeholder="e.g. B.A. Political Science"
              value={data.education || ''}
              onChange={e => updateData({ education: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-tertiary mb-2">Hometown</label>
            <Input
              type="text"
              placeholder="e.g. Surrey, BC"
              value={data.hometown || ''}
              onChange={e => updateData({ hometown: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-tertiary mb-2">Biography & Platform</label>
          <Textarea
            placeholder="Introduce yourself, your key policies, and why constituents should support you..."
            value={data.bio}
            onChange={e => updateData({ bio: e.target.value })}
            rows={4}
          />
        </div>
      </div>

      {error && <div className="mt-4 p-3 bg-danger/10 border border-danger/30 text-danger-light rounded-lg text-sm">{error}</div>}

      <div className="mt-8 flex justify-end">
        <Button size="lg" onClick={nextStep} disabled={loading}>
          {loading ? 'Finalizing Setup...' : 'Complete Setup'}
          {!loading && <CheckCircle size={18} />}
        </Button>
      </div>
    </div>
  );
}
