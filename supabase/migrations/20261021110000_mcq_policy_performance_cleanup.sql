-- ATHAR: consolidate MCQ read policies and index the creator foreign key.
-- Preserves public access to approved questions and staff access to the full question bank.
begin;

create index if not exists mcq_questions_created_by_idx
  on public.mcq_questions (created_by);

drop policy if exists approved_mcq_read on public.mcq_questions;
drop policy if exists staff_mcq_read_all on public.mcq_questions;

create policy mcq_read_approved_or_staff
on public.mcq_questions
for select
to anon, authenticated
using (
  status = 'approved'
  or (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('owner', 'admin')
    )
  )
);

commit;
