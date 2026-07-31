import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, Camera, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getPoliticalParties } from '../../services/politicalParties';
import { uploadAvatarImage } from '../../services/profile';
import { Button, Input, Textarea, Select } from '../../components/ui';

export default function StepPolitician({ data, updateData, nextStep, prevStep, loading, error }) {
  const { user } = useAuth();
  const [parties, setParties] = useState([]);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState(null);
  const country = data.matchedBoundaries?.[0]?.country || null;

  const handleAvatarSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setAvatarError('Image must be less than 5MB');

    setAvatarError(null);
    setUploadingAvatar(true);
    const { publicUrl, error: uploadError } = await uploadAvatarImage(file, user.id);
    setUploadingAvatar(false);

    if (uploadError) {
      setAvatarError('Failed to upload image. Please try again.');
      return;
    }
    updateData({ avatarUrl: publicUrl });
  };

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
          <label className="block text-sm font-medium text-text-tertiary mb-2">
            Profile Photo <span className="text-text-dark text-xs">(optional)</span>
          </label>
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 rounded-full bg-surface-hover border border-border-light flex items-center justify-center overflow-hidden shrink-0">
              {data.avatarUrl ? (
                <img src={data.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <Camera size={20} className="text-text-muted" />
              )}
              {uploadingAvatar && (
                <div className="absolute inset-0 bg-surface/70 flex items-center justify-center">
                  <RefreshCw size={16} className="animate-spin text-text-muted" />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input type="file" accept="image/*" id="avatar-upload" className="hidden" onChange={handleAvatarSelect} />
              <label htmlFor="avatar-upload">
                <Button as="span" variant="outline" size="sm" className="cursor-pointer">
                  {data.avatarUrl ? 'Replace Photo' : 'Upload Photo'}
                </Button>
              </label>
              {data.avatarUrl && (
                <Button variant="ghost" size="sm" onClick={() => updateData({ avatarUrl: '' })}>
                  Remove
                </Button>
              )}
            </div>
          </div>
          {avatarError && <p className="text-danger-light text-xs mt-2">{avatarError}</p>}
        </div>

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
