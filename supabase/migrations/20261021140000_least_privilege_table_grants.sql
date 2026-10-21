-- ATHAR: restrict table-level SQL privileges to the operations required by the app.
-- Row access continues to be enforced by the existing RLS policies.
begin;

revoke all privileges on table public.course_content from anon, authenticated;
grant select on table public.course_content to anon, authenticated;
grant insert, update, delete on table public.course_content to authenticated;

revoke all privileges on table public.mcq_questions from anon, authenticated;
grant select on table public.mcq_questions to anon, authenticated;
grant insert, update, delete on table public.mcq_questions to authenticated;

commit;
