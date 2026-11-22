-- ZAFAR BINARY ACADEMY: Supabase schema
-- Run in Supabase SQL Editor. Never put the service-role key in browser code.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  whatsapp text,
  country text,
  role text not null default 'student' check (role in ('student','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.student_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  passport_name text not null,
  age integer not null check (age >= 18),
  whatsapp text not null,
  country text,
  course text not null default 'Full Binary Trading Course',
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','rejected','refunded')),
  application_status text not null default 'submitted' check (application_status in ('submitted','approved','declined')),
  created_at timestamptz not null default now()
);

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_number text not null unique,
  student_id uuid not null references auth.users(id) on delete restrict,
  student_name text not null,
  course text not null,
  issued_at date not null default current_date,
  status text not null default 'valid' check (status in ('valid','revoked','replaced')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.student_applications enable row level security;
alter table public.certificates enable row level security;

-- A signed-in user can see their own profile; only the designated admin can see all.
drop policy if exists "profile read self or academy admin" on public.profiles;
create policy "profile read self or academy admin" on public.profiles
for select to authenticated
using (id = auth.uid() or (auth.jwt() ->> 'email') = 'rajulmoviehub@gmail.com');

drop policy if exists "profile update self" on public.profiles;
create policy "profile update self" on public.profiles
for update to authenticated
using (id = auth.uid() and (auth.jwt() ->> 'email') <> 'rajulmoviehub@gmail.com')
with check (id = auth.uid() and role = 'student');

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

drop policy if exists "certificates public verification" on public.certificates;

create or replace function public.verify_academy_certificate(p_certificate_number text)
returns table (certificate_number text, student_name text, course text, issued_at date, status text)
language sql security definer set search_path = ''
as $
  select c.certificate_number, c.student_name, c.course, c.issued_at, c.status
  from public.certificates c
  where c.certificate_number = upper(trim(p_certificate_number)) and c.status = 'valid'
  limit 1;
$;
revoke all on function public.verify_academy_certificate(text) from public;
grant execute on function public.verify_academy_certificate(text) to anon, authenticated;

drop policy if exists "admin manage certificates" on public.certificates;
create policy "admin manage certificates" on public.certificates
for all to authenticated
using ((auth.jwt() ->> 'email') = 'rajulmoviehub@gmail.com')
with check ((auth.jwt() ->> 'email') = 'rajulmoviehub@gmail.com');

-- Create/update profile after Supabase Auth signup.
create or replace function public.handle_new_academy_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, whatsapp, country, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'whatsapp', ''),
    coalesce(new.raw_user_meta_data ->> 'country', ''),
    case when lower(coalesce(new.email,'')) = 'rajulmoviehub@gmail.com' then 'admin' else 'student' end
  )
  on conflict (id) do update set
    role = case when lower(coalesce(new.email,'')) = 'rajulmoviehub@gmail.com' then 'admin' else 'student' end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_academy on auth.users;
create trigger on_auth_user_created_academy
after insert on auth.users
for each row execute procedure public.handle_new_academy_user();

-- Important: admin privileges are determined by the verified auth email claim,
-- not by a role value supplied from the browser. Enable email confirmation in Auth.
