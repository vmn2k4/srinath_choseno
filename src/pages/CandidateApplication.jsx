import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import VideoRecorder from '../components/video/VideoRecorder';
import {
  getCandidateById, getElectionQuestions, getCandidateAnswers, updateCandidateStatement,
  upsertCandidateAnswer, updateCandidateIntroVideoUrl, submitCandidateApplication
} from '../services/elections';
import { ArrowLeft, Send, Video, RefreshCw } from 'lucide-react';
import { Card, Button, Badge, Textarea, Spinner } from '../components/ui';

const STATUS_COPY = {
  pending: { label: 'Pending Review', tone: 'amber' },
  approved: { label: 'Approved', tone: 'emerald' },
  rejected: { label: 'Not Approved', tone: 'rose' }
};

export default function CandidateApplication() {
  const { candidateId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [candidate, setCandidate] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({}); // question_id -> { optionId, context }
  const [statement, setStatement] = useState('');
  const [introVideoUrl, setIntroVideoUrl] = useState(null);
  const [showRecorder, setShowRecorder] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    const { data: c } = await getCandidateById(candidateId);

    if (!c || c.politician_id !== user.id) {
      setCandidate(null);
      setLoading(false);
      return;
    }
    setCandidate(c);
    setStatement(c.statement || '');
    setIntroVideoUrl(c.intro_video_url || null);

    const electionId = c.election_seats?.elections?.id;
    if (electionId) {
      const { data: qs } = await getElectionQuestions(electionId);
      setQuestions((qs || []).map(q => ({
        ...q,
        election_question_options: [...(q.election_question_options || [])].sort((a, b) => a.rank - b.rank)
      })));

      const { data: existingAnswers } = await getCandidateAnswers(candidateId);
      const answerMap = {};
      (existingAnswers || []).forEach(a => {
        answerMap[a.question_id] = { optionId: a.option_id, context: a.context_text || '' };
      });
      setAnswers(answerMap);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user && candidateId) fetchAll();
  }, [user, candidateId]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveStatement = async () => {
    await updateCandidateStatement(candidateId, statement);
  };

  const selectOption = async (questionId, optionId) => {
    const context = answers[questionId]?.context || null;
    setAnswers(prev => ({ ...prev, [questionId]: { optionId, context } }));
    await upsertCandidateAnswer(candidateId, questionId, optionId, context);
  };

  const updateContext = (questionId, text) => {
    setAnswers(prev => ({ ...prev, [questionId]: { ...(prev[questionId] || {}), context: text } }));
  };

  const saveContext = async (questionId) => {
    const a = answers[questionId];
    if (!a?.optionId) return;
    await upsertCandidateAnswer(candidateId, questionId, a.optionId, a.context || null);
  };

  const handleVideoUploaded = async (url) => {
    setIntroVideoUrl(url);
    setShowRecorder(false);
    await updateCandidateIntroVideoUrl(candidateId, url);
  };

  const missingRequired = questions.filter(q => q.required && !answers[q.id]?.optionId);
  const canSubmit = missingRequired.length === 0 && !!introVideoUrl;

  const handleSubmit = async () => {
    setSubmitting(true);
    setStatus('');
    await saveStatement();
    const { data, error } = await submitCandidateApplication(candidateId);
    setSubmitting(false);
    if (error) {
      setStatus('Error: ' + error.message);
      return;
    }
    if (data?.status === 'rejected') {
      setStatus('Application updated. This application was previously not approved — contact an admin if you believe this should change.');
      fetchAll();
      return;
    }
    navigate(`/candidacy/${candidateId}`);
  };

  if (loading) {
    return <Spinner fullPage />;
  }

  if (!candidate) {
    return <div className="w-full text-center py-20 text-text-muted">Application not found.</div>;
  }

  const seat = candidate.election_seats;
  const statusInfo = STATUS_COPY[candidate.status];

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8">
      <div className="w-full min-w-0 max-w-3xl mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-text-muted hover:text-text-secondary mb-6 transition-colors">
          <ArrowLeft size={16} /> Back
        </button>

        <Card className="mb-8">
          <p className="text-xs text-text-muted mb-1">{seat?.elections?.name} · {seat?.elections?.election_date}</p>
          <h1 className="text-xl font-bold text-text-main">{seat?.role_title} — {seat?.map_shapes?.name}</h1>

          {candidate.submitted_at ? (
            <div className="mt-3 flex items-center gap-2">
              <Badge tone={statusInfo.tone} size="sm">{statusInfo.label}</Badge>
              <span className="text-xs text-text-muted">Submitted {new Date(candidate.submitted_at).toLocaleDateString()} — you can still edit and resubmit below.</span>
            </div>
          ) : (
            <p className="mt-3 text-xs text-warning-light">Not submitted yet — fill out the questionnaire and upload an intro video, then submit for review.</p>
          )}
        </Card>

        <Card className="mb-6 space-y-3">
          <label className="block text-sm font-semibold text-text-secondary">Why are you running?</label>
          <Textarea
            value={statement}
            onChange={e => setStatement(e.target.value)}
            onBlur={saveStatement}
            placeholder="Introduce yourself and your platform — shown on your campaign page..."
            rows={4}
          />
        </Card>

        {questions.length > 0 && (
          <Card className="mb-6 space-y-6">
            <h2 className="text-lg font-bold text-text-main">Candidate Questionnaire</h2>
            {questions.map((q, i) => (
              <div key={q.id} className="pb-5 border-b border-border-light/20 last:border-0 last:pb-0">
                <p className="text-sm font-semibold text-text-secondary mb-3">
                  {i + 1}. {q.question_text} {q.required && <span className="text-danger">*</span>}
                </p>
                <div className="space-y-2">
                  {q.election_question_options.map(o => (
                    <label key={o.id} className="flex items-center gap-2.5 text-sm text-text-tertiary cursor-pointer">
                      <input
                        type="radio"
                        name={`question-${q.id}`}
                        checked={answers[q.id]?.optionId === o.id}
                        onChange={() => selectOption(q.id, o.id)}
                        className="accent-primary"
                      />
                      {o.option_text}
                    </label>
                  ))}
                </div>
                {q.allow_context && answers[q.id]?.optionId && (
                  <Textarea
                    value={answers[q.id]?.context || ''}
                    onChange={e => updateContext(q.id, e.target.value)}
                    onBlur={() => saveContext(q.id)}
                    placeholder="Optional: add written context for your answer..."
                    rows={2}
                    size="sm"
                    className="mt-2.5 text-xs"
                  />
                )}
              </div>
            ))}
          </Card>
        )}

        <Card className="mb-6 space-y-3">
          <h2 className="text-lg font-bold text-text-main flex items-center gap-2"><Video size={18} className="text-primary" /> Introductory Campaign Video <span className="text-danger">*</span></h2>
          <p className="text-xs text-text-muted">Introduce yourself, your background, and why you're running.</p>

          {introVideoUrl && !showRecorder && (
            <div>
              <video src={introVideoUrl} controls className="w-full max-h-96 rounded-xl bg-black" />
              <Button variant="secondary" size="sm" onClick={() => setShowRecorder(true)} className="mt-2">
                <RefreshCw size={13} /> Re-record
              </Button>
            </div>
          )}

          {showRecorder && (
            <VideoRecorder maxDuration={90} onVideoUploaded={handleVideoUploaded} />
          )}

          {!introVideoUrl && !showRecorder && (
            <Button onClick={() => setShowRecorder(true)}>
              <Video size={16} /> Record Intro Video
            </Button>
          )}
        </Card>

        <div className="flex items-center gap-3">
          <Button size="lg" onClick={handleSubmit} disabled={submitting || !canSubmit}>
            <Send size={16} /> {submitting ? 'Submitting...' : 'Submit Application'}
          </Button>
          {!canSubmit && (
            <p className="text-xs text-text-muted">
              {missingRequired.length > 0 ? `Answer all required questions (${missingRequired.length} left)` : 'Upload an intro video'} to submit.
            </p>
          )}
        </div>
        {status && <p className="text-sm text-primary-light mt-3">{status}</p>}
      </div>
    </div>
  );
}
