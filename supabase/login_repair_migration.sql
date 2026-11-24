-- ZAFAR BINARY ACADEMY: idempotent student login/application RLS repair
-- Run this in Supabase SQL Editor if the website reports that account details cannot load.
-- Students can read and create only their own application. The named admin can manage all.
alter table public.student_applications enable row level security;
drop policy if exists "application read own or admin" on public.student_applications;
create policy "application read own or admin" on public.student_applications
for select to authenticated
using (user_id = auth.uid() or (auth.jwt() ->> 'email') = 'rajulmoviehub@gmail.com');
drop policy if exists "student submit own application" on public.student_applications;
create policy "student submit own application" on public.student_applications
for insert to authenticated
with check (user_id = auth.uid());
drop policy if exists "admin manage applications" on public.student_applications;
create policy "admin manage applications" on public.student_applications
for all to authenticated
using ((auth.jwt() ->> 'email') = 'rajulmoviehub@gmail.com')
with check ((auth.jwt() ->> 'email') = 'rajulmoviehub@gmail.com');
grant select, insert on public.student_applications to authenticated;

alter table public.profiles enable row level security;
drop policy if exists "profile read self or academy admin" on public.profiles;
create policy "profile read self or academy admin" on public.profiles
for select to authenticated
using (id = auth.uid() or (auth.jwt() ->> 'email') = 'rajulmoviehub@gmail.com');
grant select on public.profiles to authenticated;
