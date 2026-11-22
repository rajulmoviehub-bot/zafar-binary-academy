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

 
-- M-Pesa Buy Goods STK Push tracking (server-only writes).
create table if not exists public.academy_payment_intents (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  application_id uuid not null references public.student_applications(id) on delete restrict,
  amount_kes integer not null check (amount_kes > 0),
  usd_amount integer not null check (usd_amount in (25,50)),
  exchange_rate numeric(14,6) not null check (exchange_rate > 0),
  phone text not null,
  status text not null default 'initiating'
    check (status in ('initiating','stk_sent','callback_received','failed','review_required')),
  checkout_request_id text unique,
  merchant_request_id text,
  mpesa_receipt text,
  callback_amount numeric(12,2),
  callback_phone text,
  result_code integer,
  result_description text,
  raw_callback jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists academy_payment_intents_user_created_idx
  on public.academy_payment_intents(user_id, created_at desc);
create index if not exists academy_payment_intents_application_idx
  on public.academy_payment_intents(application_id);
alter table public.academy_payment_intents enable row level security;
revoke all on public.academy_payment_intents from anon, authenticated;
-- No client policies: only Vercel's service-role key can read or write payment intents.
-- A successful callback saves the Safaricom receipt as a reference, but does not
-- change payment_status. Admin must verify the receipt against the M-Pesa statement.
