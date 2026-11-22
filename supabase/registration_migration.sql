-- ZAFAR BINARY ACADEMY: safe additive setup / repair
-- Run this entire file once in Supabase SQL Editor.
-- Does not collect or add passport numbers. Never paste service-role keys into the site.

alter table public.student_applications
  add column if not exists payment_reference text,
  add column if not exists payment_verified_at timestamptz;

create table if not exists public.academy_class_settings (
  id boolean primary key default true check (id = true),
  class_schedule text not null default 'Class timetable will be announced by the academy.',
  zoom_meeting_url text not null default '',
  whatsapp_group_url text not null default '',
  updated_at timestamptz not null default now()
);
insert into public.academy_class_settings (id) values (true) on conflict (id) do nothing;
alter table public.academy_class_settings enable row level security;

drop policy if exists "admin manage class settings" on public.academy_class_settings;
create policy "admin manage class settings" on public.academy_class_settings
for all to authenticated
using ((auth.jwt() ->> 'email') = 'rajulmoviehub@gmail.com')
with check ((auth.jwt() ->> 'email') = 'rajulmoviehub@gmail.com');

drop policy if exists "enrolled students read class settings" on public.academy_class_settings;
create policy "enrolled students read class settings" on public.academy_class_settings
for select to authenticated
using (exists (
  select 1 from public.student_applications a
  where a.user_id = auth.uid()
    and a.application_status = 'approved'
    and a.payment_status = 'paid'
));

create or replace function public.verify_academy_certificate(p_certificate_number text)
returns table (certificate_number text, student_name text, course text, issued_at date, status text)
language sql
security definer
set search_path = ''
as $$
  select c.certificate_number, c.student_name, c.course, c.issued_at, c.status
  from public.certificates c
  where c.certificate_number = upper(trim(p_certificate_number))
    and c.status = 'valid'
  limit 1;
$$;
revoke all on function public.verify_academy_certificate(text) from public;
grant execute on function public.verify_academy_certificate(text) to anon, authenticated;

-- Repair the designated administrator profile only if the Auth account exists.
insert into public.profiles (id, full_name, whatsapp, country, role)
select u.id,
       coalesce(u.raw_user_meta_data ->> 'full_name', 'Paul M K'),
       coalesce(u.raw_user_meta_data ->> 'whatsapp', '0714480604'),
       coalesce(u.raw_user_meta_data ->> 'country', 'Kenya'),
       'admin'
from auth.users u
where lower(u.email) = 'rajulmoviehub@gmail.com'
on conflict (id) do update set role = 'admin';
