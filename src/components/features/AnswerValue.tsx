"use client";

import React from "react";
import { RATING_SCALE } from "@/lib/utils/ratingScale";

interface AnswerValueProps {
  questionType?: string;
  optionText?: string | null;
  selectedOptionTexts?: string[] | null;
  textAnswer?: string | null;
  ratingValue?: number | null;
}

export default function AnswerValue({
  questionType,
  optionText,
  selectedOptionTexts,
  textAnswer,
  ratingValue,
}: AnswerValueProps) {
  if (questionType === "multiple_choice") {
    if (!selectedOptionTexts?.length) return null;
    return (
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {selectedOptionTexts.map((t, i) => (
          <span
            key={i}
            className="text-xs px-2 py-0.5 bg-primary/10 text-primary-light rounded-full border border-primary/20"
          >
            {t}
          </span>
        ))}
      </div>
    );
  }

  if (questionType === "ranking") {
    if (!selectedOptionTexts?.length) return null;
    return (
      <ol className="space-y-1 mt-1.5">
        {selectedOptionTexts.map((t, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-primary-light">
            <span className="w-5 h-5 shrink-0 rounded-full bg-primary/15 text-[10px] font-bold flex items-center justify-center">
              {i + 1}
            </span>
            {t}
          </li>
        ))}
      </ol>
    );
  }

  if (questionType === "text") {
    if (!textAnswer) return null;
    return (
      <p className="text-sm text-primary-light mt-1 whitespace-pre-wrap">
        {textAnswer}
      </p>
    );
  }

  if (questionType === "rating") {
    if (ratingValue == null) return null;
    return (
      <div className="flex items-center gap-1 mt-1.5">
        {RATING_SCALE.map((n) => (
          <span
            key={n}
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${
              n <= ratingValue
                ? "bg-primary text-text-on-primary border-primary"
                : "border-border-light text-text-muted"
            }`}
          >
            {n}
          </span>
        ))}
      </div>
    );
  }

  // single_choice
  if (!optionText) return null;
  return <p className="text-sm text-primary-light mt-1">{optionText}</p>;
}
