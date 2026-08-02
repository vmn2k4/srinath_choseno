import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import VideoRecorder from '../components/video/VideoRecorder';
import {
  getCandidateById, getElectionQuestions, getCandidateAnswers, updateCandidateStatement,
  upsertCandidateAnswer, setCandidateAnswerOptions, updateCandidateIntroVideoUrl, submitCandidateApplication
} from '../services/elections';
import { RATING_SCALE } from '../utils/ratingScale';
import { ArrowLeft, Send, Video, RefreshCw } from 'lucide-react';
import { Card, Button, Badge, Textarea, Spinner } from '../components/ui';

const STATUS_COPY = {
  pending: { label: 'Pending Review', tone: 'amber' },
  approved: { label: 'Approved', tone: 'emerald' },
  rejected: { label: 'Not Approved', tone: 'rose' }
};

// Whether the candidate has put down anything at all for this question yet
// -- gates showing the "add context"/"add video" affordances (there's
// nothing to elaborate on until there's an answer) and, mirrored
// server-side in submit_candidate_application, whether a required question
// counts as answered.
function hasStartedAnswering(question, answer) {
  if (!answer) return false;
  switch (question.question_type) {
    case 'multiple_choice': return (answer.optionIds || []).length > 0;
    case 'text': return !!answer.textAnswer?.trim();
    case 'rating': return answer.ratingValue != null;
    default: return !!answer.optionId;
  }
}

