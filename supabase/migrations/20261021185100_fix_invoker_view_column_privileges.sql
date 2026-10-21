-- The invoker-safe view must not reference a private column in its own
-- predicate: approved-row filtering is already enforced by mcq_questions RLS.
-- This allows column-only grants without exposing status or answer metadata.
DROP VIEW IF EXISTS public.mcq_public_questions;
CREATE VIEW public.mcq_public_questions
WITH (security_invoker = true)
AS
SELECT id, question, options, category, difficulty, created_at, updated_at
FROM public.mcq_questions;

REVOKE ALL ON TABLE public.mcq_public_questions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.mcq_public_questions TO anon, authenticated;
GRANT SELECT (id, question, options, category, difficulty, created_at, updated_at)
ON TABLE public.mcq_questions TO anon;
