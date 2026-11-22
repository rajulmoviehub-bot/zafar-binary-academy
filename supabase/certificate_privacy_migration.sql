-- ZAFAR BINARY ACADEMY: privacy-safe public certificate verification
-- Run once in Supabase SQL Editor. Anonymous visitors cannot read the certificates table.

drop policy if exists "certificates public verification" on public.certificates;

create or replace function public.verify_academy_certificate(p_certificate_number text)
returns table (certificate_number text, student_name text, course text, issued_at date, status text)
language sql security definer set search_path = ''
as $$
  select c.certificate_number, c.student_name, c.course, c.issued_at, c.status
  from public.certificates c
  where c.certificate_number = upper(trim(p_certificate_number)) and c.status = 'valid'
  limit 1;
$$;

revoke all on function public.verify_academy_certificate(text) from public;
grant execute on function public.verify_academy_certificate(text) to anon, authenticated;
