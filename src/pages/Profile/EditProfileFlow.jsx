import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import StepLocation from '../Onboarding/StepLocation';
import StepPolitician from '../Onboarding/StepPolitician';
import { upsertProfileCore, upsertPoliticianProfile } from '../../services/profile';
import { Button, Input, Modal } from '../../components/ui';

// ─── Step 1: Basic Info ──────────────────────────────────────────
// lockToPolitician: true when the account was already a politician before
// this edit started. A politician profile can accumulate real state
// elsewhere (candidacies, a public wall, supporters) that has no meaning
// for a citizen account — downgrading is a one-way door the backend
// enforces too (guard_politician_role_downgrade trigger), this just keeps
// the picker from offering an option that would fail.
function StepBasicInfo({ data, updateData, nextStep, lockToPolitician }) {
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
        <Input
          type="text"
          value={data.fullName}
          onChange={e => updateData({ fullName: e.target.value })}
          placeholder={data.role === 'politician' ? 'e.g. Jane Doe' : 'e.g. Alex — private to your profile'}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-tertiary mb-3">Account Type</label>
        {lockToPolitician ? (
          <div className="p-4 rounded-xl border-2 border-primary bg-primary/10 text-left">
            <p className="font-bold text-text-main">Politician</p>
            <p className="text-xs text-text-muted mt-0.5">Public representative or candidate — this can't be switched back to a citizen account.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        )}
      </div>

      <div className="flex justify-end pt-2">
        <Button size="lg" onClick={nextStep} disabled={!canContinue}>
          Continue →
        </Button>
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
    politicalParty: initialData.politicalPartyId || '',
    education: initialData.education || '',
    hometown: initialData.hometown || '',
    bio: initialData.bio || '',
    avatarUrl: initialData.avatarUrl || ''
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
      const { error: profErr } = await upsertProfileCore(user.id, {
        role: formData.role,
        fullName: formData.fullName,
        country: derivedCountry,
        constituency: matchedNames
      });
      if (profErr) throw profErr;

      if (formData.role === 'politician') {
        const primaryBoundary = formData.matchedBoundaries?.[0];
        const { error: polErr } = await upsertPoliticianProfile(user.id, {
          targetBoundaryId: primaryBoundary ? String(primaryBoundary.id) : undefined,
          targetBoundaryName: matchedNames,
          politicalPartyId: formData.politicalParty,
          education: formData.education,
          hometown: formData.hometown,
          bio: formData.bio,
          avatarUrl: formData.avatarUrl
        }, initialData.target_boundary_id);
        if (polErr) throw polErr;
      }

      onComplete(formData);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const renderStep = () => {
    if (step === 1) return <StepBasicInfo data={formData} updateData={updateData} nextStep={() => setStep(2)} lockToPolitician={initialData.role === 'politician'} />;
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
    <Modal className="bg-surface/90 elevation-4 border border-border rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
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
        <Button variant="icon" onClick={onCancel}>
          <X size={20} />
        </Button>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-surface-hover">
        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${(step / totalSteps) * 100}%` }} />
      </div>

      {/* Step Content */}
      <div className="p-6 overflow-y-auto flex-1">
        {renderStep()}
      </div>
    </Modal>
  );
}
