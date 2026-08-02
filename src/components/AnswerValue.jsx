import React from 'react';
import { RATING_SCALE } from '../utils/ratingScale';

// Renders just the "value" of a candidate's answer to a questionnaire
// question -- the selected option, the set of checked options, the written
// text, or the rating dots -- branching on election_questions.question_type
// (see 20260802000000_flexible_questionnaire.sql). Shared by
// CandidacyWall.jsx (public) and Admin/ElectionsAdmin.jsx (review), which
// wrap it in their own card/list markup and pass in a normalized shape.

export default function AnswerValue({ questionType, optionText, selectedOptionTexts, textAnswer, ratingValue }) {
  if (questionType === 'multiple_choice') {
    if (!selectedOptionTexts?.length) return null;
    return (
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {selectedOptionTexts.map((t, i) => (
          <span key={i} className="text-xs px-2 py-0.5 bg-primary/10 text-primary-light rounded-full border border-primary/20">{t}</span>
        ))}
      </div>
    );
  }

  if (questionType === 'text') {
    if (!textAnswer) return null;
    return <p className="text-sm text-primary-light mt-1 whitespace-pre-wrap">{textAnswer}</p>;
  }

  if (questionType === 'rating') {
    if (ratingValue == null) return null;
    return (
      <div className="flex items-center gap-1 mt-1.5">
        {RATING_SCALE.map(n => (
          <span
            key={n}
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${
              n <= ratingValue ? 'bg-primary text-text-on-primary border-primary' : 'border-border-light text-text-muted'
            }`}
          >
            {n}
          </span>
        ))}
      </div>
    );
  }

  // single_choice (also the default for legacy rows with no question_type)
  if (!optionText) return null;
  return <p className="text-sm text-primary-light mt-1">{optionText}</p>;
}
