-- Admin-configured, per-election candidate questionnaire. Each question is
-- multiple-choice; admin can optionally let candidates add free-text context
-- per answer, mark a question required, and control whether the answer is
-- shown on the candidate's public campaign page (visible_to_public) --
-- candidates still must answer non-public questions (e.g. internal vetting),
-- voters just never see those answers.
CREATE TABLE public.election_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id uuid NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  allow_context boolean NOT NULL DEFAULT false,
  visible_to_public boolean NOT NULL DEFAULT true,
  rank int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.election_question_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.election_questions(id) ON DELETE CASCADE,
  option_text text NOT NULL,
  rank int NOT NULL DEFAULT 0
);

CREATE INDEX idx_election_questions_election ON public.election_questions(election_id);
CREATE INDEX idx_election_question_options_question ON public.election_question_options(question_id);

ALTER TABLE public.election_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.election_question_options ENABLE ROW LEVEL SECURITY;

-- Question/option text isn't sensitive on its own (candidates need to read it
-- to answer, and there's no real harm in a voter seeing the question even if
-- the ANSWER is kept private) -- public read, admin write, same posture as
-- country_boundary_types/political_parties.
CREATE POLICY "Public can read election questions"
  ON public.election_questions FOR SELECT USING (true);
CREATE POLICY "Admins manage election questions"
  ON public.election_questions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Public can read election question options"
  ON public.election_question_options FOR SELECT USING (true);
CREATE POLICY "Admins manage election question options"
  ON public.election_question_options FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
