-- نبراس: قاعدة بيانات أولية آمنة
-- نفّذ هذا الملف في Supabase SQL Editor بعد تفعيل المشروع ومراجعته.
-- لا تضع مفاتيح سرية داخل هذا الملف أو داخل ملفات الواجهة.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'student' check (role in ('owner','admin','student')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.course_content (
  id uuid primary key default gen_random_uuid(),
  course_slug text not null check (course_slug in ('tasees','tadreebat')),
  title text not null check (char_length(trim(title)) between 1 and 180),
  description text not null default '',
  content_type text not null check (content_type in ('lesson','video','pdf','worksheet','link')),
  storage_path text,
  external_url text,
  is_published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_has_resource check (
    (storage_path is not null and external_url is null)
    or (storage_path is null and external_url is not null)
    or (storage_path is null and external_url is null)
  )
);

create index if not exists course_content_course_published_idx
  on public.course_content (course_slug, is_published, created_at desc);

alter table public.profiles enable row level security;
alter table public.course_content enable row level security;

revoke all on public.profiles from anon, authenticated;
grant select (id, display_name, role, created_at, updated_at) on public.profiles to authenticated;
grant update (display_name, updated_at) on public.profiles to authenticated;

drop policy if exists "profile_read_self" on public.profiles;
create policy "profile_read_self" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "profile_update_self" on public.profiles;
create policy "profile_update_self" on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

grant select on public.course_content to anon, authenticated;
grant insert, update, delete on public.course_content to authenticated;

drop policy if exists "published_content_read" on public.course_content;
create policy "published_content_read" on public.course_content
  for select to anon, authenticated
  using (
    is_published = true
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('owner','admin')
    )
  );

drop policy if exists "admins_insert_content" on public.course_content;
create policy "admins_insert_content" on public.course_content
  for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('owner','admin')
    )
    and (created_by is null or created_by = (select auth.uid()))
  );

drop policy if exists "admins_update_content" on public.course_content;
create policy "admins_update_content" on public.course_content
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('owner','admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('owner','admin')
    )
  );

drop policy if exists "admins_delete_content" on public.course_content;
create policy "admins_delete_content" on public.course_content
  for delete to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('owner','admin')
    )
  );

-- بعد إنشاء حساب المالك، عيّن دوره يدوياً من SQL Editor الموثوق:
-- update public.profiles p set role = 'owner'
-- from auth.users u
-- where p.id = u.id and u.email = 'YOUR_OWNER_EMAIL';
-- لا تفتح التسجيل العام قبل أن تقرر سياسة الوصول المناسبة.
