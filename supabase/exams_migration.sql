-- ZAFAR BINARY ACADEMY: examination workflow
-- Run this file in Supabase SQL Editor after the existing schema and registration migration.
-- Creates private exam storage. Admin is identified by the verified auth email claim.

create table if not exists public.academy_exams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null default '',
  file_path text,
  deadline timestamptz,
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academy_exam_submissions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.academy_exams(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  student_name text not null default 'Student',
  exam_title text not null,
  file_path text not null,
  status text not null default 'submitted' check (status in ('submitted','marked')),
  score text,
  feedback text,
  submitted_at timestamptz not null default now(),
  marked_at timestamptz,
  unique (exam_id, student_id)
);

create index if not exists academy_exams_status_created_idx
  on public.academy_exams(status, created_at desc);
create index if not exists academy_exam_submissions_student_idx
  on public.academy_exam_submissions(student_id, submitted_at desc);
create index if not exists academy_exam_submissions_exam_idx
  on public.academy_exam_submissions(exam_id, submitted_at desc);

alter table public.academy_exams enable row level security;
alter table public.academy_exam_submissions enable row level security;

drop policy if exists "admin manage academy exams" on public.academy_exams;
create policy "admin manage academy exams" on public.academy_exams
for all to authenticated
using ((auth.jwt() ->> 'email') = 'rajulmoviehub@gmail.com')
with check ((auth.jwt() ->> 'email') = 'rajulmoviehub@gmail.com');

drop policy if exists "eligible students read published exams" on public.academy_exams;
create policy "eligible students read published exams" on public.academy_exams
for select to authenticated
using (
  status = 'published'
  and exists (
    select 1 from public.student_applications a
    where a.user_id = auth.uid()
      and a.application_status = 'approved'
      and a.payment_status = 'paid'
  )
);

drop policy if exists "admin manage all exam submissions" on public.academy_exam_submissions;
create policy "admin manage all exam submissions" on public.academy_exam_submissions
for all to authenticated
using ((auth.jwt() ->> 'email') = 'rajulmoviehub@gmail.com')
with check ((auth.jwt() ->> 'email') = 'rajulmoviehub@gmail.com');

drop policy if exists "students read own exam submissions" on public.academy_exam_submissions;
create policy "students read own exam submissions" on public.academy_exam_submissions
for select to authenticated
using (student_id = auth.uid());

-- Once marked, every approved and paid student can read the result record.
drop policy if exists "eligible students read all marked exam submissions" on public.academy_exam_submissions;
create policy "eligible students read all marked exam submissions" on public.academy_exam_submissions
for select to authenticated
using (
  status = 'marked'
  and exists (
    select 1 from public.student_applications a
    where a.user_id = auth.uid()
      and a.application_status = 'approved'
      and a.payment_status = 'paid'
  )
);

drop policy if exists "eligible students submit one paper per exam" on public.academy_exam_submissions;
create policy "eligible students submit one paper per exam" on public.academy_exam_submissions
for insert to authenticated
with check (
  student_id = auth.uid()
  and status = 'submitted'
  and exists (
    select 1 from public.academy_exams e
    where e.id = exam_id and e.status = 'published'
      and (e.deadline is null or e.deadline >= now())
  )
  and exists (
    select 1 from public.student_applications a
    where a.user_id = auth.uid()
      and a.application_status = 'approved'
      and a.payment_status = 'paid'
  )
);

-- Private bucket for exam PDFs and student answer papers.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('academy-exams', 'academy-exams', false, 15728640,
        array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set
  public = false,
  file_size_limit = 15728640,
  allowed_mime_types = array['application/pdf','image/jpeg','image/png'];

drop policy if exists "academy admin manage exam storage" on storage.objects;
create policy "academy admin manage exam storage" on storage.objects
for all to authenticated
using (
  bucket_id = 'academy-exams'
  and (auth.jwt() ->> 'email') = 'rajulmoviehub@gmail.com'
)
with check (
  bucket_id = 'academy-exams'
  and (auth.jwt() ->> 'email') = 'rajulmoviehub@gmail.com'
);

drop policy if exists "eligible students read published exam files" on storage.objects;
create policy "eligible students read published exam files" on storage.objects
for select to authenticated
using (
  bucket_id = 'academy-exams'
  and (storage.foldername(name))[1] = 'exams'
  and exists (
    select 1 from public.academy_exams e
    where e.id::text = (storage.foldername(name))[2]
      and e.status = 'published'
  )
  and exists (
    select 1 from public.student_applications a
    where a.user_id = auth.uid()
      and a.application_status = 'approved'
      and a.payment_status = 'paid'
  )
);

drop policy if exists "students upload own exam answers" on storage.objects;
create policy "students upload own exam answers" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'academy-exams'
  and (storage.foldername(name))[1] = 'submissions'
  and (storage.foldername(name))[2] = auth.uid()::text
  and exists (
    select 1 from public.academy_exams e
    where e.id::text = (storage.foldername(name))[3]
      and e.status = 'published'
      and (e.deadline is null or e.deadline >= now())
  )
  and exists (
    select 1 from public.student_applications a
    where a.user_id = auth.uid()
      and a.application_status = 'approved'
      and a.payment_status = 'paid'
  )
);

drop policy if exists "students read own uploaded answers" on storage.objects;
create policy "students read own uploaded answers" on storage.objects
for select to authenticated
using (
  bucket_id = 'academy-exams'
  and (storage.foldername(name))[1] = 'submissions'
  and (storage.foldername(name))[2] = auth.uid()::text
);

-- Permit enrolled students to view a paper file only after its submission is marked.
drop policy if exists "eligible students read marked exam papers" on storage.objects;
create policy "eligible students read marked exam papers" on storage.objects
for select to authenticated
using (
  bucket_id = 'academy-exams'
  and (storage.foldername(name))[1] = 'submissions'
  and exists (
    select 1 from public.academy_exam_submissions s
    where s.file_path = name
      and s.status = 'marked'
  )
  and exists (
    select 1 from public.student_applications a
    where a.user_id = auth.uid()
      and a.application_status = 'approved'
      and a.payment_status = 'paid'
  )
);
