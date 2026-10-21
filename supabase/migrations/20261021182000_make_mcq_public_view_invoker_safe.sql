-- Keep the public MCQ view under the querying role's privileges and RLS.
-- Anonymous clients receive column-level access that excludes correct_index.
BEGIN;

DROP POLICY IF EXISTS mcq_public_read ON public.mcq_questions;
CREATE POLICY mcq_public_read
  ON public.mcq_questions
  FOR SELECT
  TO anon
  USING (status = 'approved');

GRANT SELECT (
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
) ON TABLE public.mcq_questions TO anon;

CREATE OR REPLACE VIEW public.mcq_public_questions
WITH (security_barrier = true, security_invoker = true)
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

COMMIT;
