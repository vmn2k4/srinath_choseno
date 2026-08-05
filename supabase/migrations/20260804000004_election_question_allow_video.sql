-- Admin-configurable per-question toggle for the candidate video-pitch
-- option, mirroring allow_context. The per-question video recorder in the
-- candidate application form was previously offered unconditionally for
-- every question; this makes it opt-in like the written-context field.
-- Defaults to true so existing questions keep behaving exactly as before
-- until an admin explicitly turns it off for a given question.
ALTER TABLE public.election_questions
  ADD COLUMN allow_video boolean NOT NULL DEFAULT true;
