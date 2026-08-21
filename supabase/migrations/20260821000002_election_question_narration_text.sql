-- The spoken script for a question's generated video, separate from
-- question_text (what's shown in the UI/on screen). For a ranking or
-- multiple_choice question, the raw question_text alone ("Rank the
-- following issues...") often isn't speakable on its own -- narration_text
-- lets an admin reframe it into an actual spoken script (e.g. one that
-- reads the options aloud) before generating, without changing the
-- question voters/candidates see everywhere else. Nullable: null means
-- "use question_text as the narration too" (the common case for a
-- question that already reads fine aloud, e.g. a single_choice/text
-- question).
ALTER TABLE public.election_questions
  ADD COLUMN narration_text text;
