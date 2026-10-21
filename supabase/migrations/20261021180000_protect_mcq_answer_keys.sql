-- Prevent public clients from reading correct_index directly.
-- Public practice content is exposed through a deliberately answer-free view.
BEGIN;

DROP POLICY IF EXISTS mcq_read_approved_or_staff ON public.mcq_questions;
DROP POLICY IF EXISTS staff_mcq_read ON public.mcq_questions;
CREATE POLICY staff_mcq_read
  ON public.mcq_questions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles AS p
      WHERE p.id = (SELECT auth.uid())
        AND p.role IN ('owner', 'admin')
    )
  );

REVOKE SELECT ON TABLE public.mcq_questions FROM anon;

CREATE OR REPLACE VIEW public.mcq_public_questions
WITH (security_barrier = true)
AS
SELECT
  id,
  question,
  options,
  category,
  difficulty,
  explanation,
  source_name,
  status,
  created_at,
  updated_at
FROM public.mcq_questions
WHERE status = 'approved';

GRANT SELECT ON TABLE public.mcq_public_questions TO anon, authenticated;

COMMIT;
