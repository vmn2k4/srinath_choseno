import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { claimCandidacyViaToken } from '../services/elections';
import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { Card, Button, Spinner } from '../components/ui';

// Landing page for both claim-flow entry points: an admin-sent invite link
// (/claim/:token, redirected here after Supabase Auth's inviteUserByEmail
// sign-up) redeems the token immediately on load. See
// 20260802000001_candidacy_claims.sql's claim_candidacy_via_token() — this
// call also completes onboarding for a brand-new invited signup, so there's
// no separate onboarding step to route through first.
export default function ClaimCandidacy() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('claiming'); // 'claiming' | 'success' | 'error'
  const [error, setError] = useState('');
  const [candidateId, setCandidateId] = useState(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    (async () => {
      const { data, error: claimError } = await claimCandidacyViaToken(token);
      if (claimError) {
        setError(claimError.message);
        setStatus('error');
        return;
      }
      setCandidateId(data.id);
      setStatus('success');
    })();
  }, [token]);

  return (
    <div className="w-full max-w-md mx-auto animate-fade-in py-20 px-4">
      <Card padding="lg" className="text-center">
        {status === 'claiming' && (
          <>
            <Spinner />
            <p className="text-sm text-text-secondary mt-4">Claiming your candidacy...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 size={32} className="text-success mx-auto mb-3" />
            <h1 className="text-lg font-bold text-text-main mb-2">Candidacy Claimed</h1>
            <p className="text-sm text-text-secondary mb-5">
              This campaign page is now yours. You can post updates, answer questionnaire
              questions, and manage everything from here.
            </p>
            <Button onClick={() => navigate(`/candidacy/${candidateId}`)} className="w-full">
              Go to My Campaign Page
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <ShieldAlert size={32} className="text-danger mx-auto mb-3" />
            <h1 className="text-lg font-bold text-text-main mb-2">Couldn't Claim This Candidacy</h1>
            <p className="text-sm text-text-secondary mb-5">{error}</p>
            <Button variant="outline" onClick={() => navigate('/elections')} className="w-full">
              Browse Elections
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
