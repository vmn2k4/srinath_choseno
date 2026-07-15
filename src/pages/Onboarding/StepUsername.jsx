import React from 'react';
import { ArrowLeft, ArrowRight, ShieldAlert, CheckCircle2, User } from 'lucide-react';

export default function StepUsername({ data, updateData, nextStep, prevStep, loading, error, isLastStep }) {
  const isPolitician = data.role === 'politician';
  const canContinue = isPolitician ? data.fullName?.trim() : true;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={prevStep} className="p-2 bg-surface-hover rounded-full text-text-muted hover:text-text-main transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-text-main">
            {isPolitician ? 'Your Public Name' : 'Your Identity'}
          </h2>
          <p className="text-sm text-text-muted">
            {isPolitician ? 'This will appear on your public Wall.' : 'Choose how you appear in the platform.'}
          </p>
        </div>
      </div>

      {isPolitician ? (
        /* Politician: public name required */
        <div className="space-y-5">
          <div className="p-5 bg-surface-hover rounded-2xl border border-border flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary-light flex items-center justify-center shrink-0">
              <User size={20} />
            </div>
            <p className="text-sm text-text-muted">
              As a <strong className="text-text-secondary">Politician</strong>, your name is public and tied to your official Wall and QR code.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-tertiary mb-2">Full Public Name</label>
            <input
              type="text"
              placeholder="e.g. Jane Doe"
              value={data.fullName}
              onChange={e => updateData({ fullName: e.target.value })}
              autoFocus
              className="w-full bg-surface border border-border-light rounded-xl p-3 text-text-main outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>
      ) : (
        /* Citizen: optional preferred name + Ghost ID explanation */
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-text-tertiary mb-2">
              Display Name <span className="text-text-dark text-xs font-normal ml-1">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Alex — only visible on your Profile"
              value={data.fullName}
              onChange={e => updateData({ fullName: e.target.value })}
              className="w-full bg-surface border border-border-light rounded-xl p-3 text-text-main outline-none focus:border-primary transition-colors"
            />
            <p className="text-xs text-text-muted mt-1.5">This is only shown on your Profile settings page, never attached to your anonymous posts.</p>
          </div>

          {/* Ghost ID explainer */}
          <div className="p-5 bg-surface-hover rounded-2xl border border-border">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-11 h-11 bg-primary/20 text-primary-light rounded-xl flex items-center justify-center shrink-0">
                <ShieldAlert size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-text-main mb-0.5">The Ghost ID System</h3>
                <p className="text-text-muted text-sm">
                  All your posts are published under a cryptographically generated <strong className="text-text-secondary">Ghost ID</strong>, completely separate from your account.
                </p>
              </div>
            </div>

            <ul className="space-y-2.5">
              {[
                'Posts are 100% anonymous — no username, no avatar.',
                'Only your boundary jurisdiction is used to route your posts.',
                'You can permanently "burn" your Ghost ID at any time to start fresh.'
              ].map((text, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-text-tertiary">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-danger/10 border border-danger/30 text-danger-light rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="mt-8 flex justify-end">
        <button
          onClick={nextStep}
          disabled={loading || !canContinue}
          className="px-8 py-3 bg-primary text-white rounded-xl font-bold flex items-center gap-2 hover:bg-primary-hover transition-colors disabled:opacity-50"
        >
          {loading ? 'Processing...' : isLastStep ? 'Complete Setup' : 'Continue'}
          {!loading && !isLastStep && <ArrowRight size={18} />}
        </button>
      </div>
    </div>
  );
}
