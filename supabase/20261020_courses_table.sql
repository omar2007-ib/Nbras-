-- Athar learning-platform expansion. Preparation only; apply after project activation and review.
begin;
create table if not exists public.courses (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique check (slug in ('tasees','tadreebat') or slug ~ '^[a-z0-9-]{2,80}$'),
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
insert into public.courses (slug,title_ar,tagline_ar,description_ar,is_published,sort_order)
values ('tasees','تأسيس','تأسيس من حديد','بناء أساس القدرات الكمي.',true,1),
       ('tadreebat','تدريبات','الخطوة الأخيرة','تدريبات ومراجعة لاختبار القدرات.',true,2)
on conflict (slug) do nothing;
alter table public.course_content add column if not exists course_id uuid references public.courses(id) on delete cascade;
update public.course_content cc set course_id=c.id from public.courses c
where cc.course_id is null and cc.course_slug=c.slug;
create index if not exists course_content_course_id_idx on public.course_content(course_id,is_published,created_at desc);
alter table public.courses enable row level security;
grant select on public.courses to anon, authenticated;
grant insert,update,delete on public.courses to authenticated;
drop policy if exists courses_read_published_or_admin on public.courses;
create policy courses_read_published_or_admin on public.courses for select to anon,authenticated
using (is_published or exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('owner','admin')));
drop policy if exists courses_admin_insert on public.courses;
create policy courses_admin_insert on public.courses for insert to authenticated
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('owner','admin')));
drop policy if exists courses_admin_update on public.courses;
create policy courses_admin_update on public.courses for update to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('owner','admin')))
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('owner','admin')));
drop policy if exists courses_admin_delete on public.courses;
create policy courses_admin_delete on public.courses for delete to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('owner','admin')));
commit;
