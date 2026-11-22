-- ZAFAR BINARY ACADEMY: add the passport number field for student applications.
-- Run this in Supabase SQL Editor after deploying the updated website.
alter table public.student_applications
  add column if not exists passport_number text;

-- Ensure the already-created academy administrator has an admin profile.
insert into public.profiles (id, full_name, whatsapp, country, role)
select id, 'Paul M K', '0714480604', 'Kenya', 'admin'
from auth.users
where lower(email) = 'rajulmoviehub@gmail.com'
on conflict (id) do update
set role = 'admin',
    full_name = excluded.full_name,
    whatsapp = excluded.whatsapp,
    country = excluded.country;
