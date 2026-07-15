import React from 'react';
import { Users, Flag } from 'lucide-react';

export default function StepRole({ data, updateData, nextStep }) {
  const handleSelect = (role) => {
    updateData({ role });
    nextStep();
  };

  return (
    <div className="animate-fade-in">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-text-main mb-3">Welcome to the Platform</h2>
        <p className="text-text-muted">How are you planning to use the network?</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button
          onClick={() => handleSelect('citizen')}
          className={`flex flex-col items-center justify-center p-8 rounded-2xl border-2 transition-all ${
            data.role === 'citizen' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary-light hover:bg-surface-hover'
          }`}
        >
          <div className="w-16 h-16 rounded-full bg-surface-active flex items-center justify-center mb-4 text-text-secondary">
            <Users size={32} />
          </div>
          <h3 className="text-xl font-bold text-text-main mb-2">General Citizen</h3>
          <p className="text-sm text-text-muted text-center">Post anonymously, vote on local issues, and connect with your community.</p>
        </button>

        <button
          onClick={() => handleSelect('politician')}
          className={`flex flex-col items-center justify-center p-8 rounded-2xl border-2 transition-all ${
            data.role === 'politician' ? 'border-accent bg-accent/10' : 'border-border hover:border-accent-hover hover:bg-surface-hover'
          }`}
        >
          <div className="w-16 h-16 rounded-full bg-surface-active flex items-center justify-center mb-4 text-text-secondary">
            <Flag size={32} />
          </div>
          <h3 className="text-xl font-bold text-text-main mb-2">Politician / Candidate</h3>
          <p className="text-sm text-text-muted text-center">Manage a public wall, share video pitches, and engage with constituents.</p>
        </button>
      </div>
    </div>
  );
}