export default function CandidateApplication() {
  const { candidateId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [candidate, setCandidate] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({}); // question_id -> { answerId, optionId, optionIds, textAnswer, ratingValue, context, videoUrl }
  const [statement, setStatement] = useState('');
  const [introVideoUrl, setIntroVideoUrl] = useState(null);
  const [showRecorder, setShowRecorder] = useState(false);
  const [recordingForQuestion, setRecordingForQuestion] = useState(null); // question_id currently showing its VideoRecorder
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
        answerMap[a.question_id] = {
          answerId: a.id,
          optionId: a.option_id,
          optionIds: (a.election_candidate_answer_options || []).map(o => o.option_id),
          textAnswer: a.text_answer || '',
          ratingValue: a.rating_value,
          context: a.context_text || '',
          videoUrl: a.video_url || null
        };
      });
      setAnswers(answerMap);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user && candidateId) fetchAll();
  }, [user?.id, candidateId]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveStatement = async () => {
    await updateCandidateStatement(candidateId, statement);
  };

  // Every save writes the whole election_candidate_answers row (option_id,
  // text_answer, rating_value, context_text, video_url together), so this
  // merges `overrides` onto whatever's already known for the question before
  // persisting -- otherwise e.g. saving a context edit would null out the
  // rating/option that was already picked. For multiple_choice questions,
  // also syncs the selected-options junction table once the row's id is
  // known (it's only assigned by the DB on first insert).
  const persistAnswer = async (questionId, overrides = {}) => {
    const question = questions.find(q => q.id === questionId);
    const merged = { ...(answers[questionId] || {}), ...overrides };
    setAnswers(prev => ({ ...prev, [questionId]: merged }));

    const { data: row } = await upsertCandidateAnswer(candidateId, questionId, {
      optionId: merged.optionId || null,
      textAnswer: merged.textAnswer || null,
      ratingValue: merged.ratingValue ?? null,
      contextText: merged.context || null,
      videoUrl: merged.videoUrl || null
    });

    const answerId = row?.id;
    if (answerId && answerId !== merged.answerId) {
      setAnswers(prev => ({ ...prev, [questionId]: { ...prev[questionId], answerId } }));
    }
    if (question?.question_type === 'multiple_choice' && answerId) {
      await setCandidateAnswerOptions(answerId, merged.optionIds || []);
    }
  };

  const selectOption = (questionId, optionId) => persistAnswer(questionId, { optionId });

  const toggleMultiOption = (questionId, optionId) => {
    const current = answers[questionId]?.optionIds || [];
    const next = current.includes(optionId) ? current.filter(id => id !== optionId) : [...current, optionId];
    persistAnswer(questionId, { optionIds: next });
  };

  const selectRating = (questionId, value) => persistAnswer(questionId, { ratingValue: value });

  const updateTextAnswer = (questionId, text) => {
    setAnswers(prev => ({ ...prev, [questionId]: { ...(prev[questionId] || {}), textAnswer: text } }));
  };
  const saveTextAnswer = (questionId) => persistAnswer(questionId, {});

  const updateContext = (questionId, text) => {
    setAnswers(prev => ({ ...prev, [questionId]: { ...(prev[questionId] || {}), context: text } }));
  };
  const saveContext = (questionId) => persistAnswer(questionId, {});

  const handleQuestionVideoUploaded = (questionId, url) => {
    setRecordingForQuestion(null);
    persistAnswer(questionId, { videoUrl: url });
  };

  const handleVideoUploaded = async (url) => {
    setIntroVideoUrl(url);
    setShowRecorder(false);
    await updateCandidateIntroVideoUrl(candidateId, url);
  };

  const missingRequired = questions.filter(q => q.required && !hasStartedAnswering(q, answers[q.id]));
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
            {questions.map((q, i) => {
              const a = answers[q.id] || {};
              const answered = hasStartedAnswering(q, a);
              return (
                <div key={q.id} className="pb-5 border-b border-border-light/20 last:border-0 last:pb-0">
                  <p className="text-sm font-semibold text-text-secondary mb-3">
                    {i + 1}. {q.question_text} {q.required && <span className="text-danger">*</span>}
                  </p>

                  {q.question_type === 'text' ? (
                    <Textarea
                      value={a.textAnswer || ''}
                      onChange={e => updateTextAnswer(q.id, e.target.value)}
                      onBlur={() => saveTextAnswer(q.id)}
                      placeholder="Your answer..."
                      rows={3}
                    />
                  ) : q.question_type === 'rating' ? (
                    <div className="flex items-center gap-2">
                      {RATING_SCALE.map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => selectRating(q.id, n)}
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                            a.ratingValue === n
                              ? 'bg-primary text-text-on-primary border-primary'
                              : 'border-border-light text-text-muted hover:border-primary/50'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  ) : q.question_type === 'multiple_choice' ? (
                    <div className="space-y-2">
                      {q.election_question_options.map(o => (
                        <label key={o.id} className="flex items-center gap-2.5 text-sm text-text-tertiary cursor-pointer">
                          <input
                            type="checkbox"
                            checked={(a.optionIds || []).includes(o.id)}
                            onChange={() => toggleMultiOption(q.id, o.id)}
                            className="accent-primary"
                          />
                          {o.option_text}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {q.election_question_options.map(o => (
                        <label key={o.id} className="flex items-center gap-2.5 text-sm text-text-tertiary cursor-pointer">
                          <input
                            type="radio"
                            name={`question-${q.id}`}
                            checked={a.optionId === o.id}
                            onChange={() => selectOption(q.id, o.id)}
                            className="accent-primary"
                          />
                          {o.option_text}
                        </label>
                      ))}
                    </div>
                  )}

                  {q.allow_context && answered && (
                    <Textarea
                      value={a.context || ''}
                      onChange={e => updateContext(q.id, e.target.value)}
                      onBlur={() => saveContext(q.id)}
                      placeholder="Optional: add written context for your answer..."
                      rows={2}
                      size="sm"
                      className="mt-2.5 text-xs"
                    />
                  )}

                  {answered && (
                    <div className="mt-2.5">
                      {a.videoUrl && recordingForQuestion !== q.id ? (
                        <div>
                          <video src={a.videoUrl} controls className="w-full max-h-56 rounded-lg bg-black" />
                          <Button variant="secondary" size="sm" onClick={() => setRecordingForQuestion(q.id)} className="mt-2">
                            <RefreshCw size={13} /> Re-record
                          </Button>
                        </div>
                      ) : recordingForQuestion === q.id ? (
                        <VideoRecorder maxDuration={60} onVideoUploaded={url => handleQuestionVideoUploaded(q.id, url)} />
                      ) : (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setRecordingForQuestion(q.id)}>
                          <Video size={13} /> Add a video for this answer (optional)
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
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
