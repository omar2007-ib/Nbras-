-- Keep role checks server-side so anonymous reads of published content do not need
-- SELECT privileges on the private profiles table.
create or replace function private.is_staff()
returns boolean language sql stable security definer
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('owner','admin')
  );
$$;
revoke all on function private.is_staff() from public;
grant execute on function private.is_staff() to anon, authenticated;

drop policy if exists published_content_read on public.course_content;
create policy published_content_read on public.course_content
for select to anon, authenticated
using (is_published = true or private.is_staff());

drop policy if exists admins_insert_content on public.course_content;
create policy admins_insert_content on public.course_content
for insert to authenticated
with check (private.is_staff() and (created_by is null or created_by = auth.uid()));

drop policy if exists admins_update_content on public.course_content;
create policy admins_update_content on public.course_content
for update to authenticated using (private.is_staff())
with check (private.is_staff());

drop policy if exists admins_delete_content on public.course_content;
create policy admins_delete_content on public.course_content
for delete to authenticated using (private.is_staff());

drop policy if exists staff_mcq_read on public.mcq_questions;
create policy staff_mcq_read on public.mcq_questions
for select to authenticated using (private.is_staff());

drop policy if exists staff_mcq_insert on public.mcq_questions;
create policy staff_mcq_insert on public.mcq_questions
for insert to authenticated
with check (created_by = auth.uid() and private.is_staff());

drop policy if exists staff_mcq_update on public.mcq_questions;
create policy staff_mcq_update on public.mcq_questions
for update to authenticated using (private.is_staff())
with check (private.is_staff());

drop policy if exists staff_mcq_delete on public.mcq_questions;
create policy staff_mcq_delete on public.mcq_questions
for delete to authenticated using (private.is_staff());
