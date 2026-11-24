-- ZAFAR BINARY ACADEMY: learning hub, support, reminders, community and leaderboard
-- Additive migration. Does not alter existing payments, enrolments, exams or certificates.
create table if not exists public.academy_lessons (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 160),
  description text not null default '',
  video_url text not null check (video_url ~ '^https://'),
  module_name text not null default 'General',
  sort_order integer not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.academy_support_tickets (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (length(trim(subject)) between 3 and 160),
  message text not null check (length(trim(message)) between 5 and 5000),
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  admin_reply text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.academy_reminders (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 160),
  body text not null default '',
  remind_at timestamptz not null,
  audience text not null default 'all_eligible' check (audience in ('all_eligible','class','exam')),
  published boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.academy_discussions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default 'Student',
  message text not null check (length(trim(message)) between 1 and 2000),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.academy_leaderboard (
  student_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Student',
  points integer not null default 0 check (points between 0 and 100000),
  opted_in boolean not null default false,
  updated_at timestamptz not null default now()
);
create index if not exists academy_lessons_published_order_idx on public.academy_lessons(published,sort_order,created_at desc);
create index if not exists academy_support_student_created_idx on public.academy_support_tickets(student_id,created_at desc);
create index if not exists academy_reminders_date_idx on public.academy_reminders(published,remind_at);
create index if not exists academy_discussions_created_idx on public.academy_discussions(created_at desc);
create index if not exists academy_leaderboard_rank_idx on public.academy_leaderboard(opted_in,points desc);

alter table public.academy_lessons enable row level security;
alter table public.academy_support_tickets enable row level security;
alter table public.academy_reminders enable row level security;
alter table public.academy_discussions enable row level security;
alter table public.academy_leaderboard enable row level security;

-- Admin policies
drop policy if exists "zba admin manage lessons" on public.academy_lessons;
create policy "zba admin manage lessons" on public.academy_lessons for all to authenticated
using ((auth.jwt()->>'email')='rajulmoviehub@gmail.com')
with check ((auth.jwt()->>'email')='rajulmoviehub@gmail.com');
drop policy if exists "zba admin manage support" on public.academy_support_tickets;
create policy "zba admin manage support" on public.academy_support_tickets for all to authenticated
using ((auth.jwt()->>'email')='rajulmoviehub@gmail.com')
with check ((auth.jwt()->>'email')='rajulmoviehub@gmail.com');
drop policy if exists "zba admin manage reminders" on public.academy_reminders;
create policy "zba admin manage reminders" on public.academy_reminders for all to authenticated
using ((auth.jwt()->>'email')='rajulmoviehub@gmail.com')
with check ((auth.jwt()->>'email')='rajulmoviehub@gmail.com');
drop policy if exists "zba admin moderate discussions" on public.academy_discussions;
create policy "zba admin moderate discussions" on public.academy_discussions for all to authenticated
using ((auth.jwt()->>'email')='rajulmoviehub@gmail.com')
with check ((auth.jwt()->>'email')='rajulmoviehub@gmail.com');

-- Eligible students can view published lessons/reminders and visible discussions.
drop policy if exists "zba eligible read lessons" on public.academy_lessons;
create policy "zba eligible read lessons" on public.academy_lessons for select to authenticated
using (published and exists(select 1 from public.student_applications a where a.user_id=auth.uid() and a.application_status='approved' and a.payment_status='paid'));
drop policy if exists "zba eligible read reminders" on public.academy_reminders;
create policy "zba eligible read reminders" on public.academy_reminders for select to authenticated
using (published and exists(select 1 from public.student_applications a where a.user_id=auth.uid() and a.application_status='approved' and a.payment_status='paid'));
drop policy if exists "zba eligible read discussions" on public.academy_discussions;
create policy "zba eligible read discussions" on public.academy_discussions for select to authenticated
using (not hidden and exists(select 1 from public.student_applications a where a.user_id=auth.uid() and a.application_status='approved' and a.payment_status='paid'));
drop policy if exists "zba eligible post discussions" on public.academy_discussions;
create policy "zba eligible post discussions" on public.academy_discussions for insert to authenticated
with check (student_id=auth.uid() and not hidden and exists(select 1 from public.student_applications a where a.user_id=auth.uid() and a.application_status='approved' and a.payment_status='paid'));

-- Ticket owner can create and read their own requests; admin policies above allow staff management.
drop policy if exists "zba student create support ticket" on public.academy_support_tickets;
create policy "zba student create support ticket" on public.academy_support_tickets for insert to authenticated
with check (student_id=auth.uid() and status='open' and admin_reply='' and exists(select 1 from public.student_applications a where a.user_id=auth.uid() and a.application_status='approved' and a.payment_status='paid'));
drop policy if exists "zba student read own support tickets" on public.academy_support_tickets;
create policy "zba student read own support tickets" on public.academy_support_tickets for select to authenticated
using (student_id=auth.uid());

-- A student may manage only their own leaderboard opt-in record. Rank/points are staff-controlled.
drop policy if exists "zba eligible read optin leaderboard" on public.academy_leaderboard;
create policy "zba eligible read optin leaderboard" on public.academy_leaderboard for select to authenticated
using (opted_in and exists(select 1 from public.student_applications a where a.user_id=auth.uid() and a.application_status='approved' and a.payment_status='paid'));
drop policy if exists "zba student create leaderboard profile" on public.academy_leaderboard;
create policy "zba student create leaderboard profile" on public.academy_leaderboard for insert to authenticated
with check (student_id=auth.uid() and points=0 and opted_in=false and exists(select 1 from public.student_applications a where a.user_id=auth.uid() and a.application_status='approved' and a.payment_status='paid'));
drop policy if exists "zba student update own leaderboard optin" on public.academy_leaderboard;
create policy "zba student update own leaderboard optin" on public.academy_leaderboard for update to authenticated
using (student_id=auth.uid())
with check (student_id=auth.uid());

grant select,insert,update,delete on public.academy_lessons to authenticated;
grant select,insert,update,delete on public.academy_support_tickets to authenticated;
grant select,insert,update,delete on public.academy_reminders to authenticated;
grant select,insert,update,delete on public.academy_discussions to authenticated;
grant select,insert,update on public.academy_leaderboard to authenticated;

-- Prevent students from awarding themselves points or changing their displayed name.
create or replace function public.zba_lock_student_leaderboard_fields()
returns trigger language plpgsql as $$
begin
  if coalesce(auth.jwt()->>'email','') <> 'rajulmoviehub@gmail.com' then
    if tg_op = 'UPDATE' then
      new.points := old.points;
      new.display_name := old.display_name;
    else
      new.points := 0;
      new.display_name := coalesce(nullif(trim(old.display_name),''),'Student');
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists zba_lock_student_leaderboard_fields on public.academy_leaderboard;
create trigger zba_lock_student_leaderboard_fields
before insert or update on public.academy_leaderboard
for each row execute function public.zba_lock_student_leaderboard_fields();
