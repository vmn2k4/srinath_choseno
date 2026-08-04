-- Fix RLS policy on election_answer_comments to allow authenticated users,
-- candidate owners, and admins to post comments on stance answers.

DROP POLICY IF EXISTS "Authenticated users can comment where the answer is visible" ON public.election_answer_comments;

CREATE POLICY "Authenticated users can comment where the answer is visible"
  ON public.election_answer_comments FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.election_candidate_answers a
      JOIN public.election_candidates ec ON ec.id = a.candidate_id
      JOIN public.election_questions q ON q.id = a.question_id
      WHERE a.id = election_answer_comments.answer_id
        AND (
          (ec.status = 'approved' AND q.visible_to_public = true)
          OR ec.politician_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
        )
    )
  );

-- RPC helper function as a fallback to create answer comments safely
CREATE OR REPLACE FUNCTION public.create_answer_comment(
  p_answer_id uuid,
  p_ghost_id uuid,
  p_content text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_comment_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be logged in to comment';
  END IF;

  INSERT INTO public.election_answer_comments (answer_id, ghost_id, content)
  VALUES (p_answer_id, p_ghost_id, p_content)
  RETURNING id INTO v_comment_id;

  RETURN v_comment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_answer_comment(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_answer_comment(
  p_answer_id uuid,
  p_content text,
  p_ghost_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_comment_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be logged in to comment';
  END IF;

  INSERT INTO public.election_answer_comments (answer_id, ghost_id, content)
  VALUES (p_answer_id, p_ghost_id, p_content)
  RETURNING id INTO v_comment_id;

  RETURN v_comment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_answer_comment(uuid, text, uuid) TO authenticated;
