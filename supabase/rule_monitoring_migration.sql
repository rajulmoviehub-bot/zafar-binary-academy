-- ZAFAR BINARY ACADEMY: verified exam-rule event monitoring
create table if not exists public.academy_rule_events (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references auth.users(id) on delete cascade,
 event_code text not null check(event_code in ('late_exam_attempt','duplicate_exam_attempt')),
 details text not null default '',
 created_at timestamptz not null default now()
);
create index if not exists academy_rule_events_student_date_idx on public.academy_rule_events(student_id,created_at desc);
alter table public.academy_rule_events enable row level security;
drop policy if exists "students read own rule events" on public.academy_rule_events;
create policy "students read own rule events" on public.academy_rule_events for select to authenticated using(student_id=auth.uid());
drop policy if exists "academy admin read all rule events" on public.academy_rule_events;
create policy "academy admin read all rule events" on public.academy_rule_events for select to authenticated using((auth.jwt()->>'email')='rajulmoviehub@gmail.com');
create or replace function public.record_academy_rule_event(p_event_code text,p_details text default '')
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_count integer;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_event_code not in ('late_exam_attempt','duplicate_exam_attempt') then raise exception 'Unsupported rule event'; end if;
 insert into public.academy_rule_events(student_id,event_code,details) values(v_user,p_event_code,left(coalesce(p_details,''),240));
 select count(*) into v_count from public.academy_rule_events where student_id=v_user and created_at>=now()-interval '30 days';
 return jsonb_build_object('count',v_count,'level',case when v_count>=3 then 'review' else 'warning' end,'message',case when p_event_code='late_exam_attempt' then 'The exam deadline has passed.' else 'Only one paper is allowed per exam.' end);
end; $$;
revoke all on function public.record_academy_rule_event(text,text) from public;
grant execute on function public.record_academy_rule_event(text,text) to authenticated;
grant select on public.academy_rule_events to authenticated;
