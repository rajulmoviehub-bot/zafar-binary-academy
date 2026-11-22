-- SAFE REGISTRATION / ADMIN PROFILE REPAIR
-- This migration intentionally does NOT add a passport_number column.
-- Run in Supabase SQL Editor only if the administrator profile is missing.
-- Never paste a service-role key into website code or chat.

insert into public.profiles (id, full_name, whatsapp, country, role)
select u.id,
       coalesce(u.raw_user_meta_data ->> 'full_name', 'Paul M K'),
       coalesce(u.raw_user_meta_data ->> 'whatsapp', '0714480604'),
       coalesce(u.raw_user_meta_data ->> 'country', 'Kenya'),
       'admin'
from auth.users u
where lower(u.email) = 'rajulmoviehub@gmail.com'
on conflict (id) do update
set role = 'admin';

-- Student application records use passport_name for the student's legal name.
-- No passport document number is collected or stored by this website.
