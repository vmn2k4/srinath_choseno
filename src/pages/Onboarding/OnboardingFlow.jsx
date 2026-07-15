import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import StepRole from './StepRole';
import StepLocation from './StepLocation';
import StepUsername from './StepUsername';
import StepPolitician from './StepPolitician';

export default function OnboardingFlow() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    role: '', // 'citizen' or 'politician'
    country: 'Canada',
    constituency: '',
    lat: '',
    lng: '',
    polling_district_id: null,
    federal_boundary_id: null,
    boundaryName: '',
    fullName: '',
    // Politician specifics
    politicalTargetRole: '',
    politicalParty: '',
    bio: ''
  });

  const nextStep = () => setCurrentStep(prev => prev + 1);
  const prevStep = () => setCurrentStep(prev => prev - 1);

  const updateData = (newData) => {
    setFormData(prev => ({ ...prev, ...newData }));
  };

  const submitOnboarding = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Update Profiles Table
      const finalRole = formData.role === 'citizen' ? 'normal' : formData.role;
      const { error: profileError } = await supabase.from('profiles').update({
        role: finalRole,
        full_name: formData.fullName || null,
        country: formData.country,
        constituency: formData.boundaryName || formData.constituency
      }).eq('id', user.id);
      if (profileError) throw profileError;

      // 2. Update User Locations Table
      if (formData.polling_district_id || formData.federal_boundary_id) {
        const { error: locError } = await supabase.from('user_locations').upsert({
          profile_id: user.id,
          polling_district_id: formData.polling_district_id,
          federal_boundary_id: formData.federal_boundary_id
        });
        if (locError) throw locError;
      }

      // 3. Update Politician Profiles (if applicable)
      if (formData.role === 'politician') {
        const { error: polError } = await supabase.from('politician_profiles').upsert({
          id: user.id,
          political_target_role: formData.politicalTargetRole,
          target_boundary_type: formData.politicalTargetRole.includes('Federal') ? 'Federal' : 'Provincial',
          target_boundary_id: formData.federal_boundary_id, // Defaulting for MVP
          target_boundary_name: formData.boundaryName,
          political_party: formData.politicalParty,
          bio: formData.bio
        });
        if (polError) throw polError;
      }

      // Success! Reload window to refresh auth context and redirect to feed
      window.location.href = '/feed';
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save profile.");
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <StepRole data={formData} updateData={updateData} nextStep={nextStep} />;
      case 2:
        return <StepLocation data={formData} updateData={updateData} nextStep={nextStep} prevStep={prevStep} />;
      case 3:
        if (formData.role === 'citizen') {
          return <StepUsername data={formData} updateData={updateData} nextStep={submitOnboarding} prevStep={prevStep} loading={loading} error={error} isLastStep={true} />;
        }
        return <StepUsername data={formData} updateData={updateData} nextStep={nextStep} prevStep={prevStep} />;
      case 4:
        return <StepPolitician data={formData} updateData={updateData} nextStep={submitOnboarding} prevStep={prevStep} loading={loading} error={error} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-surface border border-border shadow-2xl rounded-2xl overflow-hidden relative">
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 w-full h-1 bg-surface-hover">
          <div 
            className="h-full bg-primary transition-all duration-300" 
            style={{ width: `${(currentStep / (formData.role === 'citizen' ? 3 : 4)) * 100}%` }}
          />
        </div>
        
        <div className="p-8">
          {renderStep()}
        </div>
      </div>
    </div>
  );
}
