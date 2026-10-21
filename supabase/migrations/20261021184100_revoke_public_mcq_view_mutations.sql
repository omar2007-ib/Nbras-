-- Default privileges grant broad rights on new public views; narrow the public API to SELECT only.
revoke all on table public.mcq_public_questions from public, anon, authenticated, service_role;
grant select on table public.mcq_public_questions to anon, authenticated;