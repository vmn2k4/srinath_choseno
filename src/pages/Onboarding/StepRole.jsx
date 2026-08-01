import React from 'react';
import { Users, Flag } from 'lucide-react';

export default function StepRole({ data, updateData, nextStep }) {
  const handleSelect = (role) => {
    updateData({ role });
    nextStep();
  };

  return (
    <div className="animate-fade-in">
      <div className="text-center mb-6 sm:mb-10">
        <h2 className="text-2xl sm:text-3xl font-bold text-text-main mb-2 sm:mb-3">Welcome to the Platform</h2>
        <p className="text-sm sm:text-base text-text-muted">How are you planning to use the network?</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <button
          onClick={() => handleSelect('citizen')}
          className={`flex flex-col items-center justify-center p-6 sm:p-8 rounded-2xl border-2 transition-all ${
            data.role === 'citizen' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary-light hover:bg-surface-hover'
          }`}
        >
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-surface-active flex items-center justify-center mb-3 sm:mb-4 text-text-secondary shrink-0">
            <Users size={28} className="sm:hidden" />
            <Users size={32} className="hidden sm:block" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-text-main mb-2">Citizen / Voter</h3>
          <p className="text-sm text-text-muted text-center">Post anonymously, vote on local issues, and connect with your verified community.</p>
        </button>

        <button
          onClick={() => handleSelect('politician')}
          className={`flex flex-col items-center justify-center p-6 sm:p-8 rounded-2xl border-2 transition-all ${
            data.role === 'politician' ? 'border-accent bg-accent/10' : 'border-border hover:border-accent-hover hover:bg-surface-hover'
          }`}
        >
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-surface-active flex items-center justify-center mb-3 sm:mb-4 text-text-secondary shrink-0">
            <Flag size={28} className="sm:hidden" />
            <Flag size={32} className="hidden sm:block" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-text-main mb-2">Candidate / Local Representative</h3>
          <p className="text-sm text-text-muted text-center">Publish video statements, file candidacy, and engage directly with verified constituents.</p>
        </button>
      </div>
    </div>
  );
}
