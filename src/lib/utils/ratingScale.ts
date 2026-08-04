// The fixed scale for 'rating'-type questionnaire questions (see
// 20260802000000_flexible_questionnaire.sql) -- shared so the candidate's
// input control and the rendered dots elsewhere always agree on the range.
export const RATING_SCALE = [1, 2, 3, 4, 5] as const;
