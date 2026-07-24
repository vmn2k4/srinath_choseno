import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import StepLocation from '../Onboarding/StepLocation';
import StepPolitician from '../Onboarding/StepPolitician';

const POLITICAL_ROLES = [
  { label: 'Prime Minister / President', type: 'Country' },
  { label: 'Member of Parliament (MP) / Senator', type: 'Federal' },
  { label: 'MLA / MPP / Governor', type: 'Provincial' },
  { label: 'Mayor / County Executive', type: 'Municipal' },
  { label: 'City Councilor', type: 'City Ward' }
];

// ─── Step 1: Basic Info ──────────────────────────────────────────
function StepBasicInfo({ data, updateData, nextStep }) {
  const canContinue = data.role && (data.role !== 'politician' || data.fullName?.trim());

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h3 className="text-xl font-bold text-text-main mb-1">Basic Info</h3>
        <p className="text-sm text-text-muted">Update your name and account type.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-tertiary mb-2">
          {data.role === 'politician' ? 'Full Public Name' : 'Display Name'}
          {data.role !== 'politician' && <span className="text-text-dark text-xs ml-1">(optional)</span>}
        </label>
        <input
          type="text"
          value={data.fullName}
          onChange={e => updateData({ fullName: e.target.value })}
          placeholder={data.role === 'politician' ? 'e.g. Jane Doe' : 'e.g. Alex — private to your profile'}
          className="w-full bg-surface border border-border-light rounded-xl p-3 text-text-main outline-none focus:border-primary transition-colors"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-tertiary mb-3">Account Type</label>
        <div className="grid grid-cols-2 gap-3">
          {[{ val: 'normal', label: 'Citizen', desc: 'Anonymous community member' },
            { val: 'politician', label: 'Politician', desc: 'Public representative or candidate' }
          ].map(({ val, label, desc }) => (
            <button key={val} type="button" onClick={() => updateData({ role: val })}
              className={`p-4 rounded-xl border-2 text-left transition-all ${data.role === val
                ? (val === 'politician' ? 'border-primary bg-primary/10' : 'border-accent bg-accent/10')
                : 'border-border hover:border-border-light bg-surface-hover'
              }`}>
              <p className="font-bold text-text-main">{label}</p>
              <p className="text-xs text-text-muted mt-0.5">{desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button onClick={nextStep} disabled={!canContinue}
          className="px-8 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-hover transition-colors disabled:opacity-50">
          Continue →
        </button>
      </div>
    </div>
  );
}

// ─── Edit Profile Flow ───────────────────────────────────────────
export default function EditProfileFlow({ initialData, onComplete, onCancel }) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    role: initialData.role || 'normal',
    fullName: initialData.fullName || '',
    lat: initialData.lat || '',
    lng: initialData.lng || '',
    matchedBoundaries: initialData.matchedBoundaries || [],
    politicalTargetRole: initialData.politicalTargetRole || '',
    politicalParty: initialData.politicalParty || '',
    education: initialData.education || '',
    hometown: initialData.hometown || '',
    bio: initialData.bio || ''
  });

  const updateData = (newData) => setFormData(prev => ({ ...prev, ...newData }));

  const totalSteps = formData.role === 'politician' ? 3 : 2;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // Location itself (user_boundary_memberships + user_locations) is synced
      // directly by StepLocation via sync_user_boundary_memberships whenever the
      // user sets/changes coordinates in that step — nothing to write here.
      const matchedNames = (formData.matchedBoundaries || []).map(b => b.name).join(', ') || null;
      // Re-derive country from the (possibly just-updated) matched boundaries
      // rather than trusting a stale/hand-edited value — keeps it in sync if
      // the user's location moved to a different country.
      const derivedCountry = formData.matchedBoundaries?.[0]?.country ?? null;
      const { error: profErr } = await supabase.from('profiles').upsert({
        id: user.id,
        role: formData.role,
        full_name: formData.fullName || null,
        country: derivedCountry,
        constituency: matchedNames,
        updated_at: new Date()
      });
      if (profErr) throw profErr;

      if (formData.role === 'politician') {
        const roleObj = POLITICAL_ROLES.find(r => r.label === formData.politicalTargetRole);
        const primaryBoundary = formData.matchedBoundaries?.[0];
        const { error: polErr } = await supabase.from('politician_profiles').upsert({
          id: user.id,
          political_target_role: formData.politicalTargetRole,
          target_boundary_type: roleObj?.type || null,
          target_boundary_id: primaryBoundary ? String(primaryBoundary.id) : initialData.target_boundary_id,
          target_boundary_name: matchedNames,
          political_party: formData.politicalParty,
          education: formData.education || null,
          hometown: formData.hometown || null,
          bio: formData.bio,
          updated_at: new Date()
        });
        if (polErr) throw polErr;
      }

      onComplete(formData);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const renderStep = () => {
    if (step === 1) return <StepBasicInfo data={formData} updateData={updateData} nextStep={() => setStep(2)} />;
    if (step === 2) return (
      <StepLocation
        data={formData}
        updateData={updateData}
        nextStep={() => formData.role === 'politician' ? setStep(3) : handleSave()}
        prevStep={() => setStep(1)}
      />
    );
    if (step === 3) return (
      <StepPolitician
        data={formData}
        updateData={updateData}
        nextStep={handleSave}
        prevStep={() => setStep(2)}
        loading={saving}
        error={error}
      />
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="font-bold text-text-main text-lg">Edit Profile</h2>
            <p className="text-xs text-text-muted">Step {step} of {totalSteps}</p>
          </div>
          {/* Progress dots */}
          <div className="flex items-center gap-2">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} className={`h-2 rounded-full transition-all duration-300 ${i + 1 === step ? 'w-6 bg-primary' : i + 1 < step ? 'w-2 bg-primary/50' : 'w-2 bg-border-light'}`} />
            ))}
          </div>
          <button onClick={onCancel} className="p-2 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-surface-hover">
          <div className="h-full bg-primary transition-all duration-300" style={{ width: `${(step / totalSteps) * 100}%` }} />
        </div>

        {/* Step Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {renderStep()}
        </div>
      </div>
    </div>
  );
}
