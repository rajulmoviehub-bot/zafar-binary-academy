-- ZAFAR BINARY ACADEMY: attendance and lesson progress
-- Additive migration. Existing student, payment, exam and certificate data is untouched.

create table if not exists public.academy_attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  class_date date not null,
  attendance_status text not null check (attendance_status in ('present','late','absent','excused')),
  note text not null default '',
  recorded_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, class_date)
);

create table if not exists public.academy_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  lesson_title text not null check (length(trim(lesson_title)) between 1 and 160),
  progress_status text not null check (progress_status in ('not_started','in_progress','completed')),
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  notes text not null default '',
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, lesson_title)
);

create index if not exists academy_attendance_student_date_idx
  on public.academy_attendance (student_id, class_date desc);
create index if not exists academy_lesson_progress_student_idx
  on public.academy_lesson_progress (student_id, updated_at desc);

alter table public.academy_attendance enable row level security;
alter table public.academy_lesson_progress enable row level security;

drop policy if exists "admin manage academy attendance" on public.academy_attendance;
create policy "admin manage academy attendance" on public.academy_attendance
for all to authenticated
using ((auth.jwt() ->> 'email') = 'rajulmoviehub@gmail.com')
with check ((auth.jwt() ->> 'email') = 'rajulmoviehub@gmail.com');

drop policy if exists "eligible student read own attendance" on public.academy_attendance;
create policy "eligible student read own attendance" on public.academy_attendance
for select to authenticated
using (
  student_id = auth.uid()
  and exists (
    select 1 from public.student_applications a
    where a.user_id = auth.uid()
      and a.application_status = 'approved'
      and a.payment_status = 'paid'
  )
);

drop policy if exists "admin manage academy lesson progress" on public.academy_lesson_progress;
create policy "admin manage academy lesson progress" on public.academy_lesson_progress
for all to authenticated
using ((auth.jwt() ->> 'email') = 'rajulmoviehub@gmail.com')
with check ((auth.jwt() ->> 'email') = 'rajulmoviehub@gmail.com');

drop policy if exists "eligible student read own lesson progress" on public.academy_lesson_progress;
create policy "eligible student read own lesson progress" on public.academy_lesson_progress
for select to authenticated
using (
  student_id = auth.uid()
  and exists (
    select 1 from public.student_applications a
    where a.user_id = auth.uid()
      and a.application_status = 'approved'
      and a.payment_status = 'paid'
  )
);

grant select, insert, update, delete on public.academy_attendance to authenticated;
grant select, insert, update, delete on public.academy_lesson_progress to authenticated;
