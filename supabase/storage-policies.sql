-- نبراس: سياسات تخزين ملفات الدورات
-- شغّل هذا الملف فقط بعد مراجعة schema.sql وتهيئة مشروع Supabase.
-- الملفات خاصة افتراضياً؛ لا تجعل bucket عاماً.
-- حدّ الملف 50 MiB؛ عدّل القائمة وفق أنواع المحتوى التي ستسمح برفعها.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'nibras-content',
  'nibras-content',
  false,
  52428800,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/webm'
  ]::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "nibras_published_files_read" on storage.objects;
create policy "nibras_published_files_read" on storage.objects
for select to anon, authenticated
using (
  bucket_id = 'nibras-content'
  and exists (
    select 1 from public.course_content c
    where c.storage_path = name and c.is_published = true
  )
);

drop policy if exists "nibras_admin_files_read" on storage.objects;
create policy "nibras_admin_files_read" on storage.objects
for select to authenticated
using (
  bucket_id = 'nibras-content'
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('owner', 'admin')
  )
);

drop policy if exists "nibras_admin_files_insert" on storage.objects;
create policy "nibras_admin_files_insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'nibras-content'
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('owner', 'admin')
  )
);

drop policy if exists "nibras_admin_files_update" on storage.objects;
create policy "nibras_admin_files_update" on storage.objects
for update to authenticated
using (
  bucket_id = 'nibras-content'
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('owner', 'admin')
  )
)
with check (
  bucket_id = 'nibras-content'
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('owner', 'admin')
  )
);

drop policy if exists "nibras_admin_files_delete" on storage.objects;
create policy "nibras_admin_files_delete" on storage.objects
for delete to authenticated
using (
  bucket_id = 'nibras-content'
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('owner', 'admin')
  )
);
