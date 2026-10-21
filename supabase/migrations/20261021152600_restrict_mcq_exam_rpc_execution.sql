-- Restrict the SECURITY DEFINER exam RPCs to trusted server-side callers.
-- The current public exam page uses a localStorage question bank and does not call
-- these RPCs. If server-backed exams are introduced later, expose them through an
-- authenticated Edge Function that validates attempts and submissions first.
REVOKE EXECUTE ON FUNCTION public.start_mcq_exam(text, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_mcq_exam(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.start_mcq_exam(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_mcq_exam(uuid, jsonb) TO service_role;
