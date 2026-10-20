-- أثَر: توسعة قاعدة البيانات لمنصة تعليمية قابلة للتوسع
-- Migration preparation only. Apply only after the Supabase project is active and reviewed.
begin;

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,80}$'),
  title_ar text not null check (char_length(trim(title_ar)) between 1 and 160),
  title_en text,
  tagline_ar text not null default '',
  description_ar text not null default '',
  cover_path text,
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.courses (slug, title_ar, tagline_ar, description_ar, is_published, sort_order)
values
 ('tasees', 'تأسيس', 'تأسيس من حديد', 'ابدأ بناء أساسك في القدرات الكمي خطوة بخطوة.', true, 1),
 ('tadreebat', 'تدريبات', 'الخطوة الأخيرة', 'تدرب على الأسئلة وراجع استعدادك للاختبار.', true, 2)
on conflict (slug) do nothing;

alter table public.course_content
  add column if not exists course_id uuid references public.courses(id) on delete cascade;

update public.course_content cc
set course_id = c.id
from public.courses c
where cc.course_id is null and cc.course_slug = c.slug;

create index if not exists course_content_course_id_idx
  on public.course_content (course_id, is_published, created_at desc);

create table if not exists public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  status text not null default 'active' check (status in ('active','completed','revoked')),
  enrolled_at timestamptz not null default now(),
  unique (student_id, course_id)
);

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  content_id uuid not null references public.course_content(id) on delete cascade,
  completed boolean not null default false,
  last_position_seconds integer not null default 0 check (last_position_seconds >= 0),
  updated_at timestamptz not null default now(),
  unique (student_id, content_id)
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title_ar text not null check (char_length(trim(title_ar)) between 1 and 180),
  body_ar text not null default '',
  is_published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.courses enable row level security;
alter table public.course_enrollments enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.announcements enable row level security;

grant select on public.courses to anon, authenticated;
grant insert, update, delete on public.courses to authenticated;
grant select, insert, update, delete on public.course_enrollments to authenticated;
grant select, insert, update, delete on public.lesson_progress to authenticated;
grant select, insert, update, delete on public.announcements to authenticated;

drop policy if exists courses_read_published_or_admin on public.courses;
create policy courses_read_published_or_admin on public.courses
for select to anon, authenticated
using (is_published or exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and p.role in ('owner','admin')
));

drop policy if exists courses_admin_insert on public.courses;
create policy courses_admin_insert on public.courses
for insert to authenticated
with check (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and p.role in ('owner','admin')
));

drop policy if exists courses_admin_update on public.courses;
create policy courses_admin_update on public.courses
for update to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and p.role in ('owner','admin')
))
with check (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and p.role in ('owner','admin')
));

drop policy if exists courses_admin_delete on public.courses;
create policy courses_admin_delete on public.courses
for delete to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and p.role in ('owner','admin')
));

drop policy if exists enrollments_student_or_admin_read on public.course_enrollments;
create policy enrollments_student_or_admin_read on public.course_enrollments
for select to authenticated
using (student_id = (select auth.uid()) or exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and p.role in ('owner','admin')
));

drop policy if exists enrollments_admin_manage on public.course_enrollments;
create policy enrollments_admin_manage on public.course_enrollments
for all to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and p.role in ('owner','admin')
))
with check (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and p.role in ('owner','admin')
));

drop policy if exists progress_student_read on public.lesson_progress;
create policy progress_student_read on public.lesson_progress
for select to authenticated
using (student_id = (select auth.uid()) or exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and p.role in ('owner','admin')
));

drop policy if exists progress_student_insert on public.lesson_progress;
create policy progress_student_insert on public.lesson_progress
for insert to authenticated
with check (student_id = (select auth.uid()));

drop policy if exists progress_student_update on public.lesson_progress;
create policy progress_student_update on public.lesson_progress
for update to authenticated
using (student_id = (select auth.uid()))
with check (student_id = (select auth.uid()));

drop policy if exists progress_admin_read on public.lesson_progress;
create policy progress_admin_read on public.lesson_progress
for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and p.role in ('owner','admin')
));

drop policy if exists announcements_read_published_or_admin on public.announcements;
create policy announcements_read_published_or_admin on public.announcements
for select to anon, authenticated
using (is_published or exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and p.role in ('owner','admin')
));

drop policy if exists announcements_admin_insert on public.announcements;
create policy announcements_admin_insert on public.announcements
for insert to authenticated
with check (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and p.role in ('owner','admin')
));

drop policy if exists announcements_admin_update on public.announcements;
create policy announcements_admin_update on public.announcements
for update to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and p.role in ('owner','admin')
))
with check (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and p.role in ('owner','admin')
));

drop policy if exists announcements_admin_delete on public.announcements;
create policy announcements_admin_delete on public.announcements
for delete to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and p.role in ('owner','admin')
));

commit;
