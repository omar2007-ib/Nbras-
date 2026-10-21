-- Restore read access only after the public view is invoker-safe and answer-free.
-- The view contains no correct_index column; base-table RLS and column grants still apply.
BEGIN;

GRANT SELECT ON TABLE public.mcq_public_questions TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE
  ON TABLE public.mcq_public_questions
  FROM anon, authenticated, PUBLIC;

COMMIT;
