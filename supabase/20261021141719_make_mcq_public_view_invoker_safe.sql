-- Harden the answer-key-safe MCQ view.
-- The view is not used by the current public pages; keep it private until a
-- dedicated student-facing API is implemented and tested.
alter view public.mcq_public_questions
  set (security_invoker = true);

revoke all privileges on table public.mcq_public_questions
  from public, anon, authenticated;
