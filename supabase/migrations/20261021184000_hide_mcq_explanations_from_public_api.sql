-- Keep answer explanations and internal source metadata off the public question API.
drop view if exists public.mcq_public_questions;
create view public.mcq_public_questions
with (security_invoker = true)
as
select id, question, options, category, difficulty, created_at, updated_at
from public.mcq_questions
where status = 'approved';

grant select on public.mcq_public_questions to anon, authenticated;
revoke select (explanation, source_name, status) on table public.mcq_questions from anon;
