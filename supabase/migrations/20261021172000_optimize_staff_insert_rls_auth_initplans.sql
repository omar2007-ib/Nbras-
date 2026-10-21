-- Evaluate auth.uid() once per statement instead of once per inserted row.
drop policy if exists admins_insert_content on public.course_content;
create policy admins_insert_content on public.course_content
for insert to authenticated
with check (private.is_staff() and (created_by is null or created_by = (select auth.uid())));

drop policy if exists staff_mcq_insert on public.mcq_questions;
create policy staff_mcq_insert on public.mcq_questions
for insert to authenticated
with check (created_by = (select auth.uid()) and private.is_staff());
