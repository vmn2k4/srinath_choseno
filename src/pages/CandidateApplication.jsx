import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import VideoRecorder from '../components/video/VideoRecorder';
import {
  getCandidateById, getElectionQuestions, getCandidateAnswers, updateCandidateStatement,
  upsertCandidateAnswer, updateCandidateIntroVideoUrl, submitCandidateApplication
} from '../services/elections';
import { ArrowLeft, Send, Video, RefreshCw } from 'lucide-react';

const STATUS_COPY = {
  pending: { label: 'Pending Review', className: 'bg-amber-500/20 text-amber-300' },
  approved: { label: 'Approved', className: 'bg-emerald-500/20 text-emerald-300' },
  rejected: { label: 'Not Approved', className: 'bg-danger/20 text-rose-300' }
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
    setStatus(
      data?.status === 'rejected'
        ? 'Application updated. This application was previously not approved — contact an admin if you believe this should change.'
        : 'Application submitted! You are now a public candidate for this seat.'
    );
    fetchAll();
  };

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
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

        <div className="bg-surface/30 backdrop-blur-md rounded-2xl border border-border-light/45 shadow-xl mb-8 p-6">
          <p className="text-xs text-text-muted mb-1">{seat?.elections?.name} · {seat?.elections?.election_date}</p>
          <h1 className="text-xl font-bold text-text-main">{seat?.role_title} — {seat?.map_shapes?.name}</h1>

          {candidate.submitted_at ? (
            <div className="mt-3 flex items-center gap-2">
              <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${statusInfo.className}`}>{statusInfo.label}</span>
              <span className="text-xs text-text-muted">Submitted {new Date(candidate.submitted_at).toLocaleDateString()} — you can still edit and resubmit below.</span>
            </div>
          ) : (
            <p className="mt-3 text-xs text-amber-300">Not submitted yet — fill out the questionnaire and upload an intro video, then submit for review.</p>
          )}
        </div>

        <div className="bg-surface/30 backdrop-blur-md rounded-2xl border border-border-light/45 shadow-xl p-6 mb-6 space-y-3">
          <label className="block text-sm font-semibold text-text-secondary">Why are you running?</label>
          <textarea
            value={statement}
            onChange={e => setStatement(e.target.value)}
            onBlur={saveStatement}
            placeholder="Introduce yourself and your platform — shown on your campaign page..."
            rows={4}
            className="w-full bg-surface-hover border border-border-light rounded-xl p-3 text-sm text-text-main outline-none focus:border-primary resize-none"
          />
        </div>

        {questions.length > 0 && (
          <div className="bg-surface/30 backdrop-blur-md rounded-2xl border border-border-light/45 shadow-xl p-6 mb-6 space-y-6">
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
                  <textarea
                    value={answers[q.id]?.context || ''}
                    onChange={e => updateContext(q.id, e.target.value)}
                    onBlur={() => saveContext(q.id)}
                    placeholder="Optional: add written context for your answer..."
                    rows={2}
                    className="w-full mt-2.5 bg-surface-hover border border-border-light rounded-lg p-2.5 text-xs text-text-main outline-none focus:border-primary resize-none"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="bg-surface/30 backdrop-blur-md rounded-2xl border border-border-light/45 shadow-xl p-6 mb-6 space-y-3">
          <h2 className="text-lg font-bold text-text-main flex items-center gap-2"><Video size={18} className="text-primary" /> Introductory Campaign Video <span className="text-danger">*</span></h2>
          <p className="text-xs text-text-muted">Introduce yourself, your background, and why you're running.</p>

          {introVideoUrl && !showRecorder && (
            <div>
              <video src={introVideoUrl} controls className="w-full max-h-96 rounded-xl bg-black" />
              <button
                onClick={() => setShowRecorder(true)}
                className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-surface-active hover:bg-border text-text-main rounded-lg text-xs font-semibold transition-colors"
              >
                <RefreshCw size={13} /> Re-record
              </button>
            </div>
          )}

          {showRecorder && (
            <VideoRecorder maxDuration={90} onVideoUploaded={handleVideoUploaded} />
          )}

          {!introVideoUrl && !showRecorder && (
            <button
              onClick={() => setShowRecorder(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-slate-950 font-bold rounded-xl text-sm transition-colors"
            >
              <Video size={16} /> Record Intro Video
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSubmit}
            disabled={submitting || !canSubmit}
            className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-hover text-slate-950 font-bold rounded-xl text-sm transition-colors disabled:opacity-50"
          >
            <Send size={16} /> {submitting ? 'Submitting...' : 'Submit Application'}
          </button>
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
