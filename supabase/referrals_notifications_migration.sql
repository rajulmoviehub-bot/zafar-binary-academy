-- ZAFAR BINARY ACADEMY: referrals + in-app notifications
-- Safe additive migration. Run once in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.academy_referral_codes (
  student_id uuid primary key references auth.users(id) on delete cascade,
  referral_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.academy_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_student_id uuid not null unique references auth.users(id) on delete cascade,
  referral_code text not null,
  status text not null default 'registered' check (status in ('registered','qualified','rewarded','rejected')),
  created_at timestamptz not null default now(),
  qualified_at timestamptz,
  rewarded_at timestamptz,
  constraint academy_referrals_no_self check (referrer_id <> referred_student_id)
);

create table if not exists public.academy_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  body text not null check (char_length(body) between 1 and 3000),
  category text not null default 'general' check (category in ('general','class','exam','payment','certificate','referral')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists academy_notifications_user_created_idx
  on public.academy_notifications(user_id, created_at desc);
create index if not exists academy_referrals_referrer_created_idx
  on public.academy_referrals(referrer_id, created_at desc);

alter table public.academy_referral_codes enable row level security;
alter table public.academy_referrals enable row level security;
alter table public.academy_notifications enable row level security;

drop policy if exists "Students read own referral code" on public.academy_referral_codes;
create policy "Students read own referral code" on public.academy_referral_codes
 for select to authenticated using (student_id = auth.uid());
drop policy if exists "Students create own referral code" on public.academy_referral_codes;
create policy "Students create own referral code" on public.academy_referral_codes
 for insert to authenticated with check (student_id = auth.uid());

drop policy if exists "Students read referrals they are part of" on public.academy_referrals;
create policy "Students read referrals they are part of" on public.academy_referrals
 for select to authenticated using (referrer_id = auth.uid() or referred_student_id = auth.uid());
-- No student insert/update policy: referrals must be recorded by a trusted server/admin workflow.

drop policy if exists "Students read own notifications" on public.academy_notifications;
create policy "Students read own notifications" on public.academy_notifications
 for select to authenticated using (user_id = auth.uid());
drop policy if exists "Students mark own notifications read" on public.academy_notifications;
create policy "Students mark own notifications read" on public.academy_notifications
 for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Notification creation is intentionally restricted to trusted service-role/admin workflows.

create or replace function public.academy_make_referral_code()
returns text language plpgsql volatile as $$
declare candidate text;
begin
  loop
    candidate := 'ZBA-' || upper(substr(encode(gen_random_bytes(6),'hex'),1,10));
    exit when not exists (select 1 from public.academy_referral_codes where referral_code = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function public.academy_ensure_referral_code()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.academy_referral_codes(student_id, referral_code)
  values (new.id, public.academy_make_referral_code())
  on conflict (student_id) do nothing;
  return new;
end;
$$;

drop trigger if exists academy_create_referral_code on auth.users;
create trigger academy_create_referral_code
 after insert on auth.users
 for each row execute function public.academy_ensure_referral_code();

insert into public.academy_referral_codes(student_id, referral_code)
select u.id, public.academy_make_referral_code()
from auth.users u
on conflict (student_id) do nothing;

grant select, insert on public.academy_referral_codes to authenticated;
grant select on public.academy_referrals to authenticated;
grant select, update on public.academy_notifications to authenticated;
